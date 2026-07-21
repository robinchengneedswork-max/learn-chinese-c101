// srs.js — Leitner spaced-repetition scheduling over State word progress.
'use strict';

const SRS = (function () {

  // Record a recall attempt; move the word between Leitner boxes and reschedule.
  function grade(hanzi, correct) {
    const p = State.wordProgress(hanzi);
    p.seen += 1;
    if (correct) {
      p.correct += 1;
      p.box = Math.min(p.box + 1, CONFIG.MASTERED_BOX);
    } else {
      p.wrong += 1;
      p.box = Math.max(0, p.box - 1); // demote, but not below box 0
    }
    const interval = CONFIG.SRS_INTERVALS[p.box] || 0;
    p.due = Date.now() + interval;
    return p;
  }

  function isNew(hanzi) {
    const p = State.get().words[hanzi];
    return !p || p.seen === 0;
  }

  function isDue(hanzi, now) {
    const p = State.get().words[hanzi];
    if (!p || p.seen === 0) return false; // "new" is separate from "due for review"
    return (p.due || 0) <= (now || Date.now());
  }

  function isMastered(hanzi) {
    const p = State.get().words[hanzi];
    return !!p && p.box >= CONFIG.MASTERED_BOX;
  }

  // All previously-seen words whose review time has arrived.
  function dueWords() {
    const now = Date.now();
    return C101.allWords().filter(w => isDue(w.hanzi, now));
  }

  // Fraction of a lesson's words that are mastered (0..1) — drives progress bars.
  function lessonMastery(lesson) {
    if (!lesson.words.length) return 0;
    const done = lesson.words.filter(w => isMastered(w.hanzi)).length;
    return done / lesson.words.length;
  }

  return { grade, isNew, isDue, isMastered, dueWords, lessonMastery };
})();
