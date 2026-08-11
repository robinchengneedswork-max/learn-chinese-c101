// srs.js — Leitner spaced-repetition scheduling over State word progress.
'use strict';

const SRS = (function () {

  // Record a recall attempt; move the word between Leitner boxes and reschedule.
  //
  // `opts.onlyIfDue` is for the Review hub's ad-hoc modes (redrill a chapter,
  // weakest words, random mix). There, a correct answer on a word that wasn't
  // due yet must NOT promote it or push its next review out: the learner chose
  // to look at it early, and rewarding that with a longer interval would make
  // them forget it sooner — the exact complaint the hub exists to answer. A miss
  // always demotes, whenever it happens.
  function grade(hanzi, correct, opts) {
    const p = State.wordProgress(hanzi);
    const wasDue = (p.due || 0) <= Date.now();
    p.seen += 1;
    if (correct) {
      p.correct += 1;
      if (!(opts && opts.onlyIfDue) || wasDue) {
        p.box = Math.min(p.box + 1, CONFIG.MASTERED_BOX);
        p.due = Date.now() + (CONFIG.SRS_INTERVALS[p.box] || 0);
      }
      // else: leave box and schedule exactly as they were.
    } else {
      p.wrong += 1;
      p.box = Math.max(0, p.box - 1); // demote, but not below box 0
      p.due = Date.now() + (CONFIG.SRS_INTERVALS[p.box] || 0);
    }
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

  const record = (hanzi) => State.get().words[hanzi];

  // All previously-seen words whose review time has arrived, MOST OVERDUE FIRST
  // — the old order was corpus registration order, so a cap of N always reviewed
  // the front of Chapter 1 and never the word you were closest to losing.
  //
  // Drawn from everyWord(), not allWords(): Basics words are graded and boxed
  // like any other, and used to be invisible here purely because they live in
  // the aux pool.
  function dueWords() {
    const now = Date.now();
    return C101.everyWord()
      .filter(w => isDue(w.hanzi, now))
      .sort((a, b) => (record(a.hanzi).due || 0) - (record(b.hanzi).due || 0));
  }

  // Everything the learner has actually met, in any book. The pool the Review
  // hub's ad-hoc modes choose from — reviewing a word you've never seen would be
  // teaching, not reviewing.
  function seenWords() {
    return C101.everyWord().filter(w => !isNew(w.hanzi));
  }

  // The leeches: what you keep getting wrong, worst miss-rate first, ties broken
  // by the raw number of misses so a 1-of-2 doesn't outrank a 7-of-20.
  function weakWords() {
    return seenWords()
      .map(w => ({ w, p: record(w.hanzi) }))
      .filter(({ p }) => p.wrong > 0)
      .sort((a, b) => (b.p.wrong / b.p.seen) - (a.p.wrong / a.p.seen) || b.p.wrong - a.p.wrong)
      .map(({ w }) => w);
  }

  // Fraction of a lesson's words that are mastered (0..1) — drives progress bars.
  function lessonMastery(lesson) {
    if (!lesson.words.length) return 0;
    const done = lesson.words.filter(w => isMastered(w.hanzi)).length;
    return done / lesson.words.length;
  }

  return { grade, isNew, isDue, isMastered, dueWords, seenWords, weakWords, lessonMastery };
})();
