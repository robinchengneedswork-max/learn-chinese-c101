// content.js — the content registry. Chapter files (content/chapter-XX.js) call
// window.C101.register(chapter) at load time, so no fetch is needed and the app
// runs identically on file:// and on Vercel. Load this BEFORE any chapter file.
//
// Books (modules). A chapter may carry book metadata (bookId / bookTitle /
// bookZh / bookTagline) to place it in a selectable *book*. Chapters with no
// bookId belong to the default "c101" book. The home path shows one book at a
// time (see chapters()); word progress is keyed by hanzi and shared across all
// books, so a word learned in one book counts in another.
//
// Auxiliary chapters (`aux: true` — the Basics book: radicals, bare syllables,
// tone-contrast words) are registered into a SEPARATE word map. They're real
// study items with real progress, but they must never surface as multiple-choice
// distractors in a Course 101 or GNR lesson: a lone 氵 or a tone-drill syllable
// among the options for 救贖 is trivially eliminable and teaches nothing. See
// distractorPool() — every drill draws its options from its own pool.
'use strict';

const C101 = (function () {
  const allChapters = [];             // every registered chapter (all books)
  const byHanzi = new Map();          // hanzi -> { ...word, chapterId, lessonId }
  const auxByHanzi = new Map();       // same, for aux chapters (out of the main pool)
  const books = [];                   // book objects, in first-seen order
  const bookIndex = new Map();        // bookId -> book object
  const referenceDocs = [];           // reference docs (radicals, glossary, …), per book
  let currentBookId = null;           // the home path is showing

  function ensureBook(chapter) {
    const id = chapter.bookId || 'c101';
    let book = bookIndex.get(id);
    if (!book) {
      book = {
        id,
        title: chapter.bookTitle || 'Course 101',
        zh: chapter.bookZh || '課程 101',
        tagline: chapter.bookTagline || 'Course 101: Christian Foundations',
        // An "open" book is a toolbox, not a course: every node is unlocked from
        // the start, so you can drop straight into the drill you need.
        open: !!chapter.bookOpen,
        chapters: []
      };
      bookIndex.set(id, book);
      books.push(book);
      if (currentBookId == null) currentBookId = id;
    }
    return book;
  }

  function register(chapter) {
    allChapters.push(chapter);
    ensureBook(chapter).chapters.push(chapter);
    const pool = chapter.aux ? auxByHanzi : byHanzi;
    for (const lesson of chapter.lessons) {
      // Stamp the lesson with where it came from, so a part built from it can
      // find its own distractor pool without a reverse lookup.
      lesson.chapterId = chapter.id;
      lesson.aux = !!chapter.aux;
      for (const w of lesson.words) {
        // enrich each word with its location; key by hanzi (a word is a word).
        // First registration wins, so a word shared across books keeps one
        // canonical gloss and one shared learning history. A word already taught
        // by a real book is never shadowed by an aux copy of it.
        if (byHanzi.has(w.hanzi) || pool.has(w.hanzi)) continue;
        pool.set(w.hanzi, Object.assign({
          chapterId: chapter.id, lessonId: lesson.id, aux: !!chapter.aux
        }, w));
      }
    }
  }

  // Reference material (the book's back-matter: a radicals table, a glossary, the
  // appendices, the closing prayer). Deliberately NOT registered as SRS words —
  // it never enters byHanzi, so it can't pollute the multiple-choice distractor
  // pool that the graded lessons draw from. It's browsed via the home "Reference"
  // area. A doc = { bookId, id, icon, title, zh, kind, ...payload } where kind is
  // 'table' | 'glossary' | 'passage' (see ui.js for the payload each expects).
  function registerReference(doc) { referenceDocs.push(doc); }

  function currentBook() { return bookIndex.get(currentBookId) || books[0] || null; }

  // Split a section (book lesson) into bite-size parts for finishable sessions:
  // consecutive chunks of CONFIG.PART_SIZE "learn" words, then a no-pinyin
  // "reading" part that re-drills the whole section, then (if the section has
  // example sentences) a "cloze" part that puts those words back into real
  // sentences. Pure — derived from data.
  //
  // A lesson may set `drill` ('tone' | 'sound' | 'radical') to ask for a
  // specialised session instead of the default vocabulary one (see session.js).
  // Those lessons get no Reading part: hiding the pinyin is the whole point of
  // reading practice, and it's the answer in a tone or pinyin drill.
  function parts(lesson) {
    const out = [];
    const size = CONFIG.PART_SIZE;
    const chunks = Math.max(1, Math.ceil(lesson.words.length / size));
    const carry = { lessonId: lesson.id, chapterId: lesson.chapterId,
                    aux: !!lesson.aux, drill: lesson.drill || null };
    for (let i = 0; i < chunks; i++) {
      const slice = lesson.words.slice(i * size, (i + 1) * size);
      if (!slice.length) continue;
      out.push(Object.assign({
        id: `${lesson.id}-p${i + 1}`, kind: 'learn',
        label: chunks > 1 ? `Part ${i + 1}` : 'Learn',
        title: chunks > 1 ? `${lesson.title} · ${i + 1}` : lesson.title,
        zh: lesson.zh, words: slice
      }, carry));
    }
    if (lesson.drill) return out;
    out.push(Object.assign({
      id: `${lesson.id}-read`, kind: 'reading',
      label: '📖 Reading', title: `${lesson.title} · Reading`,
      zh: lesson.zh, words: lesson.words.slice()
    }, carry));
    // Sentence practice for the section: only the blanks whose word this section
    // actually teaches (a sentence may reuse earlier vocabulary as context).
    const sents = (lesson.sentences || []).filter(s => s && s.blank && s.zh);
    if (sents.length) {
      const own = new Set(lesson.words.map(w => w.hanzi));
      out.push(Object.assign({
        id: `${lesson.id}-cloze`, kind: 'cloze',
        label: '✍️ Sentences', title: `${lesson.title} · Sentences`,
        zh: lesson.zh, sentences: sents.slice(),
        words: lesson.words.filter(w => own.has(w.hanzi) &&
                                        sents.some(s => s.blank === w.hanzi))
      }, carry));
    }
    return out;
  }

  // Pull fill-in-the-blank items straight out of a section's book passage: a
  // sentence from the real text with one of this section's words removed. No
  // English clue — the surrounding Chinese is the context. Pure, derived from
  // the passage, so it needs no extra curated data.
  function passageClozes(lesson, max) {
    const zh = (lesson && lesson.reading && lesson.reading.zh) || '';
    if (!zh) return [];
    const out = [];
    const seen = new Set();
    // The book text mixes fullwidth and ASCII sentence punctuation — split on
    // both (or two sentences run together), keeping each terminator so a
    // question still reads as a question.
    const pieces = zh.split(/([。！？；!?;\n]+)/);
    for (let i = 0; i < pieces.length; i += 2) {
      const f = (pieces[i] || '').trim();
      const end = (pieces[i + 1] || '。').replace(/\n/g, '') || '。';
      if (f.length < 8 || f.length > 34) continue;   // long enough to cue, short enough to read
      for (const w of lesson.words) {
        if (seen.has(w.hanzi)) continue;
        if (f.split(w.hanzi).length !== 2) continue; // must appear exactly once
        seen.add(w.hanzi);
        out.push({ zh: f + end, blank: w.hanzi, en: '' });
        break;
      }
      if (out.length >= (max || 3)) break;
    }
    return out;
  }

  // Every word of one chapter, in lesson order. Used as the distractor pool for
  // an aux chapter's drills (see pool()).
  function chapterWords(chapterId) {
    const ch = allChapters.find(c => c.id === chapterId);
    return ch ? ch.lessons.flatMap(l => l.words) : [];
  }

  // The pool a part's multiple-choice options are drawn from. A normal part
  // draws from the whole graded corpus, so options stay plausible even for a
  // short part. An AUX part draws only from its own chapter — radicals compete
  // with radicals, tone syllables with tone syllables — which both keeps the
  // options meaningful and keeps aux items out of the real books' lessons.
  function pool(part) {
    if (part && part.aux && part.chapterId) {
      const own = chapterWords(part.chapterId);
      if (own.length >= 4) return own;
    }
    return [...byHanzi.values()];
  }

  return {
    register,
    registerReference,
    passageClozes,
    pool,
    chapterWords,
    auxWords: () => [...auxByHanzi.values()],
    // reference docs scoped to the current book (parallels chapters())
    references: () => referenceDocs.filter(d => (d.bookId || 'c101') === currentBookId),
    // Books (modules)
    books: () => books,
    currentBook,
    setBook: (id) => { if (bookIndex.has(id)) { currentBookId = id; return true; } return false; },
    // chapters() is SCOPED to the current book (the home path renders one book).
    chapters: () => (currentBook() ? currentBook().chapters : []),
    // Lookups below are GLOBAL (span every book) so shared words + cross-book
    // ids always resolve regardless of which book is currently selected.
    lessons: () => allChapters.flatMap(c => c.lessons),
    // allWords() is the GRADED CORPUS — the real books only. It is what
    // distractors, the glossary and the radical drills' example words draw on;
    // aux items are deliberately absent (see auxWords()).
    allWords: () => [...byHanzi.values()],
    word: (hanzi) => byHanzi.get(hanzi) || auxByHanzi.get(hanzi),
    lesson: (id) => C101.lessons().find(l => l.id === id),
    chapter: (id) => allChapters.find(c => c.id === id),
    parts,
    sentences: (chapterId) => (C101.chapter(chapterId) || {}).sentences || []
  };
})();

// expose for chapter files loaded after this script
window.C101 = C101;
