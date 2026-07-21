"""Turn a page range of the C101 PDF into a per-section review file for vocab
curation.

For each section it emits, side by side:
  - the ENGLISH C101 paragraphs (ground-truth contextual meaning)
  - the CHINESE paragraphs
  - a candidate word table (word / pinyin / CC-CEDICT gloss / count / VAGUE?)

VAGUE candidates (function words, surname-only, >3 senses, or 1-char) are
flagged so the curator knows to disambiguate the gloss against the English
text rather than trusting the dictionary blindly.

Usage:
  py tools/gen_candidates.py --pdf "<pdf>" --out review/ch01.md \
     --sections "3:NATURE OF MAN" "9:THE CREATION ACCOUNT IN GENESIS" \
                "10:IN THE BEGINNING" "15:ANTICIPATING PARENT" \
                "16:A FORK IN THE ROAD" --end 17
Each --sections entry is  START_PDFPAGE:TITLE ; --end is the last page (incl).
"""
import argparse, re, os
import fitz
from lib_cedict import load_dict, segment

HAN = re.compile(r"[㐀-鿿]")
STOP = set("的了嗎呢吧啊喔哦嘛之其也乃")  # obvious particles to drop from teaching set

def page_split(text):
    """Split a page's text into (english_lines, chinese_lines).
    Chinese line = has >=2 hanzi. Drops running headers/page numbers."""
    en, zh = [], []
    for ln in text.split("\n"):
        s = ln.strip()
        if not s:
            continue
        if re.match(r"^\d+\s*$", s):
            continue
        if "C O U R S E" in s or "C H R I S T I A N" in s:
            continue
        if len(HAN.findall(s)) >= 2:
            zh.append(s)
        elif re.search(r"[A-Za-z]", s):
            en.append(s)
    return en, zh

def vague(word, entry):
    if len(word) == 1:
        return True
    if word in STOP:
        return True
    joined = " ".join(entry["defs"]).lower()
    if joined.startswith("surname") or "variant of" in joined:
        return True
    if len(entry["defs"]) >= 4:
        return True
    return False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sections", nargs="+", required=True)
    ap.add_argument("--end", type=int, required=True)
    a = ap.parse_args()

    dic = load_dict()
    doc = fitz.open(a.pdf)

    secs = []
    for s in a.sections:
        p, title = s.split(":", 1)
        secs.append((int(p), title))
    secs.append((a.end + 1, "__END__"))

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    buf = []
    for idx in range(len(secs) - 1):
        start, title = secs[idx]
        nxt = secs[idx + 1][0]
        en_all, zh_all = [], []
        for pg in range(start, nxt):
            en, zh = page_split(doc[pg - 1].get_text())
            en_all += en
            zh_all += zh
        zh_text = "".join(zh_all)

        # candidates by frequency
        counts, meta = {}, {}
        for word, in_dict in segment(zh_text, dic):
            if not in_dict and len(word) == 1:
                continue
            counts[word] = counts.get(word, 0) + 1
            if word not in meta:
                meta[word] = dic.get(word, [{"py": "?", "defs": ["(not in dict)"]}])[0]

        buf.append(f"# SECTION: {title}  (pdf pp {start}-{nxt-1})\n")
        buf.append("## English (ground truth)\n")
        buf.append(" ".join(en_all) + "\n")
        buf.append("## Chinese\n")
        buf.append("".join(zh_all) + "\n")
        buf.append("## Candidates (word | pinyin | gloss | n | VAGUE)\n")
        for word, n in sorted(counts.items(), key=lambda x: -x[1]):
            e = meta[word]
            flag = "VAGUE" if vague(word, e) else ""
            gloss = "; ".join(e["defs"][:3])
            buf.append(f"{word} | {e['py']} | {gloss} | {n} | {flag}")
        buf.append("\n")

    open(a.out, "w", encoding="utf-8").write("\n".join(buf))
    print("wrote", a.out, "-", len(secs) - 1, "sections")

if __name__ == "__main__":
    main()
