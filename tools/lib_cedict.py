"""Shared CC-CEDICT utilities: load dictionary, convert numbered pinyin to
tone marks, and greedily word-segment Traditional Chinese text.

Used by the content-build workflow (see tools/gen_candidates.py). Pure helper
module, no side effects on import beyond defining functions.
"""
import os, re

CEDICT_PATH = os.path.join(os.path.dirname(__file__), "..", "cedict.txt")

# vowel -> tone-marked forms (tone 1..4, 5=neutral leaves it bare)
_TONE = {
    "a": "āáǎà", "e": "ēéěè", "i": "īíǐì",
    "o": "ōóǒò", "u": "ūúǔù", "u:": "ǖǘǚǜ",
}

def num_to_marks(syl: str) -> str:
    """Convert one numbered pinyin syllable, e.g. 'ren2' -> 'rén', 'lu:3' -> 'lǚ'."""
    m = re.match(r"^([a-zA-Z:]+?)([1-5])?$", syl)
    if not m:
        return syl
    body, tone = m.group(1), m.group(2)
    body = body.replace("u:", "v")  # temp marker
    if not tone or tone == "5":
        return body.replace("v", "ü")
    t = int(tone) - 1
    # tone mark placement: a/e win; else o in 'ou'; else last vowel
    low = body.lower()
    idx = -1
    if "a" in low: idx = low.index("a")
    elif "e" in low: idx = low.index("e")
    elif "ou" in low: idx = low.index("o")
    else:
        for i, ch in enumerate(low):
            if ch in "aeiouv": idx = i
    if idx == -1:
        return body.replace("v", "ü")
    ch = body[idx]
    base = "v" if ch == "v" else ch.lower()
    key = "u:" if base == "v" else base
    marked = _TONE[key][t] if key in _TONE else ch
    return (body[:idx] + marked + body[idx+1:]).replace("v", "ü")

def pinyin_marks(numbered: str) -> str:
    """Convert a space-separated numbered pinyin string to tone marks."""
    return " ".join(num_to_marks(s) for s in numbered.split())

def load_dict():
    """Return dict: traditional-headword -> list of {py, py_num, defs[]}."""
    d = {}
    with open(CEDICT_PATH, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            m = re.match(r"^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+/(.*)/\s*$", line)
            if not m:
                continue
            trad, simp, py, defs = m.groups()
            entry = {
                "py": pinyin_marks(py),
                "py_num": py.lower(),
                "defs": [x for x in defs.split("/") if x],
            }
            d.setdefault(trad, []).append(entry)
    return d

_HAN = re.compile(r"[㐀-鿿]")

def segment(text, dic, max_len=4):
    """Greedy forward maximal-match segmentation over Han runs.
    Returns list of (word, in_dict) tuples, dictionary words only for multi-char;
    single unknown chars are still returned so nothing is lost."""
    out = []
    i, n = 0, len(text)
    while i < n:
        if not _HAN.match(text[i]):
            i += 1
            continue
        matched = None
        for L in range(min(max_len, n - i), 0, -1):
            w = text[i:i+L]
            if w in dic:
                matched = w
                break
        if matched:
            out.append((matched, True))
            i += len(matched)
        else:
            out.append((text[i], False))
            i += 1
    return out
