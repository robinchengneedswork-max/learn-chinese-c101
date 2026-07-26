"""Passage-scoped vocab extractor — the curation aid for "reading coverage".

The goal of a lesson is that a learner can READ the section's curated main-body
passage (the exact text the app shows in "📖 Read the C101 text"). So the vocab
we teach should be every *content* word in that passage — no more, no less.

This tool segments each lesson's `READINGS` passage (from build_content.py),
counts word frequencies, and prints a per-lesson candidate table flagged so
curation is "prune a generated list" rather than "brainstorm words":

  word | pinyin | gloss | count | flags

Flags:
  TAUGHT  — already in the chapter's CHAPTER word list (keep, no work)
  FUNC    — grammatical/function word on the stoplist (usually drop)
  NAME    — proper name of an external figure/place (usually drop)
  1CHAR   — single character (judgment call: 神/光/人 yes, particles no)

Usage:  py tools/extract_passage_vocab.py            # all lessons
        py tools/extract_passage_vocab.py ch01-l1    # one lesson
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib_cedict import load_dict, segment
from build_content import CHAPTER, READINGS

# Pure grammatical/function words we would never put in an SRS deck. Conservative
# on purpose: pedagogically useful connectives (如果, 因為, 雖然, 非常, 甚至) are
# NOT here — they're real vocab. This only catches particles, pronouns, bare
# copulas/adverbs, and structural glue.
FUNC = set("""
的 了 是 在 我 你 他 她 它 我們 你們 他們 這 那 這個 那個 這些 那些 這種 這樣 那麼
就 都 又 也 和 與 或 而 而已 呢 吧 啊 嗎 之 其 乃 便 卻 更 很 最 太 也是 就是 只是
不 沒 沒有 未 要 會 能 可 可以 被 把 讓 給 從 對 向 於 以 為 所 使 並 並不 並非
一 一個 一些 一切 一樣 一般 這裏 這裡 哪裏 哪裡 那裡 那裏 裡 裏 上 下 中 內 外 前 後
有 有著 有些 沒法 無法 不能 不會 不是 不到 不過 只有 只是 還是 還有 就要 就是 才能
這就 由此 因此 所以 然後 然而 但 但是 可是 雖 雖然 即使 既然 無論 不論 於是 至於
自己 自我 本身 某人 某 這位 那位 眾人 人們 大家 別人 他人 其他 其它 任何 每 各
會 可能 應該 應 該 需要 想 想要 覺得 認 為此 如此 這麼 怎麼 怎樣 什麼樣 為什麼 哪
到 去 來 出 進 回 起 過 著 得 地 很多 許多 一直 已經 正在 曾 曾經 剛 才 再 還
非 即 則 故 且 亦 皆 凡 若 倘 設 令 使得 因 由 據 按 依 隨 隨著 沿 朝 往 離
可以 還是 還有 由此 這就 以外 不僅 一個人 只有 就要 世上 之外 之上 上述 眾多 往往
並不 不在 應 該 及其 起 開始 罷了 而是 為主 之類 等等 以上 以下 之類 及 便是 主旨
""".split())

# Proper names of external figures / places used only as examples — not vocab.
NAMES = set("""
道金斯 理查 理查德 羅素 伯特蘭 爾 金 斯 克 凱 郭 克爾凱郭爾 莎士比亞 馬克 馬克白
白 丹麥 希伯來 哥林多 以弗所 路加福音 莎 士 比 亞
""".split())

# Single chars we DO teach when topically important (whitelist against 1CHAR noise).
KEEP_1CHAR = set("神 光 人 好 愛 罪 主 死 生".split())


def taught_set():
    return {hz for l in CHAPTER["lessons"] for (hz, _en, _o) in l["words"]}


def flags_for(word, taught, dic):
    fl = []
    if word in taught:
        fl.append("TAUGHT")
    if word in FUNC:
        fl.append("FUNC")
    if word in NAMES:
        fl.append("NAME")
    if len(word) == 1 and word not in KEEP_1CHAR:
        fl.append("1CHAR")
    e = dic.get(word)
    if e and (" ".join(e[0]["defs"]).lower().startswith("surname")):
        fl.append("NAME")
    return fl


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    dic = load_dict()
    taught = taught_set()

    for lesson in CHAPTER["lessons"]:
        lid = lesson["id"]
        if only and lid != only:
            continue
        r = READINGS.get(lid)
        if not r:
            print(f"\n# {lid} — no READINGS passage; skipping\n")
            continue
        zh = "".join(r["zh"])
        counts, meta = {}, {}
        for word, in_dict in segment(zh, dic):
            if len(word) == 1 and not in_dict:
                continue
            counts[word] = counts.get(word, 0) + 1
            if word not in meta:
                meta[word] = dic.get(word, [{"py": "?", "defs": ["(not in dict)"]}])[0]

        rows = sorted(counts.items(), key=lambda x: -x[1])
        # "content" = not flagged FUNC/NAME/1CHAR (the likely teaching set)
        content = [(w, n) for w, n in rows
                   if not (set(flags_for(w, taught, dic)) & {"FUNC", "NAME", "1CHAR"})]
        n_taught = sum(1 for w, _ in content if w in taught)
        print(f"\n{'='*70}")
        print(f"# {lid}  {lesson['title']}  ({lesson['zh']})")
        print(f"#   passage: {len(zh)} chars | content words: {len(content)} "
              f"| already taught: {n_taught} | NEW to add: {len(content) - n_taught}")
        print(f"{'='*70}")
        for word, n in rows:
            fl = flags_for(word, taught, dic)
            e = meta[word]
            gloss = "; ".join(e["defs"][:2])
            tag = " ".join(fl)
            print(f"{word}\t{e['py']}\t{n}\t{tag}\t{gloss}")


if __name__ == "__main__":
    main()
