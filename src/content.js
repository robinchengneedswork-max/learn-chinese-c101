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
  // consecutive chunks of CONFIG.PART_SIZE "learn" words, plus a final no-pinyin
  // "reading" part that re-drills the whole section. Pure — derived from data.
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
    return out;
  }

  return {
    register,
    registerReference,
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
