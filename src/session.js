// session.js — turns a part (or a review set / chapter test) into an ordered
// queue of exercises, and drives grading. No DOM here; ui.js renders what this
// produces.
'use strict';

const Session = (function () {

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, n, exclude) {
    const pool = arr.filter(x => x !== exclude);
    return shuffle(pool.slice()).slice(0, n);
  }

  // The record a drill should use for a word: the lesson's own entry (it carries
  // extras the registry copy may not have, like a radical's example words),
  // backfilled from the registry (which adds chapterId/lessonId).
  function rec(w) { return Object.assign({}, C101.word(w.hanzi) || {}, w); }

  // Build 3 distractors for a multiple-choice item. `pool` defaults to the whole
  // graded corpus so options stay plausible even for a short part; aux parts pass
  // their own chapter (see C101.pool). Values are deduped and never equal the
  // answer — two entries can legitimately share a gloss (扌 and 手 are both
  // "hand"), and a duplicate option is an unanswerable question.
  function distractors(word, field, pool, correct) {
    const seen = new Set([correct]);
    const out = [];
    for (const w of shuffle((pool || C101.allWords()).slice())) {
      if (w.hanzi === word.hanzi) continue;
      const v = w[field];
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
      if (out.length === 3) break;
    }
    return out;
  }

  // dir 'zh2en': show hanzi, choose English. 'en2zh': show English, choose hanzi.
  // dir 'listen': hear TTS, choose hanzi. mode 'reading' hides pinyin in the UI.
  // The pool travels on the item so a missed item can be rebuilt from the same
  // one when it's requeued.
  function mcItem(word, dir, mode, pool) {
    const field = dir === 'zh2en' ? 'en' : 'hanzi';
    const correct = word[field];
    const options = shuffle(distractors(word, field, pool, correct).concat(correct));
    return { kind: dir, mode: mode || 'learn', hanzi: word.hanzi, word, correct, options, pool };
  }

  // ---- Basics drills --------------------------------------------------------
  // Three item kinds the vocabulary drills can't express. Each grades on plain
  // equality (see answer()), so only the option-building differs.

  // Tone: hear the word, pick the tone it carries. Options are rendered as the
  // word's OWN syllables under each candidate tone ("mā / má / mǎ / mà / ma"),
  // so the choice is between real spellings rather than abstract numbers — hence
  // `bases` (the toneless syllables) travelling on the item for ui.js.
  function toneItem(word) {
    const bases = Pinyin.syllables(word.pinyin).map(Pinyin.strip);
    const correct = Pinyin.pattern(word.pinyin);
    return {
      kind: 'tone', mode: 'learn', hanzi: word.hanzi, word, bases, correct,
      options: shuffle(tonePatterns(correct, bases.length).concat(correct))
    };
  }

  // Wrong tone patterns of the same shape as the answer. One syllable: the other
  // four tones, so the question is simply "which of the five is it?". Longer: 3
  // random distinct patterns. A non-initial syllable may be neutral, otherwise
  // "the neutral one is the answer" becomes a free giveaway in words like 謝謝.
  function tonePatterns(correct, n) {
    if (n <= 1) return ['1', '2', '3', '4', '5'].filter(t => t !== correct);
    const seen = new Set([correct]);
    const out = [];
    for (let guard = 0; out.length < 3 && guard < 200; guard++) {
      const p = [];
      for (let i = 0; i < n; i++) {
        const max = i === 0 ? 4 : 5; // only a following syllable can be neutral
        p.push(String(1 + Math.floor(Math.random() * max)));
      }
      const key = p.join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }

  // Sound: hear it, pick the spelling. Options come from the same lesson, which
  // is a deliberate minimal-pair set (zhī/zī, xīn/xīng) — so this is a listening
  // discrimination, not a guess between unrelated syllables.
  function soundItem(word, pool) {
    const correct = word.pinyin;
    return {
      kind: 'hear2py', mode: 'learn', hanzi: word.hanzi, word, correct, pool,
      options: shuffle(distractors(word, 'pinyin', pool, correct).concat(correct))
    };
  }

  // Radical: which real word contains this part? The answer is one of the
  // radical's own example words (curated from the graded corpus, so it's a word
  // the learner meets in the books); the decoys are OTHER radicals' example
  // words. Drawing decoys that way means each one provably contains a different
  // part, instead of merely being assumed not to contain this one — there's no
  // character-decomposition data here to check that with.
  function containsItem(word, pool) {
    const mine = word.examples || [];
    if (!mine.length) return null;
    const correct = pick(mine, 1)[0];
    const mineSet = new Set(mine);
    const others = [];
    for (const w of (pool || [])) {
      if (w.hanzi === word.hanzi) continue;
      for (const ex of (w.examples || [])) if (!mineSet.has(ex)) others.push(ex);
    }
    const seen = new Set([correct]);
    const opts = [];
    for (const ex of shuffle(others)) {
      if (seen.has(ex)) continue;
      seen.add(ex);
      opts.push(ex);
      if (opts.length === 3) break;
    }
    if (opts.length < 3) return null;   // not enough curated examples yet
    return { kind: 'contains', mode: 'learn', hanzi: word.hanzi, word, correct, pool,
             options: shuffle(opts.concat(correct)) };
  }

  // Fill-in-the-blank item: a real sentence with one word blanked, plus its
  // English translation. Options are hanzi (no pinyin — reinforces reading);
  // the learner may also type the answer as tone-tolerant pinyin (see answer()).
  function clozeItem(sentence) {
    const word = C101.word(sentence.blank);
    const others = C101.allWords().filter(w => w.hanzi !== sentence.blank).map(w => w.hanzi);
    const options = shuffle(pick(others, 3).concat(sentence.blank));
    return {
      kind: 'cloze', hanzi: sentence.blank, word, sentence,
      zh: sentence.zh, en: sentence.en, correct: sentence.blank, options
    };
  }

  // Sentence building: assemble the Chinese from word tiles. Trains word ORDER,
  // which no multiple-choice item touches. `dictate` is the same drill cued by
  // audio instead of the English translation (listening + word order).
  function buildItem(sentence, kind) {
    const toks = (sentence.tokens || []).slice();
    const pool = C101.allWords().map(w => w.hanzi).filter(h => toks.indexOf(h) < 0);
    return {
      kind: kind === 'dictate' ? 'dictate' : 'build', mode: 'learn',
      hanzi: sentence.blank, word: C101.word(sentence.blank), sentence,
      zh: sentence.zh, en: sentence.en,
      tiles: shuffle(toks.concat(pick(pool, 2))),  // 2 decoys so it isn't just unscrambling
      correct: toks.join('')
    };
  }

  // Typed recall: no options at all — produce the word from its English gloss.
  // Graded tone-tolerantly on pinyin (or the hanzi itself).
  function typeItem(word) {
    return { kind: 'type', mode: 'learn', hanzi: word.hanzi, word, correct: word.hanzi };
  }

  // Matching board: clear a handful of hanzi against their English. A warm-up —
  // deliberately does NOT feed SRS (matching with elimination is too weak a
  // signal to promote a word toward "mastered"); it only earns XP.
  function pairsItem(words) {
    return { kind: 'pairs', mode: 'learn', hanzi: words[0].hanzi,
             words: words.slice(), correct: true };
  }

  // Strip tone marks/spacing/punctuation so typed pinyin matches leniently.
  function normPinyin(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // drop tone diacritics
      .toLowerCase().replace(/[^a-z]/g, '');             // drop spaces/digits/punct
  }

  // True if a typed answer matches the target word — either the hanzi itself or
  // its pinyin, ignoring tones (so "shengjing" matches 聖經 shèng jīng).
  function pinyinMatches(typed, word) {
    if (!word) return false;
    if (String(typed).trim() === word.hanzi) return true;
    const t = normPinyin(typed);
    return !!t && t === normPinyin(word.pinyin);
  }

  // Choose which words this session drills: new words first, then due reviews,
  // capped at CONFIG.SESSION_SIZE.
  function selectWords(source) {
    const news = source.words.filter(w => SRS.isNew(w.hanzi));
    const due = source.words.filter(w => SRS.isDue(w.hanzi));
    const rest = source.words.filter(w => !SRS.isNew(w.hanzi) && !SRS.isDue(w.hanzi));
    const ordered = news.concat(due, rest);
    return ordered.slice(0, Math.max(CONFIG.SESSION_SIZE, news.length));
  }

  // Public: create a session for a part (see C101.parts). A 'learn' part teaches
  // new words then drills recall (with pinyin); a 'reading' part re-drills the
  // whole section with pinyin hidden.
  function forPart(part) {
    // Basics: a lesson can ask for a specialised drill instead of the default
    // vocabulary session.
    if (part.drill) return forDrill(part);

    // Sentence practice: the section's words back in real sentences. Skips any
    // sentence whose blank isn't a known word (so content edits can't break it).
    if (part.kind === 'cloze') {
      const sents = (part.sentences || []).filter(s => C101.word(s.blank));
      const quiz = [];
      sents.forEach((s, i) => {
        quiz.push(clozeItem(s));
        // Every other sentence also gets built from tiles, so the node mixes
        // recognition (fill the gap) with production (produce the whole line).
        if ((s.tokens || []).length >= 3 && i % 2 === 0) quiz.push(buildItem(s, 'build'));
      });
      // Close with one dictation: hear a sentence, rebuild it.
      const d = sents.find(s => (s.tokens || []).length >= 3);
      const quizzes = shuffle(quiz);
      if (d) quizzes.push(buildItem(d, 'dictate'));
      return makeSession(part, quizzes, 'cloze');
    }

    if (part.kind === 'reading') {
      const quiz = [];
      for (const w of part.words) {
        const full = C101.word(w.hanzi);
        quiz.push(mcItem(full, 'zh2en', 'reading'));
        quiz.push(mcItem(full, 'en2zh', 'reading'));
      }
      // Then the book's own sentences with a word missing — reading in context.
      const lesson = C101.lesson(part.lessonId);
      if (lesson) {
        C101.passageClozes(lesson, 3)
            .filter(s => C101.word(s.blank))
            .forEach(s => quiz.push(clozeItem(s)));
      }
      return makeSession(part, shuffle(quiz), 'reading');
    }

    const words = selectWords(part);
    const queue = [];

    // Intro cards for words the learner hasn't seen yet.
    words.filter(w => SRS.isNew(w.hanzi))
         .forEach(w => queue.push({ kind: 'intro', hanzi: w.hanzi, word: C101.word(w.hanzi) }));

    // Warm-up: match this part's words to their meanings before drilling them.
    const board = words.map(w => C101.word(w.hanzi)).filter(Boolean).slice(0, 5);
    if (board.length >= 4) queue.push(pairsItem(board));

    // Two recall directions per word + a listening item, shuffled together.
    const quiz = [];
    for (const w of words) {
      const full = C101.word(w.hanzi);
      quiz.push(mcItem(full, 'zh2en'));
      quiz.push(mcItem(full, 'en2zh'));
      quiz.push(mcItem(full, 'listen'));
      // Once a word isn't brand-new, ask for it with no options at all.
      if (!SRS.isNew(full.hanzi)) quiz.push(typeItem(full));
    }
    shuffle(quiz).forEach(q => queue.push(q));

    return makeSession(part, queue, 'learn');
  }

  // A Basics drill session: intro cards for anything new, then that drill's own
  // items. Options are drawn from the part's own (aux) pool, so a radical is
  // never offered against a Course 101 vocabulary word.
  //
  // No typed-recall item here, and no pairs warm-up outside the radical drill:
  // typing "shou" for 扌 or matching a bare tone syllable to a gloss tests the
  // wrong thing. The drills themselves are the production practice.
  function forDrill(part) {
    const pool = C101.pool(part);
    const lesson = C101.lesson(part.lessonId);
    const words = selectWords(part).map(rec);
    const queue = [];

    words.filter(w => SRS.isNew(w.hanzi))
         .forEach(w => queue.push({ kind: 'intro', hanzi: w.hanzi, word: w }));

    if (part.drill === 'radical') {
      const board = words.slice(0, 5);
      if (board.length >= 4) queue.push(pairsItem(board));
    }

    const quiz = [];
    for (const w of words) {
      if (part.drill === 'tone') {
        quiz.push(toneItem(w));
        quiz.push(mcItem(w, 'zh2en', 'learn', pool));
      } else if (part.drill === 'sound') {
        // Same-lesson pool for BOTH items: the lesson is the contrast set, and
        // against the whole chapter "what did you hear?" is no longer a listening
        // test — the four options wouldn't sound remotely alike.
        const set = (lesson && lesson.words) || pool;
        quiz.push(soundItem(w, set));
        quiz.push(mcItem(w, 'listen', 'learn', set));
      } else { // 'radical'
        quiz.push(mcItem(w, 'zh2en', 'learn', pool));
        quiz.push(mcItem(w, 'en2zh', 'learn', pool));
        const c = containsItem(w, pool);
        if (c) quiz.push(c);
      }
    }
    shuffle(quiz).forEach(q => queue.push(q));
    return makeSession(part, queue, part.drill);
  }

  // Back-compat: treat a whole section (book lesson) as one learn part.
  function forLesson(lesson) {
    return forPart({ id: lesson.id, kind: 'learn', title: lesson.title,
                     zh: lesson.zh, words: lesson.words });
  }

  // Public: chapter capstone — sentence cloze over the chapter's example
  // sentences (fill in the blanked word).
  function forTest(chapter) {
    const sents = (chapter.sentences || []).filter(s => C101.word(s.blank));
    const quiz = sents.map(clozeItem);
    const pseudo = { id: `test-${chapter.id}`, title: `${chapter.title} — Test`, zh: chapter.zh };
    return makeSession(pseudo, shuffle(quiz), 'test');
  }

  // Public: review session across all due words (the SRS inbox).
  function forReview() {
    const words = SRS.dueWords().slice(0, 20);
    const quiz = [];
    for (const w of words) {
      quiz.push(mcItem(w, Math.random() < 0.5 ? 'zh2en' : 'en2zh'));
    }
    const pseudo = { id: 'review', title: 'Review', zh: '複習' };
    return makeSession(pseudo, shuffle(quiz), 'learn');
  }

  function makeSession(lesson, queue, mode) {
    return {
      lesson,
      mode: mode || 'learn',
      queue,
      idx: 0,
      total: queue.length,
      correctCount: 0,
      missed: 0,
      done: queue.length === 0,

      current() { return this.queue[this.idx]; },
      progress() { return this.total ? this.idx / this.total : 1; },

      // Grade the current item. Returns true if the chosen answer was correct.
      // Intro cards are acknowledged (not graded). Cloze accepts the hanzi (from
      // a choice) or tone-tolerant typed pinyin. Missed quiz items are re-queued
      // once toward the end so they must be answered correctly.
      answer(choice) {
        const item = this.current();
        if (item.kind === 'intro') { this.advance(); return true; }

        const ok = item.kind === 'cloze'
          ? (choice === item.correct || pinyinMatches(choice, item.word))
          : item.kind === 'type'
            ? pinyinMatches(choice, item.word)
            : (choice === item.correct);
        // The matching board is a warm-up, not evidence of recall — no SRS.
        if (item.kind !== 'pairs') SRS.grade(item.hanzi, ok);
        State.touchStreak();
        if (ok) {
          this.correctCount += 1;
          State.addXp(CONFIG.XP_PER_CORRECT);
        } else {
          this.missed += 1;
          // requeue a fresh attempt of this item toward the end
          const again =
            item.kind === 'cloze' ? clozeItem(item.sentence) :
            (item.kind === 'build' || item.kind === 'dictate') ? buildItem(item.sentence, item.kind) :
            item.kind === 'type' ? typeItem(item.word) :
            item.kind === 'tone' ? toneItem(item.word) :
            item.kind === 'hear2py' ? soundItem(item.word, item.pool) :
            item.kind === 'contains' ? containsItem(item.word, item.pool) :
            item.kind === 'pairs' ? null :
            mcItem(item.word, item.kind, item.mode, item.pool);
          if (again) { this.queue.push(again); this.total = this.queue.length; }
        }
        State.save();
        this.advance();
        return ok;
      },

      advance() {
        this.idx += 1;
        if (this.idx >= this.queue.length) {
          this.done = true;
          const id = this.lesson.id || '';
          if (id.indexOf('test-') === 0) State.addXp(CONFIG.XP_PER_TEST);
          else if (id !== 'review') State.addXp(CONFIG.XP_PER_LESSON);
          // Path progression: clearing a node's session unlocks the next one.
          if (id && id !== 'review') {
            const acc = this.correctCount / (this.correctCount + this.missed || 1);
            State.markPartCleared(id, acc);
          }
          State.save();
        }
      }
    };
  }

  return { forPart, forLesson, forTest, forReview, pinyinMatches };
})();
