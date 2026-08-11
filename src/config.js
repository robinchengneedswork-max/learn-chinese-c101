// config.js — constants & tuning. No logic, no DOM.
'use strict';

const CONFIG = {
  // Shown on the home screen and asserted to equal sw.js's CACHE. A stale phone
  // is the single most expensive bug in this project to diagnose remotely, and
  // it always ends with someone guessing from symptoms. Now you just read it.
  BUILD: 'c101-v28',

  STORAGE_KEY: 'c101.progress.v1',

  // Leitner spaced-repetition boxes. Index = box level; value = ms until due.
  // A word graduates up a box on correct recall, drops on a miss.
  SRS_INTERVALS: [
    0,                       // box 0: new / just missed — due immediately
    1000 * 60 * 60 * 4,      // box 1: 4 hours
    1000 * 60 * 60 * 24,     // box 2: 1 day
    1000 * 60 * 60 * 24 * 3, // box 3: 3 days
    1000 * 60 * 60 * 24 * 7, // box 4: 1 week
    1000 * 60 * 60 * 24 * 21 // box 5: 3 weeks (mastered)
  ],
  MASTERED_BOX: 5,

  XP_PER_CORRECT: 10,
  XP_PER_LESSON: 20,        // completion bonus
  XP_PER_TEST: 40,          // chapter-test completion bonus

  // How many distinct words a single lesson session drills at once.
  SESSION_SIZE: 8,

  // A section (book lesson, ~12 words) is split into bite-size "parts" of this
  // many words each, plus one no-pinyin Reading part covering the whole section.
  PART_SIZE: 6,

  // How many items must sit between two questions about the same word. A word
  // gets 3–4 items per session, so a plain shuffle would put ~2 of them
  // back-to-back — the one gap that teaches nothing, since the answer is still
  // in working memory and never gets retrieved from long-term memory at all.
  // Needs MIN_ITEM_LAG+1 distinct words to be satisfiable; see Session.space.
  MIN_ITEM_LAG: 3,

  TTS_LANG: 'zh-TW',        // book is Traditional Chinese
  TTS_RATE: 0.85,

  // Combo: consecutive correct answers within one session. Every correct answer
  // sounds the same; the run is rewarded at milestones instead — a two-note lift
  // every COMBO_MILESTONE links. (An earlier build climbed a semitone per link,
  // which meant the sound you hear most often was never the same twice and got
  // faster and shrill on a long run. A rare, fixed reward beats a creeping one.)
  COMBO_MILESTONE: 5,
  COMBO_LIFT: 1.5,          // the milestone's second note: a fifth above the first
  COMBO_LIFT_GAP: 0.09,     // seconds between the two notes
  COMBO_CELEBRATE: 3,       // combo at which the banner starts calling it out

  SFX_VOLUME: 0.55,
  // A tick under the thumb when an option is tapped. Everything after grading is
  // deliberately silent on the haptics channel: iOS can't fire it (Apple has never
  // shipped the Vibration API, and since iOS 26.5 only a direct tap on a native
  // switch control does anything), so a reward buzz would exist on Android only.
  HAPTIC_TAP_MS: 15
};
