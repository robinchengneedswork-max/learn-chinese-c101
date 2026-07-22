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

  // Build 3 distractors for a multiple-choice item, drawn from the whole corpus
  // so options stay plausible even for a short part.
  function distractors(word, field) {
    const others = C101.allWords().filter(w => w.hanzi !== word.hanzi);
    return pick(others.map(w => w[field]), 3);
  }

  // dir 'zh2en': show hanzi, choose English. 'en2zh': show English, choose hanzi.
  // dir 'listen': hear TTS, choose hanzi. mode 'reading' hides pinyin in the UI.
  function mcItem(word, dir, mode) {
    const field = dir === 'zh2en' ? 'en' : 'hanzi';
    const correct = word[field];
    const options = shuffle(distractors(word, field).concat(correct));
    return { kind: dir, mode: mode || 'learn', hanzi: word.hanzi, word, correct, options };
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
    if (part.kind === 'reading') {
      const quiz = [];
      for (const w of part.words) {
        const full = C101.word(w.hanzi);
        quiz.push(mcItem(full, 'zh2en', 'reading'));
        quiz.push(mcItem(full, 'en2zh', 'reading'));
      }
      return makeSession(part, shuffle(quiz), 'reading');
    }

    const words = selectWords(part);
    const queue = [];

    // Intro cards for words the learner hasn't seen yet.
    words.filter(w => SRS.isNew(w.hanzi))
         .forEach(w => queue.push({ kind: 'intro', hanzi: w.hanzi, word: C101.word(w.hanzi) }));

    // Two recall directions per word + a listening item, shuffled together.
    const quiz = [];
    for (const w of words) {
      const full = C101.word(w.hanzi);
      quiz.push(mcItem(full, 'zh2en'));
      quiz.push(mcItem(full, 'en2zh'));
      quiz.push(mcItem(full, 'listen'));
    }
    shuffle(quiz).forEach(q => queue.push(q));

    return makeSession(part, queue, 'learn');
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
          : (choice === item.correct);
        SRS.grade(item.hanzi, ok);
        State.touchStreak();
        if (ok) {
          this.correctCount += 1;
          State.addXp(CONFIG.XP_PER_CORRECT);
        } else {
          this.missed += 1;
          // requeue a fresh attempt of this item toward the end
          this.queue.push(item.kind === 'cloze'
            ? clozeItem(item.sentence)
            : mcItem(item.word, item.kind, item.mode));
          this.total = this.queue.length;
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
