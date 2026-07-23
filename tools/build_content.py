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
import json, os, re, sys
from lib_cedict import load_dict

# review/chNN.md is the aligned English+Chinese review file (see gen_candidates.py).
# Its per-SECTION "## Chinese" / "## English (ground truth)" blocks are the real
# book passages; we attach them to each lesson (in order) as `reading` so the app
# can show the authentic C101 text for reading practice.
REVIEW = os.path.join(os.path.dirname(__file__), "..", "review", "ch01.md")


def load_readings(path):
    """Parse a review file into an ordered list of {en, zh} passages, one per
    SECTION. Sections align 1:1 (in order) with the chapter's lessons."""
    if not os.path.exists(path):
        print("WARNING: review file not found, skipping passages:", path, file=sys.stderr)
        return []
    text = open(path, encoding="utf-8").read()
    blocks = re.split(r"^# SECTION:.*$", text, flags=re.M)[1:]  # drop preamble
    out = []
    for b in blocks:
        en = _between(b, r"## English \(ground truth\)", r"## Chinese")
        zh = _between(b, r"## Chinese", r"## Candidates")
        out.append({"en": en, "zh": zh})
    return out


def _between(block, start_pat, end_pat):
    m = re.search(start_pat + r"(.*?)" + end_pat, block, flags=re.S)
    return m.group(1).strip() if m else ""

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

# Curated "main body" reading passages — the book's own expository prose for each
# section, with scripture block-quotes, long external quotations (Russell, C.S.
# Lewis, Craig...), discussion questions, footnotes/endnotes, cross-references and
# page-header artifacts removed. Kept runs are verbatim from the parallel book text
# (review/ch01.md). zh/en are lists of paragraphs (joined with a blank line). When
# a lesson isn't listed here, the build falls back to the raw review passage.
READINGS = {
    "ch01-l1": {
        "zh": [
            "人生多問。一個人可以衣食無憂，卻依然為人生更大的問題所困擾：我是誰？我在這裏做什麼？我從哪裏來？我的人生目的是什麼?這些不僅僅是學術問題。因為這些問題的答案會深深影響你的人生觀、價值觀以及對人生意義的追求。探討人生的問題離不開討論人性的本質。我僅僅是一個複雜的生物機器，還是一個有靈魂、有靈性的生命？",
            "道金斯和羅素所持的觀點(也是眾多人所持的觀點)又被稱為「自然論」，其主旨便是世上之物皆由物質組成。這種看法也被稱為「科學論」，因為它往往會用科學來聲張科學本身無法驗證的真理。如果世上之物都由物質組成，由此推論，我們僅是一團會動的肉體罷了。那麼一切超越肉體的自我意識便都是幻想。根據自然論，「我們」就只有肉體。這是真的？",
            "上述故事裡的富翁認為他的「靈魂」應該飽足於「食物」上，或許人生最大樂趣莫過於大吃大喝、痛苦最少、快樂最多。那麼，肉身之外還有更多，滿足食慾之上更有真實、超然的價值，難道這種想法不切實際嗎？的確，如果我們僅有肉身，那麼身外的東西自然都是幻覺。但敍述此故事的耶穌說：人的生命並不在於家道豐富。如果不在物質的豐富，那生命在於什麼呢？",
            "顯然，這種看待人類的觀點很荒唐。但是，在無神、純自然的世界觀裡，又很難找到更好的答案。這種觀點其實非常的武斷，聲稱科學真理以外便無真理，將這個不理性的觀點強加於現今社會。這種暗淡的觀點不僅剝奪了生命中所有的色彩，它更在毫無憑據的基礎上建立了一個巨大的主張。自然論阻止了深層的思考，它也在我們回答人生最基本的問題上限制了我們的思維。從宏觀角度來看，若要探尋人性的本質、價值及其意義，就要從人類的起源開始。",
        ],
        "en": [
            "Man asks questions. A person can have all the creature comforts met, and yet find himself disturbed by the larger questions of life: Who am I? What am I here for? Where did I come from, and what is my ultimate destiny? These are not just academic issues. A lot hinges on your answers to these questions—how you choose to live, what you value, and what purposes drive you. At the core of the question of life is the issue of the nature of man. Am I a complex biological machine and no more, or am I a spiritual being with a soul?",
            "The view espoused by Dawkins and Russell (and generally embraced in our world), also known as “naturalism,” says that all of reality is composed of the physical. This view is also called “scientism” because it tends to claim truths for science that are not themselves verifiable by science. If all of reality is physical, then it follows that we are no more than animated flesh. Any sense of self we may have that transcends our bodies is illusory. Quite literally, “we” are just our bodies, according to naturalism. Is this right?",
            "The rich man in the story thought his “soul” fed on “grain,” as if the highest good for man were to feed the appetites, to minimize pain and maximize pleasure. So, is the notion that we are more than our bodies, that there are real, transcendent values beyond satisfying our appetites, just unreal fluff? It must be, if who we are is just bodies. But Jesus says that “one’s life does not consist in the abundance of his possessions.” If not possessions, then what is life about?",
            "Obviously, this is an absurd view of man. Yet, better answers seem hard to find under an atheistic, naturalistic worldview. This view is entirely arbitrary, claiming there is no truth other than scientific truth. In addition to being a bleak view that strips life of all its color, it makes a huge claim that is simply asserted without evidence. Naturalism stifles deeper thinking in that it artificially reduces what we are allowed to consider in answering the most fundamental of questions. For a grander perspective, we need to start with the question of origin.",
        ],
    },
    "ch01-l2": {
        "zh": [
            "如果我們是神創造的，那麼以創世記的故事之外來定位自己必定是毫無結果的。此外，如果神有靈性，那麼他在創造我們肉體的同時，也會附上「靈魂的飢渴」，而這種饑渴無法用食物或享樂來滿足。《聖經》告訴我們，神把「永恆的意識放在人的心裡」。換句話說，《聖經》宣稱我們永遠不能從這世界中短暫的成就裡得到充分的滿足，因為我們是被神創造的，有永恆的靈魂，嚮往著一種遠遠超越單純存活的精神。",
        ],
        "en": [
            "If we have been created by God, it would follow that our attempt to locate ourselves apart from the larger story of creation is bound to be unfruitful. Further, if God, himself a spiritual being, made us to be more than our bodies, then it follows that we would have such a thing as “spiritual longings” which no amount of food or pleasures can satisfy. The Bible identifies the reason for this longing: God has “put eternity into man’s heart.” In other words, we can never be fully at peace with only the physical, because we have been created by God with eternal souls, which long for something much more than a mere biological existence.",
        ],
    },
    "ch01-l3": {
        "zh": [
            "假如某人讀完一本化學實驗手冊，然後大聲抱怨說：「這本書太爛了，一點故事情節都沒有！」那只能說他誤解了這本手冊的原意。實驗手冊只解釋實驗過程，並不講述人物或描寫故事情節。想從實驗手冊中看人講故事實在是強人所難。許多人讀創世記也跟看實驗手冊一樣，總想從中尋找本不存在的答案。創世記不關心「如何」的問題，而只專注於回答「為什麼」和「誰」相關的神學問題。比如，宇宙為什麼是真實存在的而不是虛無的？誰創造了宇宙？人是誰，他與創造者的關係是什麼？",
            "請注意《聖經》沒有刻意說服讀者神的存在。從書的開始章節，《聖經》就宣稱了神的活動。我們把關於宇宙起源的辯論放到一邊，《聖經》清楚明白地說明了萬物是在神的主導下被創造出來的。",
            "《聖經》用了一個很特殊的希伯來語動詞來描述神造人的過程。我們仿佛看見神停頓了一下，做了個深呼吸，深思熟慮地把人造出來。其他的動物都是按照動物本身的模樣創造的，「各從其類」，而《聖經》說「神照著自己的形象創造人」，以及神「把生氣吹進」我們的身體。這說明人與神的關係非常特別。按《聖經》的說法，這個特別的關係意味著我們不僅有肉體，還有靈性。",
        ],
        "en": [
            "Imagine a person, upon reading a chemistry lab manual, exclaiming in exasperation, “This book has no plot!” Such a person is misunderstanding the genre of what he is reading. A lab manual is not interested in character or plot development; it is only meant to describe how to run experiments. Many read the creation account in Genesis as one would read a lab manual, demanding from it answers Genesis is not interested in providing. Genesis is concerned not with the question of “how” but with the theological narrative of God’s creation—“why” and “who”: why is there something rather than nothing? Who created this universe? Who is man, and what is his relationship to the Creator?",
            "Note that the Bible does not attempt to persuade the reader of the existence of God. Rather, from its very first pages, the Bible declares the activity of God. All of the arguments regarding the origin of the universe aside, the Bible simply states that everything has its being in the sovereign creation of God.",
            "A special Hebrew verb is used in the creation account when God creates man. We see God taking a pause, almost taking a deep breath, deliberating, and “forming” man. The other animals were created “according to their kinds,” but the Bible declares that “God created man in his own image” and that God “breathed…the breath of life” into us, highlighting the special relationship between mankind and God. Part of the reason for this special relationship is that we are spiritual, and not merely physical, creatures.",
        ],
    },
    "ch01-l4": {
        "zh": [
            "創世記提到，神每造一物都會說「好」，最後把人造出來時，甚至還說「非常好。」這個「好」的依據是什麼？等待小寶寶降生的父母親一般不會措手不及。寶寶降生之前，他們會準備一些東西。比如把房間裝飾成柔和的顏色，在牆上畫上火車和雲朵。裝上嬰兒床，並放好軟墊。你能想像到，每做完一件事，這對父母親都會後退一步，看著他們準備好了的東西，說：「這個好。」神在眾生心中有諸多不同的形象：孤傲且不近人情的神；強勢且不怒自威的神；或者老邁又神志不清的老爺爺。",
        ],
        "en": [
            "Genesis reports that God repeatedly declares creation as good, and finally, with man in place, “very good.” What is the basis of this “goodness”? Parents expecting the arrival of a newborn don’t get caught off guard. Before the arrival of the baby, they set up the room. They decorate it with pastel baby colors and line the walls with pictures of trains and clouds. They assemble a crib and pad it with cushion. At each stage, you can imagine the parents stepping back, looking at what they prepared and saying, “This is good.” There are many different perceptions about God: an aloof figure sitting at a distance, a powerful and vindictive force that should be avoided, perhaps an irrelevant and senile grandfather.",
        ],
    },
    "ch01-l5": {
        "zh": [
            "恰恰相反，《聖經》從第一頁起所描述的神與上面這些形象完全不同。神是一位慈愛的父親，把所造的人放在預先準備好的環境裡面，並「保佑人們」，還「賜福予人」，還說他所造的「非常好！」雄偉的高山，廣袤的原野，奔騰的河流，蔥郁的樹木，已經預先準備好以迎接人類，而人類又是唯一能夠欣賞大自然美景的生物。神造萬物，人為王冠。人類分享著神的本性，被賦予了用愛和智慧來管理這個世界的職務。這是創世記所表達的信息。",
            "回到本課程開頭提出的問題：「生命是什麼？」這個問題的答案與神息息相關。如果神不存在，我們就該理解並接受這個結論所帶來的後果。這個後果就是拒絕一切價值、意義、甚至愛的概念，並接受我們的生命就是毫無意義。",
            "但是，如果《聖經》所說是真的，創造了萬物的神是一個慈愛的天父，那我們就不單純是一群分子堆積物，我們擁有的遠比肉體更多。我們追求比生命更高的渴望不會徒勞，因為這本就是源自于我們超越自然的本質。雖然某些人認為基督信仰是種「盲目的信仰」，但現實情況是有很多證據可以説明基督教所宣揚真理的可信性。本課程的目的就是介紹基督教的信仰根基。不論你是信徒還是探求者，在接下來的幾個星期，讓我們一起來探討基督福音。",
        ],
        "en": [
            "Contrary to such views, the portrait of God revealed in the very first pages of the Bible is that of a loving Father, who places man into an environment prepared for him. God “blesses” and “gives” and pronounces that creation is “very good.” The majestic mountains, the pristine beauty of the meadows, the rivers, the trees, were all prepared for mankind, who uniquely among creatures is endowed with the strange propensity to find nature transcendently beautiful. Man was the crown of all of God’s creation, sharing His nature, and meant to rule over it with love and wisdom. This is the message of Genesis.",
            "Let’s consider once again the question we started with: “What is life?” The answer is integrally linked with the question about God. If it really is the case that there is no God, then we ought to be clear about the consequences and accept them—which would mean we reject notions of value and meaning and align our lives with the belief that life is ultimately meaningless.",
            "On the other hand, if the Bible is true in its claim that the God who created us is a loving heavenly Father, that means we are more than mere molecules. We are more than our bodies. Our longing for something higher is not a futile desire, but arises out of the very core of who we are as transcendent beings. This course aims to lay out the foundations of Christianity. Whether you’re a believer or just seeking answers, let’s consider together the claims of the Christian gospel through the next few weeks.",
        ],
    },
}


def main():
    dic = load_dict()
    readings = load_readings(REVIEW)
    missing = []
    out_lessons = []
    for li, lesson in enumerate(CHAPTER["lessons"]):
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
        out = {
            "id": lesson["id"], "title": lesson["title"],
            "zh": lesson["zh"], "words": words,
        }
        # Attach the section's book passage: prefer the curated "main body" text,
        # else fall back to the raw review passage (aligned by order). Paragraph
        # lists are joined with a blank line for the app to render as paragraphs.
        reading = READINGS.get(lesson["id"])
        if reading:
            reading = {"zh": "\n\n".join(reading["zh"]),
                       "en": "\n\n".join(reading.get("en", []))}
        elif li < len(readings) and readings[li]["zh"]:
            reading = readings[li]
        if reading and reading.get("zh"):
            out["reading"] = reading
        out_lessons.append(out)

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
    r = sum(1 for l in out_lessons if l.get("reading"))
    print("wrote", out, "-", len(out_lessons), "lessons,", n, "words,",
          len(sentences), "test sentences,", r, "reading passages")

if __name__ == "__main__":
    main()
