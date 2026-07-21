// config.js — constants & tuning. No logic, no DOM.
'use strict';

const CONFIG = {
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

  TTS_LANG: 'zh-TW',        // book is Traditional Chinese
  TTS_RATE: 0.85
};
