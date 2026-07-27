// pinyin.js — tone arithmetic on tone-marked pinyin. Pure string work, no DOM,
// no state; the Basics tone drills are built on it (session.js) and the options
// are rendered from it (ui.js).
//
// Content stores pinyin the way the book prints it — tone marks, space-separated
// syllables ("shēng mìng"). This module reads the tone off a syllable, strips it,
// and puts it back, so a drill can offer "mā / má / mǎ / mà" for a word whose
// content entry only ever spelled one of them.
//
// Tone numbers follow the usual convention: 1 high, 2 rising, 3 dipping,
// 4 falling, 5 neutral (no mark).
'use strict';

const Pinyin = (function () {
  // Combining diacritics, as produced by NFD decomposition.
  const MARKS = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
  const MARK_OF = { 1: '̄', 2: '́', 3: '̌', 4: '̀', 5: '' };

  const NAMES = {
    1: 'high, flat', 2: 'rising', 3: 'dipping', 4: 'falling', 5: 'neutral (no mark)'
  };

  // Split a pinyin string into syllables. Content separates them with spaces;
  // hyphens and apostrophes (xī'ān) count as separators too.
  function syllables(pinyin) {
    return String(pinyin || '').trim().split(/[\s\-']+/).filter(Boolean);
  }

  // The tone of ONE syllable: 1-4 if it carries a mark, 5 (neutral) if not.
  // Note ü (u + combining diaeresis) is not a tone mark, so it passes through —
  // and ǚ decomposes to u + diaeresis + caron, which still reads as tone 3.
  function toneOf(syllable) {
    const d = String(syllable || '').normalize('NFD');
    for (const ch of d) if (MARKS[ch]) return MARKS[ch];
    return 5;
  }

  // Drop the tone mark, keeping ü intact: "mǎ" -> "ma", "lǜ" -> "lü".
  function strip(syllable) {
    return String(syllable || '').normalize('NFD')
      .replace(/[̄́̌̀]/g, '')
      .normalize('NFC');
  }

  // Where the tone mark goes, by the standard rule: on a/o/e if present;
  // otherwise on the LAST vowel (so "iu" marks the u, "ui" marks the i).
  function markIndex(base) {
    const s = base.toLowerCase();
    for (const v of ['a', 'o', 'e']) {
      const i = s.indexOf(v);
      if (i >= 0) return i;
    }
    for (let i = s.length - 1; i >= 0; i--) if ('iuü'.indexOf(s[i]) >= 0) return i;
    return -1;
  }

  // Put a tone back on a toneless syllable: withTone('ma', 3) -> 'mǎ'.
  // Tone 5 (and any syllable with no vowel to mark) comes back unchanged.
  function withTone(base, tone) {
    const b = strip(base);
    const mark = MARK_OF[tone];
    if (!mark) return b;
    const i = markIndex(b);
    if (i < 0) return b;
    return (b.slice(0, i) + b[i] + mark + b.slice(i + 1)).normalize('NFC');
  }

  // The tone of every syllable: "shēng mìng" -> [1, 4].
  function tones(pinyin) { return syllables(pinyin).map(toneOf); }

  // A word's tone pattern as a compact key: "shēng mìng" -> "1-4". This is what
  // a tone drill grades against, so it must be derived the same way everywhere.
  function pattern(pinyin) { return tones(pinyin).join('-'); }

  // Render a pattern back onto a word's syllables, for showing an option:
  // spell(['sheng','ming'], '2-4') -> "shéng mìng".
  function spell(bases, pat) {
    const ts = String(pat || '').split('-');
    return bases.map((b, i) => withTone(b, Number(ts[i]) || 5)).join(' ');
  }

  function toneName(n) { return NAMES[n] || NAMES[5]; }

  return { syllables, toneOf, strip, withTone, tones, pattern, spell, toneName };
})();

if (typeof window !== 'undefined') window.Pinyin = Pinyin;
