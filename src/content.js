// content.js — the content registry. Chapter files (content/chapter-XX.js) call
// window.C101.register(chapter) at load time, so no fetch is needed and the app
// runs identically on file:// and on Vercel. Load this BEFORE any chapter file.
'use strict';

const C101 = (function () {
  const chapters = [];
  const byHanzi = new Map(); // hanzi -> { ...word, chapterId, lessonId }

  function register(chapter) {
    chapters.push(chapter);
    for (const lesson of chapter.lessons) {
      for (const w of lesson.words) {
        // enrich each word with its location; key by hanzi (a word is a word).
        if (!byHanzi.has(w.hanzi)) {
          byHanzi.set(w.hanzi, Object.assign({
            chapterId: chapter.id, lessonId: lesson.id
          }, w));
        }
      }
    }
  }

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
    chapters: () => chapters,
    lessons: () => chapters.flatMap(c => c.lessons),
    allWords: () => [...byHanzi.values()],
    word: (hanzi) => byHanzi.get(hanzi),
    lesson: (id) => C101.lessons().find(l => l.id === id),
    chapter: (id) => chapters.find(c => c.id === id),
    parts,
    sentences: (chapterId) => (C101.chapter(chapterId) || {}).sentences || []
  };
})();

// expose for chapter files loaded after this script
window.C101 = C101;
