# C101 — Learn Chinese

A Duolingo-style PWA for the **Chinese vocabulary of _Course 101: Christian
Foundations_**. The book is a bilingual (English + Traditional Chinese)
discipleship course; this app teaches the Chinese words it uses, section by
section, with spaced repetition.

Chapter 1 is built — 228 words across 16 lessons, covering the vocabulary of the
chapter's own text. More chapters drop in as you learn them — see
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

The logic tests don't touch the DOM, so UI work is checked by screenshot:
`node tools/shot.js http://localhost:5173/ out.png` renders the app in a
phone-sized headless Chrome (and can send real touch gestures — see the header
comment).

## How it works

Vanilla JS, no framework, following the `AI SLOP` module conventions. Script
load order in `index.html` is dependency order.

```
src/config.js    — tuning: SRS intervals, session size, XP, TTS language
src/content.js   — window.C101 registry; chapter files register into it
src/lang-map.js  — generated Traditional→Simplified char map (tools/build_langmap.py)
src/lang.js      — display script picker; converts Chinese at render time
src/pinyin.js    — tone arithmetic on tone-marked pinyin (powers the tone drills) only
src/state.js     — progress in localStorage (xp, streak, per-word SRS record)
src/srs.js       — Leitner spaced repetition (6 boxes, correct↑ / miss↓)
src/session.js   — builds an exercise queue for a lesson or a review set
src/audio.js     — Chinese TTS (SpeechSynthesis) + UI sounds (CC0 samples, combo milestone)
src/ui.js        — screens (home / session / results) + exercise rendering
src/main.js      — boot + service-worker registration
content/*.js     — the vocabulary data (one file per chapter)
```

**Books (modules).** The app can hold more than one book. Each registered
chapter may carry book metadata (`bookId` / `bookTitle` / `bookZh` /
`bookTagline`); chapters with none belong to the default **Course 101** book.
The home screen shows a **book picker** (top of the path, hidden when only one
book exists) that swaps which book's learning path you see — the choice persists.
Word progress is keyed by `hanzi` and **shared across books**, so a word learned
in one counts in another. Two optional modules ship alongside Course 101:
**Good News Reader** (`content/gnr-chapter-*.js`) and **Basics**
(`content/basics-*.js`).

**Basics.** The groundwork Course 101 assumes you already have: the sounds, the
tones, the parts characters are built from, and everyday words like 不 / 很 / 個.
Two things make it different from a normal book:

- **It's an open path** (`bookOpen: true`). Nothing is gated — it's a toolbox you
  dip into for the drill you need, not a course you walk end to end.
- **Its words are `aux`** (`aux: true` on the chapter). They register into a
  separate pool, so a bare 氵 or a tone-drill syllable can never turn up as a
  multiple-choice distractor in a Course 101 or GNR lesson — an option that's
  trivially eliminable teaches nothing. Each Basics drill draws its options from
  its own chapter instead. Progress is still shared by `hanzi` as everywhere else,
  so drilling the tones of 聖經 here feeds its Chapter 1 record.

A lesson opts into a specialised session with `drill`:

| `drill` | Chapter | What the session does |
| --- | --- | --- |
| `'sound'` | Sounds & Pinyin | **hear → pick the spelling**, plus listen→hanzi. Options come from the *same lesson*, so every lesson is a deliberate minimal-pair set (zhī/zī, xīn/xīng) and the item is a real discrimination |
| `'tone'` | Tones | **hear → pick the tone.** Options are generated: the word's own syllables respelled under each candidate tone (mā / má / mǎ / mà / ma), so you choose between real spellings, not numbers. Two-syllable entries drill the tone *pattern* |
| `'radical'` | Radicals & Character Parts | part→meaning, meaning→part, and **"which character contains this part?"** built from corpus characters |

Drill lessons get no 📖 Reading part — hiding the pinyin is the point of reading
practice, and it's the *answer* in a tone or sound drill.

**Getting around a long path.** The Good News Reader is 25 sections — roughly a
23,000px page — so the home screen carries two navigation aids, both built from
the same waypoints (each chapter, or each *section* when a book has only one
chapter, as Course 101 does today):

- The **chapter rail** down the right edge: a mini-map of the whole path. A tick
  per waypoint at its true position in the page, a thumb showing the slice you're
  looking at, and a green dot for the lesson you're up to. Tap a tick to jump,
  or drag anywhere on the rail to scrub, with the waypoint name shown as you
  pass it. It measures the live document (`layoutRail` in `ui.js`), so anything
  that changes the page height must re-run it. It hides itself on a path shorter
  than ~1.6 screens, and the page keeps a gutter clear for it, since the rail
  swallows every pointer in its strip. It has to own the gesture outright — if
  the browser scrolls the page at the same time, the two fight over the scroll
  position — hence `touch-action: none`, a non-passive `touchmove` that cancels
  the default, and a `pointercancel` that releases the drag *without* acting.
- The **🧭 Jump** button, bottom-right: the same waypoints as a menu, plus
  *Current lesson*. Rail is pointer-only by design; this is the keyboard route.

**Sections → parts.** Each book section is split at runtime into bite-size
**parts** so a sitting is finishable: ~6-word **learn** parts, then a
**📖 Reading** part that re-drills the whole section with the pinyin hidden — the
on-ramp to reading unaided — then a **✍️ Sentences** part that puts the section's
words back into real sentences. (Tuning: `CONFIG.PART_SIZE`.)

**Exercise types.** Recognition *and* production — multiple choice alone doesn't
build recall:

| Exercise | Where | What it asks |
| --- | --- | --- |
| New-word flashcard | learn | read + hear a new word |
| **Tap the pairs** | learn | clear a board of 5 hanzi against their English (warm-up; deliberately does **not** feed SRS — matching with elimination is too weak a signal) |
| Multiple choice | learn, reading | zh→en, en→zh, and listen→zh |
| **Type it** | learn | produce a seen word from its gloss, no options, tone-tolerant pinyin |
| **Passage cloze** | reading | a sentence from the **book's own text** with a word removed, no translation |
| Cloze | sentences, test | curated sentence + English clue; choose or type the missing word |
| **Build the sentence** | sentences | assemble the Chinese from word tiles (+2 decoys) — the only drill that teaches word **order** |
| **Listen & build** | sentences | same, cued by audio instead of English |
| **Which tone?** | Basics · tones | hear a word, pick its tone (or tone pattern) from its own syllables respelled |
| **What did you hear?** | Basics · sounds | pick the pinyin out of the lesson's minimal pairs |
| **Which character contains this part?** | Basics · radicals | pick the character built from a given radical |

In a Reading part pinyin is suppressed everywhere. Missed items are re-queued and
demoted a box; correct answers promote a word toward "mastered."

**How it feels.** Answering should be worth doing, not just correct:

- **Buttons press.** Options and the Continue button have a hard bottom edge that
  collapses under the thumb, so the screen answers back before the answer is graded.
- **A run is rewarded at milestones, not per link.** Consecutive correct answers
  build a **combo** (`session.combo`). Every correct answer sounds *identical*;
  each `CONFIG.COMBO_MILESTONE`th one adds a second copy of the same hit a fifth
  above it (`COMBO_LIFT` / `COMBO_LIFT_GAP`) — a two-note lift, with its own
  banner. From `CONFIG.COMBO_CELEBRATE` the banner calls the streak out, and the
  results screen keeps the session's best. The pairs board is excluded from the
  run for the same reason it's excluded from SRS.
  (Earlier this climbed a semitone per link. It sounded clever and wore badly: the
  sound you hear most often was never twice the same, and because the climb is
  `playbackRate` it got *faster* as well as higher. Rare and fixed beats creeping.)
- **Sounds are samples** from Kenney's CC0 *Interface Sounds* (`assets/sfx/`),
  decoded once on the first gesture. If they can't load — `file://` blocks `fetch` —
  each falls back to the synthesised tone it replaced, so nothing goes silent.
- **A sound can never strand a lesson.** `SFX.correct` is called from the top of
  `showFeedback`, *before* it draws the banner and the Continue button, so a throw
  in the audio stack used to cost you the whole question, not just the sound. Every
  `SFX` entry point and `buzz` now swallow their own failures. Related: play with a
  bare `start()` unless a note genuinely needs a clock, and re-`resume()` the
  context on use — mobile parks it whenever it decides the unlocking gesture
  expired, and a parked context accepts everything and plays nothing.
- **Finishing counts up.** The XP chip rolls from where the session started rather
  than printing the total, over a short confetti burst. Both are skipped under
  `prefers-reduced-motion`.
- **Haptics are one tick, on tap, and nothing else.** Android gets it from
  `navigator.vibrate`. iOS has no Vibration API at all — WebKit's standards position
  formally opposes it — so `UI.tappable` also lays an invisible
  `<input type="checkbox" switch>` over each button: a *direct tap* on a native
  switch is the only thing that still reaches the Taptic Engine (Apple closed the
  scripted route in iOS 26.5). The real `<button>` stays underneath for keyboard and
  assistive tech, which is why the click handler lives on the wrapper. There is
  deliberately **no reward buzz** — it's impossible on iOS, so it would be an
  Android-only reward, and the design would come to lean on something half the
  devices can't do.

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
      reading: { zh: "人生多問。…\n\n道金斯和羅素…", en: "Man asks questions. …" },

      // Optional: this section's own sentence practice (the ✍️ Sentences node).
      // `blank` must be a word THIS section teaches and appear exactly once in
      // `zh`. `tokens` is the word-segmentation used by "build the sentence"
      // (generated — joining them must reproduce `zh` minus punctuation).
      sentences: [
        { zh: "人是一個複雜的生物。", en: "Man is a complex living creature.",
          blank: "複雜", tokens: ["人","是","一個","複雜","的","生物"] }
      ]
    }
  ],
  // Chapter Test cloze items. `blank` is a chapter word that appears verbatim in
  // `zh`; it's removed and the learner supplies it. Curated from the book text.
  sentences: [
    { zh: "神創造了宇宙。", en: "God created the universe.", blank: "創造",
      tokens: ["神","創造","了","宇宙"] },
    ...
  ]
});
```

Per-word progress is keyed by `hanzi`, so the same word appearing in a later
chapter shares its learning history.

## Adding a chapter

The source is `C101 Chinese Traditional Book 2021-08-12.pdf`. The tooling lives
in `tools/` (Python 3 + `pymupdf`; CC-CEDICT is downloaded to `cedict.txt`).

> **Scanned-image books are hand-transcribed.** The pipeline below reads a
> *text-layer* PDF. Some books (e.g. Good News Reader) are scans with no text
> layer, so `build_content.py` can't read them. For those, transcribe the book's
> own numbered vocab list (hanzi · pinyin · gloss) and passages by hand, convert
> Simplified → Traditional (canonical), and write the `content/*.js` file
> directly. Still finish with steps 5–6 (refresh the lang-map, wire up sw/index).

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

**3. Curate** the chapter's word list into `tools/build_content.py` (`CHAPTER`).

> **The bar is reading coverage:** a section should teach ~every content word in
> the passage the app shows for it, so the 📖 Reading text is actually readable.
> Split a dense section into several lessons along its paragraph seams (give each
> a distinct title — the parts system already appends "· N"), and give each one
> the `READINGS` paragraphs whose words it teaches. Chapter 1 is the worked
> example: 5 book sections → 16 lessons.

To see what a passage actually demands, run the extractor — it segments each
lesson's `READINGS` prose and flags every word `TAUGHT` / `FUNC` / `NAME` /
`1CHAR`, so curation is pruning a list rather than brainstorming one:

```bash
PYTHONIOENCODING=utf-8 py tools/extract_passage_vocab.py [lesson-id]
```

(The `PYTHONIOENCODING` is required — the Windows console is cp1252 and will
`UnicodeEncodeError` on hanzi otherwise.)

Give each word a clean English gloss. Add a pinyin override only when CC-CEDICT's
first entry is the wrong reading. Then add sentences in two places:
`LESSON_SENTENCES[lesson-id]` (the per-section ✍️ Sentences node) and the
chapter-level **`sentences`** (the Chapter Test). The build validates every
`blank`: it must be a word of that lesson/chapter, appear **exactly once** in its
sentence, and be a whole token of the segmentation.

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

## Adding to Basics

Basics content is hand-written (no PDF pipeline) — `content/basics-*.js`, same
`register(...)` shape plus `aux: true` and a per-lesson `drill`. Two rules are
load-bearing:

**Tone lessons.** The only thing that must be right is the tone mark in `pinyin`;
`src/pinyin.js` reads the tone off it and generates the options. No per-word
option data.

**Radical `examples`.** These feed "which character contains this part?", and the
drill draws its decoys from *other* radicals' example lists. So an example must
contain its own radical **and no other radical in the chapter** — otherwise it is
a second correct answer to somebody else's question. 案 (宀+**女**+**木**) is out;
洗 (氵+先) is in. Examples must also be single characters that appear somewhere in
the graded corpus, so they're characters you actually meet in the books.

There is no character-decomposition data in this repo, so the second rule is
curation, not computation: `npm test` verifies corpus membership and catches a
character claimed by two radicals, but it cannot catch a second component you
overlooked. Check the components by hand. A radical with no clean example simply
gets none — the drill skips that item and still teaches the part by meaning.

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
UI sounds in `assets/sfx/` are from Kenney's
[Interface Sounds](https://kenney.nl/assets/interface-sounds) (CC0 — public domain,
no attribution required; credited here anyway).
