// state.js — persistent progress. Pure-ish: reads/writes localStorage, no DOM.
// Shape:
//   { xp, streak, lastStudyDay, words: { [hanzi]: {box, due, seen, correct, wrong} } }
'use strict';

const State = (function () {
  let data = null;

  function fresh() {
    return { xp: 0, streak: 0, lastStudyDay: null, words: {} };
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      data = raw ? JSON.parse(raw) : fresh();
    } catch (e) {
      data = fresh();
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* private mode / quota — progress is best-effort */ }
  }

  function wordProgress(hanzi) {
    if (!data.words[hanzi]) {
      data.words[hanzi] = { box: 0, due: 0, seen: 0, correct: 0, wrong: 0 };
    }
    return data.words[hanzi];
  }

  function dayStamp(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  // Update the day streak when a study action happens.
  function touchStreak() {
    const today = dayStamp(Date.now());
    if (data.lastStudyDay === today) return;
    const yesterday = dayStamp(Date.now() - 86400000);
    data.streak = (data.lastStudyDay === yesterday) ? data.streak + 1 : 1;
    data.lastStudyDay = today;
  }

  function addXp(n) { data.xp += n; }

  return {
    load, save,
    get: () => data,
    wordProgress,
    touchStreak,
    addXp,
    reset: () => { data = fresh(); save(); }
  };
})();
