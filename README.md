# C101 — Learn Chinese

A Duolingo-style PWA for the **Chinese vocabulary of _Course 101: Christian
Foundations_**. The book is a bilingual (English + Traditional Chinese)
discipleship course; this app teaches the Chinese words it uses, section by
section, with spaced repetition.

Chapter 1 is built. More chapters drop in as you learn them — see
[Adding a chapter](#adding-a-chapter).

## Run it

```bash
npm start           # → http://localhost:5173  (needed for the service worker)
```

No build step, no dependencies. You can also just open `index.html` directly —
everything works on `file://` except the offline service worker (which needs
http/https, i.e. the dev server or the deployed site).

Run the engine tests:

```bash
npm test            # headless logic tests (no browser)
```

## How it works

Vanilla JS, no framework, following the `AI SLOP` module conventions. Script
load order in `index.html` is dependency order.

```
src/config.js    — tuning: SRS intervals, session size, XP, TTS language
src/content.js   — window.C101 registry; chapter files register into it
src/lang-map.js  — generated Traditional→Simplified char map (tools/build_langmap.py)
src/lang.js      — display script picker; converts Chinese at render time only
src/state.js     — progress in localStorage (xp, streak, per-word SRS record)
src/srs.js       — Leitner spaced repetition (6 boxes, correct↑ / miss↓)
src/session.js   — builds an exercise queue for a lesson or a review set
src/audio.js     — Chinese TTS (SpeechSynthesis) + procedural correct/wrong SFX
src/ui.js        — screens (home / session / results) + exercise rendering
src/main.js      — boot + service-worker registration
content/*.js     — the vocabulary data (one file per chapter)
```

**Sections → parts.** Each book section (~12 words) is split at runtime into
bite-size **parts** so a sitting is finishable: two ~6-word **learn** parts, then
one **📖 Reading** part that re-drills the whole section with the pinyin hidden —
the on-ramp to reading unaided. (Tuning: `CONFIG.PART_SIZE`.)

**Exercise types:** new-word flashcard (with audio) → multiple choice
Chinese→English, English→Chinese, and listen→Chinese. In a Reading part, pinyin is
suppressed everywhere. Missed words are re-queued and demoted a box; correct
answers promote a word toward "mastered."

**Traditional / Simplified.** The book — and therefore all content and saved
progress — is **Traditional** Chinese. The picker in the top-left switches the
*displayed* script to **Simplified** (`src/lang.js` converts Chinese at render time
via the generated `src/lang-map.js`); grading, per-word progress, and the content
files are untouched, so switching never resets anything. The picker is data-driven
(`Lang.langs()`) so more languages/scripts can be added there later.

**Chapter Test.** A cumulative fill-in-the-blank (sentence cloze): a real sentence
with one word blanked plus its English translation. **Choose** the missing word, or
tap *Type it* and enter tone-tolerant **pinyin** (e.g. `shengjing` for 聖經). Needs
per-chapter example sentences (see Data format).

## Data format

Content files are plain JS that call `window.C101.register(...)`. No fetch, so it
works identically offline and on `file://`.

```js
window.C101.register({
  id: "ch01",
  title: "Chapter 1 — What Is Life?",
  zh: "第一章：生命的意義",
  lessons: [
    { id: "ch01-l1", title: "Nature of Man", zh: "人的本質", words: [
        { hanzi: "生命", pinyin: "shēng mìng", en: "life (of a living being)" },
        ...
    ],
      // Optional: the section's book passage — the curated "main body" prose.
      // Powers the per-section "📖 Read the C101 text" button on the home path
      // (Chinese to read unaided, with a play button + an English reveal).
      // Paragraphs are blank-line separated. See "Adding a chapter".
      reading: { zh: "人生多問。…\n\n道金斯和羅素…", en: "Man asks questions. …" }
    }
  ],
  // Chapter Test cloze items. `blank` is a chapter word that appears verbatim in
  // `zh`; it's removed and the learner supplies it. Curated from the book text.
  sentences: [
    { zh: "神創造了宇宙。", en: "God created the universe.", blank: "創造" },
    ...
  ]
});
```

Per-word progress is keyed by `hanzi`, so the same word appearing in a later
chapter shares its learning history.

## Adding a chapter

The source is `C101 Chinese Traditional Book 2021-08-12.pdf`. The tooling lives
in `tools/` (Python 3 + `pymupdf`; CC-CEDICT is downloaded to `cedict.txt`).

**1. Find the chapter's section headings + page range.** Section titles are the
ALL-CAPS English lines in the PDF (and their Chinese counterparts).

**2. Generate a review file** — aligned English + Chinese + candidate vocab:

```bash
py tools/gen_candidates.py --pdf "C101 Chinese Traditional Book 2021-08-12.pdf" \
   --out review/ch02.md --end 60 \
   --sections "37:A GOOD THING" "44:ESSENCE OF SIN" ...
```

Each section in the output has three parts:
- **English (ground truth)** — the book's own English for that passage.
- **Chinese** — the parallel Chinese.
- **Candidates** — `word | pinyin | gloss | count | VAGUE?`, sorted by frequency.

`VAGUE` flags function words, surname-only glosses, wrong dictionary readings,
and words with many senses. **When a gloss is vague, disambiguate it against the
English (ground truth) text** — the book tells you exactly which sense is meant.
CC-CEDICT sometimes picks the wrong reading (e.g. 說 as _shuì_ "to persuade"
instead of _shuō_ "to say"); the English column is how you catch it.

**3. Curate** the chapter's word list into `tools/build_content.py` (`CHAPTER`),
grouping words into lessons that mirror the book's sections (~8–12 words each).
Give each word a clean English gloss. Add a pinyin override only when CC-CEDICT's
first entry is the wrong reading. Also add a handful of **`sentences`** (cloze items
for the Chapter Test) — short sentences from the book's Chinese text, each blanking
one chapter word. The build validates that every `blank` is a chapter word and
appears verbatim in its sentence.

**4. Build** the content file (pinyin is pulled from CC-CEDICT automatically).
The build also attaches each section's book passage as the lesson's `reading`
(powering the "📖 Read the C101 text" button). Prefer a **curated "main body"**
passage in `READINGS` (the book's expository prose — verbatim runs with scripture
block-quotes, long external quotations, discussion questions, footnotes, and
page-header artifacts removed; paragraphs as a list). If a lesson isn't in
`READINGS`, the build falls back to the raw `## Chinese` / `## English (ground
truth)` blocks from the review file (aligned to lessons in order).

```bash
py tools/build_content.py        # → content/chapter-02.js
```

**5. Refresh the Simplified map** — new chapters introduce new characters, so
regenerate the Traditional→Simplified map (it scans `content/*.js`):

```bash
py tools/build_langmap.py        # → src/lang-map.js
```

Eyeball the diff for any one-to-many Traditional characters (e.g. 著→着); pin the
book's reading in `OVERRIDES` in `tools/build_langmap.py` if needed.

**6. Wire it up:** add `<script src="content/chapter-02.js"></script>` to
`index.html` (after `chapter-01.js`) and add the path to `ASSETS` in `sw.js`
(and bump `CACHE` to the next `c101-vN` so clients refresh).

## Deploy (Vercel)

It's a static site — no config needed. Push to a GitHub repo and import it in
Vercel, or:

```bash
npx vercel --prod
```

Then open the URL on your phone and **Add to Home Screen** to install the PWA.

## License / source

Vocabulary is derived from _Course 101: Christian Foundations_ for personal
study. Pinyin/definitions use [CC-CEDICT](https://cc-cedict.org/) (CC BY-SA 4.0).
