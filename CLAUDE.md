# CLAUDE.md

Guidance for Claude Code working in this repo. **`README.md` is the primary doc** — how it
works, the module layout, the content pipeline, and the full "Adding a chapter" workflow all
live there. Read it first. This file only captures the extras.

## What this is

**C101 — Learn Chinese**: a Duolingo-style PWA that teaches the Chinese vocabulary of the
bilingual book *Course 101: Christian Foundations*, section by section, with spaced repetition.
Vanilla JS, no framework, no build step. Graduated out of the `AI SLOP` games collection into
its own repo on 2026-07-21 and still follows the AI SLOP module conventions.

## Run / test

```bash
npm start      # http://localhost:5173  (service worker needs http, not file://)
npm test       # headless logic tests (no browser) — expect all-pass before shipping
```

You can also open `index.html` directly on `file://`; everything works except the offline SW.

## Conventions & gotchas

- **Module load order = dependency order** in `index.html`. Modules share global scope
  (`window.C101` is the content registry). No imports, no bundler.
- **Content is data, not code**: `content/chapter-NN.js` files call `window.C101.register(...)`.
  Regenerate them with the Python tooling in `tools/` — don't hand-edit generated content.
- **Python tooling uses the `py` launcher** (Python 3 + `pymupdf`), not the bare `python`
  command (that's the MS Store stub on this machine). CC-CEDICT (`cedict.txt`) is downloaded
  and gitignored.
- **Per-word progress is keyed by `hanzi`** (localStorage). Changing a word's hanzi starts a
  fresh learning history for it.
- **Service worker cache discipline**: when you add/rename an asset, add it to `ASSETS` in
  `sw.js` AND bump `CACHE` (`c101-vN`) so clients actually refresh.
- **Deploy**: static site on Vercel; push `main` = deploy once the repo is imported.

## Memory

Durable project state (sprint history, decisions, what's pushed vs. device-tested, the content
pipeline, next-up work) lives in this project's Claude memory, loaded automatically each session.
Trust it for status, but verify any file/flag it names still exists before acting.

## Next up

**Chapter 1 is the template for the rest of C101.** It was rebuilt to a *reading-coverage*
bar (teach ~every content word in the passage the app shows) — 60 words/5 lessons → **228
words/16 lessons**, dense sections split along paragraph seams. Curate with
`py tools/extract_passage_vocab.py` (needs `PYTHONIOENCODING=utf-8`), then follow README
"Adding a chapter". Chapter 2 is the next content job.

Exercises now cover production, not just recognition: tap-the-pairs, typed recall,
passage cloze (from the book's own text), build-the-sentence from word tiles, and
listen-and-build.

**The Basics book is built** (`content/basics-*.js`): sounds/pinyin, tones,
radicals, everyday words — the previously-deferred tone and radical drills, plus
two more. It's an `aux` + `bookOpen` book (isolated distractor pool, no gating);
see README "Books (modules)" and "Adding to Basics". The subtle part is the
radical `examples` curation rule — an example may contain no *second* drilled
radical, and the tests can only catch part of that.

Simplified-Chinese display is done (`src/lang.js` + generated `src/lang-map.js`, render-time
only; canonical content and progress stay Traditional). **Still never device-tested** — a real
phone playtest is the highest-value untested thing. See the memory for full status.
