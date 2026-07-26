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
from lib_cedict import load_dict, segment

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


def tokenize(zh, dic):
    """Word-segment a sentence into tiles for the sentence-building exercise.

    Punctuation is dropped (the learner assembles words, not commas), so the
    app grades by joining tiles and comparing against the same joined form.
    """
    return [w for (w, _in_dict) in segment(zh, dic)]

# Per-section sentence practice (the "✍️ Sentences" node after each section's
# Reading node). Keyed by lesson id; each item blanks ONE word that section
# teaches. Rules enforced by the build: `blank` must be a word of THAT lesson and
# must appear EXACTLY ONCE in `zh` (two occurrences would render two blanks).
# Sentences reuse already-taught vocabulary as context wherever possible.
LESSON_SENTENCES = {
    "ch01-l1a": [
        {"zh": "這些問題困擾著很多人。", "en": "These questions trouble many people.", "blank": "困擾"},
        {"zh": "我們要探討人性的本質。", "en": "We must explore the nature of man.", "blank": "探討"},
        {"zh": "人是一個複雜的生物。", "en": "Man is a complex living creature.", "blank": "複雜"},
        {"zh": "我的人生目的是什麼？", "en": "What is the purpose of my life?", "blank": "目的"},
    ],
    "ch01-l1b": [
        {"zh": "這種觀點被稱為自然論。", "en": "This view is called naturalism.", "blank": "稱為"},
        {"zh": "世上之物都由物質組成。", "en": "Everything in the world is composed of matter.", "blank": "組成"},
        {"zh": "科學無法驗證這個真理。", "en": "Science cannot verify this truth.", "blank": "驗證"},
        {"zh": "這只是一個幻想。", "en": "This is only an illusion.", "blank": "幻想"},
    ],
    "ch01-l1c": [
        {"zh": "這個故事裡有一個富翁。", "en": "There is a rich man in this story.", "blank": "富翁"},
        {"zh": "他認為快樂最重要。", "en": "He thinks happiness matters most.", "blank": "認為"},
        {"zh": "人的生命不在於家道豐富。", "en": "One's life does not consist in abundant possessions.", "blank": "豐富"},
        {"zh": "耶穌講了這個故事。", "en": "Jesus told this story.", "blank": "耶穌"},
    ],
    "ch01-l1d": [
        {"zh": "這種看待人類的觀點很荒唐。", "en": "This way of viewing mankind is absurd.", "blank": "荒唐"},
        {"zh": "我們很難找到更好的答案。", "en": "It is hard for us to find a better answer.", "blank": "找到"},
        {"zh": "這個觀點非常武斷。", "en": "This view is extremely arbitrary.", "blank": "武斷"},
        {"zh": "這是一種無神的世界觀。", "en": "This is a godless worldview.", "blank": "世界觀"},
    ],
    "ch01-l1e": [
        {"zh": "這種暗淡的觀點剝奪了生命的色彩。", "en": "This bleak view strips life of its color.", "blank": "剝奪"},
        {"zh": "這個主張毫無憑據。", "en": "This claim has no evidence at all.", "blank": "憑據"},
        {"zh": "自然論阻止了深層的思考。", "en": "Naturalism stifles deeper thinking.", "blank": "阻止"},
        {"zh": "我們要從宏觀的角度來看。", "en": "We need to look at it from a grander perspective.", "blank": "角度"},
    ],
    "ch01-l2a": [
        {"zh": "我們是神創造的。", "en": "We were created by God.", "blank": "創造"},
        {"zh": "食物無法滿足靈魂的飢渴。", "en": "Food cannot satisfy the soul's hunger.", "blank": "飢渴"},
        {"zh": "這樣做必定沒有結果。", "en": "Doing so is bound to be fruitless.", "blank": "必定"},
        {"zh": "人心渴望永恆。", "en": "The human heart longs for eternity.", "blank": "渴望"},
    ],
    "ch01-l2b": [
        {"zh": "《聖經》告訴我們真理。", "en": "The Bible tells us the truth.", "blank": "告訴"},
        {"zh": "神把永恆放在人的心裡。", "en": "God put eternity into man's heart.", "blank": "永恆"},
        {"zh": "世界的成就是短暫的。", "en": "The world's achievements are fleeting.", "blank": "短暫"},
        {"zh": "我們嚮往超越存活的精神。", "en": "We yearn for a spirit beyond mere survival.", "blank": "嚮往"},
    ],
    "ch01-l3a": [
        {"zh": "這本化學實驗手冊沒有故事情節。", "en": "This chemistry lab manual has no plot.", "blank": "情節"},
        {"zh": "他誤解了這本手冊。", "en": "He misunderstood this manual.", "blank": "誤解"},
        {"zh": "誰創造了宇宙？", "en": "Who created the universe?", "blank": "宇宙"},
        {"zh": "人與創造者的關係是什麼？", "en": "What is man's relationship to the Creator?", "blank": "關係"},
    ],
    "ch01-l3b": [
        {"zh": "《聖經》沒有刻意說服讀者。", "en": "The Bible does not try to persuade the reader.", "blank": "說服"},
        {"zh": "這是關於宇宙起源的辯論。", "en": "This is the debate about the origin of the universe.", "blank": "起源"},
        {"zh": "《聖經》清楚地說明了這件事。", "en": "The Bible states this clearly.", "blank": "清楚"},
        {"zh": "萬物是在神的主導下被創造的。", "en": "All things were created under God's sovereignty.", "blank": "主導"},
    ],
    "ch01-l3c": [
        {"zh": "神照著自己的形象創造人。", "en": "God created man in his own image.", "blank": "形象"},
        {"zh": "《聖經》用了一個特殊的動詞。", "en": "The Bible uses a special verb.", "blank": "動詞"},
        {"zh": "動物是按照本身的模樣被創造的。", "en": "The animals were created according to their own kinds.", "blank": "模樣"},
        {"zh": "這個特別的關係意味著我們有靈性。", "en": "This special relationship means we are spiritual.", "blank": "意味著"},
    ],
    "ch01-l3d": [
        {"zh": "起初，神創造天地。", "en": "In the beginning, God created the heavens and the earth.", "blank": "天地"},
        {"zh": "神說：「要有光！」", "en": "God said, “Let there be light!”", "blank": "光"},
        {"zh": "深淵上一片黑暗。", "en": "Darkness was over the face of the deep.", "blank": "黑暗"},
        {"zh": "有晚上，有早晨。", "en": "There was evening, and there was morning.", "blank": "早晨"},
        {"zh": "神創造了各種生物。", "en": "God created every kind of living creature.", "blank": "各種"},
    ],
    "ch01-l4a": [
        {"zh": "父母期待寶寶的降生。", "en": "The parents look forward to the baby's birth.", "blank": "降生"},
        {"zh": "他們準備好了房間。", "en": "They got the room ready.", "blank": "房間"},
        {"zh": "他們把房間裝飾成柔和的顏色。", "en": "They decorated the room in soft colors.", "blank": "裝飾"},
        {"zh": "神說這非常好。", "en": "God said this was very good.", "blank": "非常"},
    ],
    "ch01-l4b": [
        {"zh": "神在眾生心中有諸多不同的形象。", "en": "People hold many different images of God.", "blank": "諸多"},
        {"zh": "有人認為神是孤傲的。", "en": "Some think God is aloof.", "blank": "孤傲"},
        {"zh": "有人認為神像老邁的爺爺。", "en": "Some think God is like a senile grandfather.", "blank": "老邁"},
        {"zh": "這樣的神強勢又不近人情。", "en": "Such a god is domineering and unfeeling.", "blank": "不近人情"},
    ],
    "ch01-l5a": [
        {"zh": "神是一位慈愛的父親。", "en": "God is a loving Father.", "blank": "慈愛"},
        {"zh": "神把人放在預先準備好的環境裡。", "en": "God placed man in a prepared environment.", "blank": "環境"},
        {"zh": "人類是唯一能欣賞大自然美景的生物。", "en": "Man alone can appreciate the beauty of nature.", "blank": "欣賞"},
        {"zh": "神賜福給他所造的人。", "en": "God blessed the man he made.", "blank": "賜福"},
        {"zh": "神讓人用智慧管理萬物。", "en": "God has man rule over all things with wisdom.", "blank": "管理"},
    ],
    "ch01-l5b": [
        {"zh": "這個問題的答案與神息息相關。", "en": "The answer to this question is bound up with God.", "blank": "息息相關"},
        {"zh": "我們要理解並接受這個結論。", "en": "We must understand and accept this conclusion.", "blank": "結論"},
        {"zh": "這個後果就是拒絕一切價值。", "en": "The consequence is rejecting all value.", "blank": "拒絕"},
        {"zh": "本課程開頭提出了這個問題。", "en": "This course raised this question at the start.", "blank": "開頭"},
    ],
    "ch01-l5c": [
        {"zh": "神是一個慈愛的天父。", "en": "God is a loving heavenly Father.", "blank": "天父"},
        {"zh": "我們不單純是一群分子。", "en": "We are not merely a bunch of molecules.", "blank": "分子"},
        {"zh": "我們的渴望不會徒勞。", "en": "Our longing is not in vain.", "blank": "徒勞"},
        {"zh": "有很多證據說明基督教的真理。", "en": "There is much evidence for the truth of Christianity.", "blank": "證據"},
        {"zh": "讓我們一起來探討基督福音。", "en": "Let us consider the gospel of Christ together.", "blank": "福音"},
        {"zh": "這門課程介紹基督教的信仰根基。", "en": "This course introduces the foundations of the Christian faith.", "blank": "根基"},
    ],
}

# (hanzi, english gloss, optional pinyin override)
CHAPTER = {
    "id": "ch01",
    "title": "Chapter 1 — What Is Life?",
    "zh": "第一章：生命的意義",
    "lessons": [
        {
            "id": "ch01-l1a", "title": "The Big Questions", "zh": "人生的大問題",
            "words": [
                ("生命", "life (of a living being)", None),
                ("意義", "meaning; significance", None),
                ("人生", "(human) life; one's life", None),
                ("人性", "human nature", None),
                ("本質", "essence; nature", None),
                ("靈魂", "soul", None),
                ("靈性", "spiritual nature; spirituality", None),
                ("問題", "question; problem", None),
                ("答案", "answer", None),
                ("目的", "purpose; aim; goal", None),
                ("追求", "to pursue; to seek after", None),
                ("探討", "to explore; to investigate", None),
                ("討論", "to discuss", None),
                ("影響", "influence; to affect", None),
                ("複雜", "complicated; complex", None),
                ("機器", "machine", None),
                ("學術", "academic; scholarly", None),
                ("困擾", "to trouble; to perplex", None),
                ("價值觀", "values; value system", None),
                ("什麼", "what", None),
                ("因為", "because", None),
            ],
        },
        {
            "id": "ch01-l1b", "title": "Naturalism", "zh": "自然論",
            "words": [
                ("肉體", "physical body; flesh", None),
                ("觀點", "point of view; viewpoint", None),
                ("稱為", "to be called; to be known as", None),
                ("自然", "nature; the natural world", None),
                ("物質", "matter; substance; physical", None),
                ("組成", "to compose; to make up", None),
                ("科學", "science; scientific", None),
                ("真理", "truth", None),
                ("幻想", "illusion; fantasy; to fantasize", None),
                ("根據", "according to; based on; basis", None),
                ("看法", "view; opinion", None),
                ("驗證", "to verify; verification", None),
                ("推論", "to infer; inference", None),
                ("自我意識", "self-awareness; sense of self", None),
                ("如果", "if", None),
            ],
        },
        {
            "id": "ch01-l1c", "title": "The Rich Man", "zh": "富翁的比喻",
            "words": [
                ("富翁", "rich man; wealthy person", None),
                ("故事", "story; tale", None),
                ("食物", "food", None),
                ("食慾", "appetite", None),
                ("飽足", "to be full; satiated", None),
                ("快樂", "happy; joyful; joy", None),
                ("樂趣", "delight; pleasure", None),
                ("痛苦", "pain; suffering; painful", None),
                ("豐富", "abundant; rich", None),
                ("真實", "true; real", None),
                ("超然", "transcendent; aloof", None),
                ("想法", "idea; notion", None),
                ("不切實際", "unrealistic; impractical", None),
                ("的確", "indeed; really", None),
                ("幻覺", "illusion; hallucination", None),
                ("認為", "to think; to consider", None),
                ("耶穌", "Jesus", None),
            ],
        },
        {
            "id": "ch01-l1d", "title": "An Absurd View", "zh": "荒唐的觀點",
            "words": [
                ("顯然", "obviously; evidently", None),
                ("荒唐", "absurd; preposterous", None),
                ("人類", "humanity; mankind", None),
                ("世界觀", "worldview", None),
                ("武斷", "arbitrary; dogmatic", None),
                ("社會", "society", None),
                ("聲稱", "to claim; to assert", None),
                ("強加", "to impose; to force upon", None),
                ("現今", "nowadays; the present", None),
                ("找到", "to find", None),
                ("看待", "to regard; to look upon", None),
                ("神", "God; deity", None),
            ],
        },
        {
            "id": "ch01-l1e", "title": "A Bleak Worldview", "zh": "暗淡的世界觀",
            "words": [
                ("暗淡", "bleak; dim; gloomy", None),
                ("剝奪", "to deprive; to strip away", None),
                ("色彩", "color; hue", None),
                ("憑據", "evidence; proof", None),
                ("基礎", "foundation; basis", None),
                ("建立", "to establish; to build", None),
                ("巨大", "huge; enormous", None),
                ("主張", "to assert; a claim; view", None),
                ("阻止", "to prevent; to block", None),
                ("回答", "to answer; to reply", None),
                ("角度", "angle; perspective", None),
                ("思考", "to think; to ponder", None),
                ("其實", "actually; in fact", None),
            ],
        },
        {
            "id": "ch01-l2a", "title": "Spiritual Longing", "zh": "靈魂的飢渴",
            "words": [
                ("創造", "to create", None),
                ("定位", "to locate; to position", None),
                ("必定", "certainly; bound to", None),
                ("結果", "result; outcome", None),
                ("此外", "besides; in addition", None),
                ("飢渴", "hunger and thirst; craving", None),
                ("享樂", "pleasure; to indulge", None),
                ("滿足", "to satisfy; satisfied", None),
                ("渴望", "to long for; longing", None),
            ],
        },
        {
            "id": "ch01-l2b", "title": "Eternity in the Heart", "zh": "永恆在人心",
            "words": [
                ("聖經", "the Bible; scripture", None),
                ("告訴", "to tell", None),
                ("永恆", "eternal; eternity", None),
                ("意識", "consciousness; awareness", None),
                ("心裡", "in one's heart; at heart", None),
                ("換句話說", "in other words", None),
                ("宣稱", "to declare; to claim", None),
                ("永遠", "forever; always", None),
                ("世界", "world", None),
                ("短暫", "brief; transient", None),
                ("成就", "achievement", None),
                ("充分", "full; ample", None),
                ("嚮往", "to yearn for; to long for", None),
                ("超越", "to transcend; to surpass", None),
                ("單純", "simple; pure", None),
                ("存活", "to survive; to live on", None),
                ("精神", "spirit; mind", None),
            ],
        },
        {
            "id": "ch01-l3a", "title": "A Lab Manual", "zh": "實驗手冊",
            "words": [
                ("實驗", "experiment", None),
                ("手冊", "manual; handbook", None),
                ("化學", "chemistry", None),
                ("抱怨", "to complain", None),
                ("誤解", "to misunderstand", None),
                ("解釋", "to explain", None),
                ("講述", "to narrate; to tell", None),
                ("情節", "plot; storyline", None),
                ("尋找", "to search for; to seek", None),
                ("關心", "to be concerned with; to care", None),
                ("神學", "theology", None),
                ("虛無", "nothingness; void", None),
                ("宇宙", "universe; cosmos", None),
                ("存在", "to exist; existence", None),
                ("創造者", "creator", None),
                ("關係", "relationship", "guān xì"),
            ],
        },
        {
            "id": "ch01-l3b", "title": "The Bible Declares", "zh": "聖經的宣告",
            "words": [
                ("注意", "to note; attention", None),
                ("說服", "to persuade", None),
                ("讀者", "reader", None),
                ("章節", "chapter; passage", None),
                ("活動", "activity; to act", None),
                ("起源", "origin", None),
                ("辯論", "debate; to argue", None),
                ("清楚", "clear; distinct", None),
                ("明白", "to understand; clear", None),
                ("萬物", "all things", None),
                ("主導", "to lead; dominant", None),
            ],
        },
        {
            "id": "ch01-l3c", "title": "In God's Image", "zh": "神的形象",
            "words": [
                ("特殊", "special; particular", None),
                ("動詞", "verb", None),
                ("描述", "to describe", None),
                ("過程", "process; course", None),
                ("呼吸", "to breathe; breath", None),
                ("深思熟慮", "to deliberate carefully", None),
                ("按照", "according to; in accordance with", None),
                ("模樣", "appearance; look", None),
                ("形象", "image; likeness", None),
                ("身體", "body", None),
                ("特別", "special; especially", None),
                ("說明", "to explain; to show", None),
                ("意味著", "to mean; to signify", None),
                ("動物", "animal", None),
            ],
        },
        {
            "id": "ch01-l3d", "title": "Let There Be Light", "zh": "太始之初",
            "words": [
                ("光", "light", "guāng"),
                ("黑暗", "darkness", None),
                ("早晨", "morning", None),
                ("晚上", "evening; night", None),
                ("晝夜", "day and night", None),
                ("天地", "heaven and earth", None),
                ("各種", "every kind of; various", None),
                ("生物", "living creature; organism", None),
                ("重複", "to repeat; repeated", "chóng fù"),
            ],
        },
        {
            "id": "ch01-l4a", "title": "It Is Good", "zh": "神說「好」",
            "words": [
                ("父母", "parents", None),
                ("期待", "to look forward to; anticipation", None),
                ("等待", "to wait; to await", None),
                ("降生", "to be born", None),
                ("措手不及", "caught off guard; unprepared", None),
                ("準備", "to prepare", None),
                ("寶寶", "baby", None),
                ("房間", "room", None),
                ("裝飾", "to decorate; decoration", None),
                ("顏色", "color", None),
                ("嬰兒", "infant; baby", None),
                ("想像", "to imagine; imagination", None),
                ("後退", "to step back; to retreat", None),
                ("依據", "basis; according to", None),
                ("非常", "very; extremely", None),
                ("甚至", "even; to the point that", None),
                ("東西", "thing(s)", "dōng xi"),
            ],
        },
        {
            "id": "ch01-l4b", "title": "Images of God", "zh": "對神的看法",
            "words": [
                ("眾生", "all living beings", None),
                ("心中", "in the heart; in mind", None),
                ("諸多", "numerous; many", None),
                ("不同", "different; difference", None),
                ("孤傲", "aloof; proud and distant", None),
                ("不近人情", "cold; unfeeling", None),
                ("強勢", "domineering; forceful", None),
                ("老邁", "aged; old and frail", None),
                ("神志不清", "senile; confused", None),
            ],
        },
        {
            "id": "ch01-l5a", "title": "A Loving Father", "zh": "慈愛的天父",
            "words": [
                ("慈愛", "loving; loving-kindness", None),
                ("父親", "father", None),
                ("智慧", "wisdom", None),
                ("管理", "to manage; to rule over", None),
                ("大自然", "nature (the natural world)", None),
                ("恰恰相反", "on the contrary; quite the opposite", None),
                ("環境", "environment; surroundings", None),
                ("保佑", "to bless; to protect", None),
                ("賜福", "to bless; to grant blessing", None),
                ("雄偉", "majestic; grand", None),
                ("迎接", "to welcome; to greet", None),
                ("唯一", "only; sole", None),
                ("欣賞", "to appreciate; to admire", None),
                ("美景", "beautiful scenery", None),
                ("王冠", "crown", None),
                ("分享", "to share", None),
                ("本性", "nature; inherent character", None),
                ("賦予", "to endow; to confer", None),
            ],
        },
        {
            "id": "ch01-l5b", "title": "What Is Life?", "zh": "生命是什麼",
            "words": [
                ("課程", "course; curriculum", None),
                ("拒絕", "to reject; to refuse", None),
                ("價值", "value; worth", None),
                ("開頭", "beginning; start", None),
                ("提出", "to raise; to put forward", None),
                ("息息相關", "closely linked; bound up together", None),
                ("理解", "to understand; comprehension", None),
                ("接受", "to accept; to receive", None),
                ("結論", "conclusion", None),
                ("後果", "consequence; aftermath", None),
                ("帶來", "to bring about", None),
                ("概念", "concept; notion", None),
            ],
        },
        {
            "id": "ch01-l5c", "title": "The Christian Gospel", "zh": "基督福音",
            "words": [
                ("信仰", "faith; belief", None),
                ("基督教", "Christianity", None),
                ("基督", "Christ", None),
                ("福音", "gospel; good news", None),
                ("證據", "evidence", None),
                ("天父", "heavenly Father", None),
                ("真的", "real; really; truly", None),
                ("分子", "molecule", None),
                ("擁有", "to possess; to have", None),
                ("徒勞", "in vain; futile", None),
                ("盲目", "blind; unthinking", None),
                ("現實", "reality; actual situation", None),
                ("宣揚", "to proclaim; to promote", None),
                ("可信", "credible; trustworthy", None),
                ("介紹", "to introduce; introduction", None),
                ("根基", "foundation; footing", None),
                ("信徒", "believer", None),
                ("探求", "to seek; to inquire into", None),
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
    "ch01-l1a": {
        "zh": [
            "人生多問。一個人可以衣食無憂，卻依然為人生更大的問題所困擾：我是誰？我在這裏做什麼？我從哪裏來？我的人生目的是什麼?這些不僅僅是學術問題。因為這些問題的答案會深深影響你的人生觀、價值觀以及對人生意義的追求。探討人生的問題離不開討論人性的本質。我僅僅是一個複雜的生物機器，還是一個有靈魂、有靈性的生命？",
        ],
        "en": [
            "Man asks questions. A person can have all the creature comforts met, and yet find himself disturbed by the larger questions of life: Who am I? What am I here for? Where did I come from, and what is my ultimate destiny? These are not just academic issues. A lot hinges on your answers to these questions—how you choose to live, what you value, and what purposes drive you. At the core of the question of life is the issue of the nature of man. Am I a complex biological machine and no more, or am I a spiritual being with a soul?",
        ],
    },
    "ch01-l1b": {
        "zh": [
            "道金斯和羅素所持的觀點(也是眾多人所持的觀點)又被稱為「自然論」，其主旨便是世上之物皆由物質組成。這種看法也被稱為「科學論」，因為它往往會用科學來聲張科學本身無法驗證的真理。如果世上之物都由物質組成，由此推論，我們僅是一團會動的肉體罷了。那麼一切超越肉體的自我意識便都是幻想。根據自然論，「我們」就只有肉體。這是真的？",
        ],
        "en": [
            "The view espoused by Dawkins and Russell (and generally embraced in our world), also known as “naturalism,” says that all of reality is composed of the physical. This view is also called “scientism” because it tends to claim truths for science that are not themselves verifiable by science. If all of reality is physical, then it follows that we are no more than animated flesh. Any sense of self we may have that transcends our bodies is illusory. Quite literally, “we” are just our bodies, according to naturalism. Is this right?",
        ],
    },
    "ch01-l1c": {
        "zh": [
            "上述故事裡的富翁認為他的「靈魂」應該飽足於「食物」上，或許人生最大樂趣莫過於大吃大喝、痛苦最少、快樂最多。那麼，肉身之外還有更多，滿足食慾之上更有真實、超然的價值，難道這種想法不切實際嗎？的確，如果我們僅有肉身，那麼身外的東西自然都是幻覺。但敍述此故事的耶穌說：人的生命並不在於家道豐富。如果不在物質的豐富，那生命在於什麼呢？",
        ],
        "en": [
            "The rich man in the story thought his “soul” fed on “grain,” as if the highest good for man were to feed the appetites, to minimize pain and maximize pleasure. So, is the notion that we are more than our bodies, that there are real, transcendent values beyond satisfying our appetites, just unreal fluff? It must be, if who we are is just bodies. But Jesus says that “one’s life does not consist in the abundance of his possessions.” If not possessions, then what is life about?",
        ],
    },
    "ch01-l1d": {
        "zh": [
            "顯然，這種看待人類的觀點很荒唐。但是，在無神、純自然的世界觀裡，又很難找到更好的答案。這種觀點其實非常的武斷，聲稱科學真理以外便無真理，將這個不理性的觀點強加於現今社會。",
        ],
        "en": [
            "Obviously, this is an absurd view of man. Yet, better answers seem hard to find under an atheistic, naturalistic worldview. This view is entirely arbitrary, claiming there is no truth other than scientific truth, imposed on modern society.",
        ],
    },
    "ch01-l1e": {
        "zh": [
            "這種暗淡的觀點不僅剝奪了生命中所有的色彩，它更在毫無憑據的基礎上建立了一個巨大的主張。自然論阻止了深層的思考，它也在我們回答人生最基本的問題上限制了我們的思維。從宏觀角度來看，若要探尋人性的本質、價值及其意義，就要從人類的起源開始。",
        ],
        "en": [
            "In addition to being a bleak view that strips life of all its color, it makes a huge claim that is simply asserted without evidence. Naturalism stifles deeper thinking in that it artificially reduces what we are allowed to consider in answering the most fundamental of questions. For a grander perspective, we need to start with the question of origin.",
        ],
    },
    "ch01-l2a": {
        "zh": [
            "如果我們是神創造的，那麼以創世記的故事之外來定位自己必定是毫無結果的。此外，如果神有靈性，那麼他在創造我們肉體的同時，也會附上「靈魂的飢渴」，而這種饑渴無法用食物或享樂來滿足。",
        ],
        "en": [
            "If we have been created by God, it would follow that our attempt to locate ourselves apart from the larger story of creation is bound to be unfruitful. Further, if God, himself a spiritual being, made us to be more than our bodies, then it follows that we would have such a thing as “spiritual longings” which no amount of food or pleasures can satisfy.",
        ],
    },
    "ch01-l2b": {
        "zh": [
            "《聖經》告訴我們，神把「永恆的意識放在人的心裡」。換句話說，《聖經》宣稱我們永遠不能從這世界中短暫的成就裡得到充分的滿足，因為我們是被神創造的，有永恆的靈魂，嚮往著一種遠遠超越單純存活的精神。",
        ],
        "en": [
            "The Bible identifies the reason for this longing: God has “put eternity into man’s heart.” In other words, we can never be fully at peace with only the physical, because we have been created by God with eternal souls, which long for something much more than a mere biological existence.",
        ],
    },
    "ch01-l3a": {
        "zh": [
            "假如某人讀完一本化學實驗手冊，然後大聲抱怨說：「這本書太爛了，一點故事情節都沒有！」那只能說他誤解了這本手冊的原意。實驗手冊只解釋實驗過程，並不講述人物或描寫故事情節。想從實驗手冊中看人講故事實在是強人所難。許多人讀創世記也跟看實驗手冊一樣，總想從中尋找本不存在的答案。創世記不關心「如何」的問題，而只專注於回答「為什麼」和「誰」相關的神學問題。比如，宇宙為什麼是真實存在的而不是虛無的？誰創造了宇宙？人是誰，他與創造者的關係是什麼？",
        ],
        "en": [
            "Imagine a person, upon reading a chemistry lab manual, exclaiming in exasperation, “This book has no plot!” Such a person is misunderstanding the genre of what he is reading. A lab manual is not interested in character or plot development; it is only meant to describe how to run experiments. Many read the creation account in Genesis as one would read a lab manual, demanding from it answers Genesis is not interested in providing. Genesis is concerned not with the question of “how” but with the theological narrative of God’s creation—“why” and “who”: why is there something rather than nothing? Who created this universe? Who is man, and what is his relationship to the Creator?",
        ],
    },
    "ch01-l3b": {
        "zh": [
            "請注意《聖經》沒有刻意說服讀者神的存在。從書的開始章節，《聖經》就宣稱了神的活動。我們把關於宇宙起源的辯論放到一邊，《聖經》清楚明白地說明了萬物是在神的主導下被創造出來的。",
        ],
        "en": [
            "Note that the Bible does not attempt to persuade the reader of the existence of God. Rather, from its very first pages, the Bible declares the activity of God. All of the arguments regarding the origin of the universe aside, the Bible simply states that everything has its being in the sovereign creation of God.",
        ],
    },
    "ch01-l3c": {
        "zh": [
            "《聖經》用了一個很特殊的希伯來語動詞來描述神造人的過程。我們仿佛看見神停頓了一下，做了個深呼吸，深思熟慮地把人造出來。其他的動物都是按照動物本身的模樣創造的，「各從其類」，而《聖經》說「神照著自己的形象創造人」，以及神「把生氣吹進」我們的身體。這說明人與神的關係非常特別。按《聖經》的說法，這個特別的關係意味著我們不僅有肉體，還有靈性。",
        ],
        "en": [
            "A special Hebrew verb is used in the creation account when God creates man. We see God taking a pause, almost taking a deep breath, deliberating, and “forming” man. The other animals were created “according to their kinds,” but the Bible declares that “God created man in his own image” and that God “breathed…the breath of life” into us, highlighting the special relationship between mankind and God. Part of the reason for this special relationship is that we are spiritual, and not merely physical, creatures.",
        ],
    },
    "ch01-l3d": {
        "zh": [
            "起初，神創造天地。地是空虛混沌；深淵上一片黑暗；神的靈運行在水面上。神說：「要有光！」就有了光。神看光是好的，他就把光暗分開了。神稱光為晝，稱暗為夜。有晚上，有早晨；這是第一日。",
        ],
        "en": [
            "In the beginning, God created the heavens and the earth. The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters. And God said, “Let there be light,” and there was light. And God saw that the light was good. And God separated the light from the darkness. God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.",
        ],
    },
    "ch01-l4a": {
        "zh": [
            "創世記提到，神每造一物都會說「好」，最後把人造出來時，甚至還說「非常好。」這個「好」的依據是什麼？等待小寶寶降生的父母親一般不會措手不及。寶寶降生之前，他們會準備一些東西。比如把房間裝飾成柔和的顏色，在牆上畫上火車和雲朵。裝上嬰兒床，並放好軟墊。你能想像到，每做完一件事，這對父母親都會後退一步，看著他們準備好了的東西，說：「這個好。」",
        ],
        "en": [
            "Genesis reports that God repeatedly declares creation as good, and finally, with man in place, “very good.” What is the basis of this “goodness”? Parents expecting the arrival of a newborn don’t get caught off guard. Before the arrival of the baby, they set up the room. They decorate it with pastel baby colors and line the walls with pictures of trains and clouds. They assemble a crib and pad it with cushion. At each stage, you can imagine the parents stepping back, looking at what they prepared and saying, “This is good.”",
        ],
    },
    "ch01-l4b": {
        "zh": [
            "神在眾生心中有諸多不同的形象：孤傲且不近人情的神；強勢且不怒自威的神；或者老邁又神志不清的老爺爺。",
        ],
        "en": [
            "There are many different perceptions about God: an aloof figure sitting at a distance, a powerful and vindictive force that should be avoided, perhaps an irrelevant and senile grandfather.",
        ],
    },
    "ch01-l5a": {
        "zh": [
            "恰恰相反，《聖經》從第一頁起所描述的神與上面這些形象完全不同。神是一位慈愛的父親，把所造的人放在預先準備好的環境裡面，並「保佑人們」，還「賜福予人」，還說他所造的「非常好！」雄偉的高山，廣袤的原野，奔騰的河流，蔥郁的樹木，已經預先準備好以迎接人類，而人類又是唯一能夠欣賞大自然美景的生物。神造萬物，人為王冠。人類分享著神的本性，被賦予了用愛和智慧來管理這個世界的職務。這是創世記所表達的信息。",
        ],
        "en": [
            "Contrary to such views, the portrait of God revealed in the very first pages of the Bible is that of a loving Father, who places man into an environment prepared for him. God “blesses” and “gives” and pronounces that creation is “very good.” The majestic mountains, the pristine beauty of the meadows, the rivers, the trees, were all prepared for mankind, who uniquely among creatures is endowed with the strange propensity to find nature transcendently beautiful. Man was the crown of all of God’s creation, sharing His nature, and meant to rule over it with love and wisdom. This is the message of Genesis.",
        ],
    },
    "ch01-l5b": {
        "zh": [
            "回到本課程開頭提出的問題：「生命是什麼？」這個問題的答案與神息息相關。如果神不存在，我們就該理解並接受這個結論所帶來的後果。這個後果就是拒絕一切價值、意義、甚至愛的概念，並接受我們的生命就是毫無意義。",
        ],
        "en": [
            "Let’s consider once again the question we started with: “What is life?” The answer is integrally linked with the question about God. If it really is the case that there is no God, then we ought to be clear about the consequences and accept them—which would mean we reject notions of value and meaning and align our lives with the belief that life is ultimately meaningless.",
        ],
    },
    "ch01-l5c": {
        "zh": [
            "但是，如果《聖經》所說是真的，創造了萬物的神是一個慈愛的天父，那我們就不單純是一群分子堆積物，我們擁有的遠比肉體更多。我們追求比生命更高的渴望不會徒勞，因為這本就是源自于我們超越自然的本質。雖然某些人認為基督信仰是種「盲目的信仰」，但現實情況是有很多證據可以説明基督教所宣揚真理的可信性。本課程的目的就是介紹基督教的信仰根基。不論你是信徒還是探求者，在接下來的幾個星期，讓我們一起來探討基督福音。",
        ],
        "en": [
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

        # Per-section sentence practice. Each blank must be a word THIS lesson
        # teaches and must appear exactly once in the sentence (two occurrences
        # would render two blanks).
        own = {hz for (hz, _en, _o) in lesson["words"]}
        lsents = []
        for s in LESSON_SENTENCES.get(lesson["id"], []):
            blank, zh = s["blank"], s["zh"]
            if blank not in own:
                print(f"ERROR: {lesson['id']} cloze blank not taught by this lesson:",
                      blank, file=sys.stderr); sys.exit(1)
            n = zh.count(blank)
            if n != 1:
                print(f"ERROR: {lesson['id']} blank {blank!r} appears {n}x in {zh!r}"
                      " (must be exactly once)", file=sys.stderr); sys.exit(1)
            toks = tokenize(zh, dic)
            if blank not in toks:
                print(f"ERROR: {lesson['id']} blank {blank!r} is not a whole token in"
                      f" {zh!r} (tokens: {toks})", file=sys.stderr); sys.exit(1)
            lsents.append({"zh": zh, "en": s["en"], "blank": blank, "tokens": toks})
        if lsents:
            out["sentences"] = lsents

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
        sentences.append({"zh": s["zh"], "en": s["en"], "blank": blank,
                          "tokens": tokenize(s["zh"], dic)})

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
    ls = sum(len(l.get("sentences", [])) for l in out_lessons)
    print("wrote", out, "-", len(out_lessons), "lessons,", n, "words,",
          len(sentences), "test sentences,", r, "reading passages,",
          ls, "section sentences")

if __name__ == "__main__":
    main()
