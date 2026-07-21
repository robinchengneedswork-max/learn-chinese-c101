"""Build a chapter's content JS file from a hand-curated word list.

Pinyin is pulled from CC-CEDICT (authoritative tone marks) so we never rely on
hand-typed diacritics. English glosses are curated to match how the C101 book
actually uses the word (disambiguated against the parallel English text — see
review/ch01.md). A word may override the dictionary reading via a 3rd element
when CC-CEDICT's first entry is the wrong reading (e.g. 東西 dōngxi, not dōng xī).

Output: content/chapter-01.js  (registers into window.C101 — no fetch needed,
works on file:// and on Vercel alike).

Edit CURATED below, then:  py tools/build_content.py
"""
import json, os, sys
from lib_cedict import load_dict

# (hanzi, english gloss, optional pinyin override)
CHAPTER = {
    "id": "ch01",
    "title": "Chapter 1 — What Is Life?",
    "zh": "第一章：生命的意義",
    "lessons": [
        {
            "id": "ch01-l1", "title": "Nature of Man", "zh": "人的本質",
            "words": [
                ("生命", "life (of a living being)", None),
                ("意義", "meaning; significance", None),
                ("人生", "(human) life; one's life", None),
                ("人性", "human nature", None),
                ("本質", "essence; nature", None),
                ("靈魂", "soul", None),
                ("肉體", "physical body; flesh", None),
                ("問題", "question; problem", None),
                ("答案", "answer", None),
                ("如果", "if", None),
                ("因為", "because", None),
                ("什麼", "what", None),
            ],
        },
        {
            "id": "ch01-l2", "title": "The Creation Account", "zh": "創世記",
            "words": [
                ("創造", "to create", None),
                ("創造者", "creator", None),
                ("宇宙", "universe; cosmos", None),
                ("起源", "origin", None),
                ("聖經", "the Bible; scripture", None),
                ("永恆", "eternal; eternity", None),
                ("渴望", "to long for; longing", None),
                ("滿足", "to satisfy; satisfied", None),
                ("世界", "world", None),
                ("存在", "to exist; existence", None),
                ("超越", "to transcend; to surpass", None),
                ("精神", "spirit; mind", None),
            ],
        },
        {
            "id": "ch01-l3", "title": "In the Beginning", "zh": "太始之初",
            "words": [
                ("光", "light", "guāng"),
                ("黑暗", "darkness", None),
                ("早晨", "morning", None),
                ("晚上", "evening; night", None),
                ("動物", "animal", None),
                ("生物", "living creature; organism", None),
                ("形象", "image; likeness", None),
                ("關係", "relationship", "guān xì"),
                ("各種", "every kind of; various", None),
                ("創世記", "Genesis (book of the Bible)", None),
                ("實驗", "experiment", None),
                ("重複", "to repeat; repeated", "chóng fù"),
            ],
        },
        {
            "id": "ch01-l4", "title": "Anticipating Parent", "zh": "滿懷期待的父母",
            "words": [
                ("父母", "parents", None),
                ("期待", "to look forward to; anticipation", None),
                ("準備", "to prepare", None),
                ("寶寶", "baby", None),
                ("描述", "to describe", None),
                ("依據", "basis; according to", None),
                ("按照", "according to; in accordance with", None),
                ("心意", "intention; heart's desire", None),
                ("非常", "very; extremely", None),
                ("甚至", "even; to the point that", None),
                ("認為", "to think; to consider", None),
                ("東西", "thing(s)", "dōng xi"),
            ],
        },
        {
            "id": "ch01-l5", "title": "A Fork in the Road", "zh": "人生的十字路口",
            "words": [
                ("慈愛", "loving; loving-kindness", None),
                ("父親", "father", None),
                ("智慧", "wisdom", None),
                ("管理", "to manage; to rule over", None),
                ("大自然", "nature (the natural world)", None),
                ("萬物", "all things", None),
                ("信仰", "faith; belief", None),
                ("基督教", "Christianity", None),
                ("證據", "evidence", None),
                ("課程", "course; curriculum", None),
                ("拒絕", "to reject; to refuse", None),
                ("價值", "value; worth", None),
            ],
        },
    ],
    # Fill-in-the-blank sentences for the chapter test. "blank" is a chapter word
    # that appears verbatim in "zh"; it is removed and the learner supplies it.
    # Curated from the book's parallel text (see review/ch01.md); short and clear.
    "sentences": [
        {"zh": "人生的意義是什麼？",       "en": "What is the meaning of life?",             "blank": "意義"},
        {"zh": "我是一個有靈魂的生命。",     "en": "I am a living being with a soul.",          "blank": "靈魂"},
        {"zh": "這些問題的答案很重要。",     "en": "The answers to these questions matter.",    "blank": "答案"},
        {"zh": "神創造了宇宙。",           "en": "God created the universe.",                 "blank": "創造"},
        {"zh": "《聖經》告訴我們世界的起源。", "en": "The Bible tells us the origin of the world.", "blank": "起源"},
        {"zh": "人心渴望永恆。",           "en": "The human heart longs for eternity.",       "blank": "永恆"},
        {"zh": "神說要有光。",             "en": "God said, “let there be light.”",  "blank": "光"},
        {"zh": "神照著自己的形象造人。",     "en": "God made man in his own image.",            "blank": "形象"},
        {"zh": "《創世記》記載了各種動物。",   "en": "Genesis records every kind of animal.",     "blank": "動物"},
        {"zh": "父母期待寶寶的出生。",       "en": "The parents look forward to the baby's birth.", "blank": "期待"},
        {"zh": "他們為寶寶準備了很多東西。",   "en": "They prepared many things for the baby.",   "blank": "準備"},
        {"zh": "慈愛的父親有智慧。",         "en": "The loving father has wisdom.",             "blank": "智慧"},
        {"zh": "神讓人管理大自然的萬物。",     "en": "God lets man rule over all things in nature.", "blank": "管理"},
        {"zh": "這門課程講述基督教信仰。",     "en": "This course teaches the Christian faith.",  "blank": "信仰"},
    ],
}

def main():
    dic = load_dict()
    missing = []
    out_lessons = []
    for lesson in CHAPTER["lessons"]:
        words = []
        for hanzi, en, override in lesson["words"]:
            if override:
                py = override
            else:
                entry = dic.get(hanzi)
                if not entry:
                    missing.append(hanzi)
                    py = "?"
                else:
                    py = entry[0]["py"]
            words.append({"hanzi": hanzi, "pinyin": py, "en": en})
        out_lessons.append({
            "id": lesson["id"], "title": lesson["title"],
            "zh": lesson["zh"], "words": words,
        })

    if missing:
        print("WARNING: not in CC-CEDICT (check hanzi):", missing, file=sys.stderr)

    # Validate chapter-test cloze sentences: each blank must be a chapter word
    # and must appear verbatim in its sentence, or the blank can't be rendered.
    known = {hanzi for l in CHAPTER["lessons"] for (hanzi, _en, _o) in l["words"]}
    sentences = []
    for s in CHAPTER.get("sentences", []):
        blank = s["blank"]
        if blank not in known:
            print("ERROR: cloze blank not a chapter word:", blank, file=sys.stderr); sys.exit(1)
        if blank not in s["zh"]:
            print("ERROR: cloze blank not found in sentence:", blank, "/", s["zh"],
                  file=sys.stderr); sys.exit(1)
        sentences.append({"zh": s["zh"], "en": s["en"], "blank": blank})

    data = {"id": CHAPTER["id"], "title": CHAPTER["title"],
            "zh": CHAPTER["zh"], "lessons": out_lessons, "sentences": sentences}
    js = ("// AUTO-GENERATED by tools/build_content.py — do not edit by hand.\n"
          "// Pinyin from CC-CEDICT; glosses curated against the C101 English text.\n"
          "window.C101.register(\n"
          + json.dumps(data, ensure_ascii=False, indent=2)
          + "\n);\n")

    out = os.path.join(os.path.dirname(__file__), "..", "content", "chapter-01.js")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(js)
    n = sum(len(l["words"]) for l in out_lessons)
    print("wrote", out, "-", len(out_lessons), "lessons,", n, "words,",
          len(sentences), "test sentences")

if __name__ == "__main__":
    main()
