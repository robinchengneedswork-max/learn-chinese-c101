// content.js — the content registry. Chapter files (content/chapter-XX.js) call
// window.C101.register(chapter) at load time, so no fetch is needed and the app
// runs identically on file:// and on Vercel. Load this BEFORE any chapter file.
//
// Books (modules). A chapter may carry book metadata (bookId / bookTitle /
// bookZh / bookTagline) to place it in a selectable *book*. Chapters with no
// bookId belong to the default "c101" book. The home path shows one book at a
// time (see chapters()); word progress is keyed by hanzi and shared across all
// books, so a word learned in one book counts in another.
'use strict';

const C101 = (function () {
  const allChapters = [];             // every registered chapter (all books)
  const byHanzi = new Map();          // hanzi -> { ...word, chapterId, lessonId }
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
    for (const lesson of chapter.lessons) {
      for (const w of lesson.words) {
        // enrich each word with its location; key by hanzi (a word is a word).
        // First registration wins, so a word shared across books keeps one
        // canonical gloss and one shared learning history.
        if (!byHanzi.has(w.hanzi)) {
          byHanzi.set(w.hanzi, Object.assign({
            chapterId: chapter.id, lessonId: lesson.id
          }, w));
        }
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
  function parts(lesson) {
    const out = [];
    const size = CONFIG.PART_SIZE;
    const chunks = Math.max(1, Math.ceil(lesson.words.length / size));
    for (let i = 0; i < chunks; i++) {
      const slice = lesson.words.slice(i * size, (i + 1) * size);
      if (!slice.length) continue;
      out.push({
        id: `${lesson.id}-p${i + 1}`, lessonId: lesson.id, kind: 'learn',
        label: chunks > 1 ? `Part ${i + 1}` : 'Learn',
        title: chunks > 1 ? `${lesson.title} · ${i + 1}` : lesson.title,
        zh: lesson.zh, words: slice
      });
    }
    out.push({
      id: `${lesson.id}-read`, lessonId: lesson.id, kind: 'reading',
      label: '📖 Reading', title: `${lesson.title} · Reading`,
      zh: lesson.zh, words: lesson.words.slice()
    });
    // Sentence practice for the section: only the blanks whose word this section
    // actually teaches (a sentence may reuse earlier vocabulary as context).
    const sents = (lesson.sentences || []).filter(s => s && s.blank && s.zh);
    if (sents.length) {
      const own = new Set(lesson.words.map(w => w.hanzi));
      out.push({
        id: `${lesson.id}-cloze`, lessonId: lesson.id, kind: 'cloze',
        label: '✍️ Sentences', title: `${lesson.title} · Sentences`,
        zh: lesson.zh, sentences: sents.slice(),
        words: lesson.words.filter(w => own.has(w.hanzi) &&
                                        sents.some(s => s.blank === w.hanzi))
      });
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

  return {
    register,
    registerReference,
    passageClozes,
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
    allWords: () => [...byHanzi.values()],
    word: (hanzi) => byHanzi.get(hanzi),
    lesson: (id) => C101.lessons().find(l => l.id === id),
    chapter: (id) => allChapters.find(c => c.id === id),
    parts,
    sentences: (chapterId) => (C101.chapter(chapterId) || {}).sentences || []
  };
})();

// expose for chapter files loaded after this script
window.C101 = C101;
