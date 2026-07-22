// state.js — persistent progress. Pure-ish: reads/writes localStorage, no DOM.
// Shape:
//   { xp, streak, lastStudyDay,
//     words: { [hanzi]: {box, due, seen, correct, wrong} },
//     parts: { [partId]: {cleared, bestAcc} } }   // path progression / gating
'use strict';

const State = (function () {
  let data = null;

  function fresh() {
    return { xp: 0, streak: 0, lastStudyDay: null, words: {}, parts: {} };
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      data = raw ? JSON.parse(raw) : fresh();
    } catch (e) {
      data = fresh();
    }
    if (!data.parts) data.parts = {}; // migrate progress saved before the path
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

  // Path progression: mark a node cleared once its session is completed, keeping
  // the best accuracy seen (0..1) for the star rating on the map.
  function markPartCleared(id, acc) {
    if (!id) return;
    const prev = data.parts[id] || { cleared: false, bestAcc: 0 };
    data.parts[id] = { cleared: true, bestAcc: Math.max(prev.bestAcc || 0, acc || 0) };
  }
  function partCleared(id) { return !!(data.parts[id] && data.parts[id].cleared); }
  function partBestAcc(id) { return (data.parts[id] && data.parts[id].bestAcc) || 0; }

  return {
    load, save,
    get: () => data,
    wordProgress,
    touchStreak,
    addXp,
    markPartCleared, partCleared, partBestAcc,
    reset: () => { data = fresh(); save(); }
  };
})();
