// lang.js — display language / script selector. The canonical content script is
// Traditional Chinese (the book's script); this converts Chinese text to the
// chosen script AT RENDER TIME ONLY. Progress (keyed by Traditional hanzi),
// answer grading, and content data all stay canonical — switching script never
// touches saved progress. Load AFTER src/lang-map.js (it reads window.C101_LANGMAP).
'use strict';

const Lang = (function () {
  const KEY = 'c101.lang.v1';
  const MAP = window.C101_LANGMAP || {};

  // Convert a Traditional string to Simplified, char by char (identity for any
  // char not in the map). Han range only; ASCII/pinyin/punctuation pass through.
  const toSimp = (s) => s.replace(/[㐀-鿿]/g, (c) => MAP[c] || c);

  // The selector's options. Extensible: add future languages/scripts here and
  // the top-left picker + everything downstream pick them up automatically.
  // `convert` maps canonical (Traditional) text to this option; omit it for the
  // canonical source itself. `tts` is the SpeechSynthesis BCP-47 tag.
  const LANGS = [
    { id: 'trad', label: '繁',  name: '繁體中文',   tts: 'zh-TW' },
    { id: 'simp', label: '简',  name: '简体中文',   tts: 'zh-CN', convert: toSimp }
  ];

  let current = pick(read());

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function pick(id) { return LANGS.find((l) => l.id === id) || LANGS[0]; }

  function set(id) {
    const l = LANGS.find((x) => x.id === id);
    if (!l) return false;
    current = l;
    try { localStorage.setItem(KEY, id); } catch (e) { /* best-effort */ }
    return true;
  }

  // Convert a Chinese string to the active script. Safe on any string (English
  // and pinyin have no Han chars, so they pass through unchanged).
  function zh(text) {
    if (text == null || !current.convert) return text;
    return current.convert(String(text));
  }

  return {
    zh,
    langs: () => LANGS,
    current: () => current,
    set,
    tts: () => current.tts
  };
})();

window.Lang = Lang;
