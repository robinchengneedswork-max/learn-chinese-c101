// GNR — Good News Reader: the book's back-matter, as browsable REFERENCE docs
// (not SRS lessons). Surfaced in the home "Reference · 附錄" area for the GNR book
// and opened in the shared modal. Registered via C101.registerReference so these
// entries never enter the graded word pool / distractor set (see src/content.js).
//
// HAND-TRANSCRIBED from the scanned PDFs by vision, then Simplified -> Traditional
// (canonical). Docs are appended here batch by batch (radicals, Bible books,
// closing prayer, glossary, appendices).
//
// Doc kinds (payload the ui.js modal builders expect):
//   'table'    -> { groups: [ { title, rows: [ { hz, name } ] } ] }
//   'glossary' -> { note?, words: [ { hanzi, pinyin, en } ] }   (searchable list)
//   'passage'  -> { sections: [ { zh, en } ] }                  (play + English reveal)

// ---- Lesson 0 — Radicals & parts of characters ----------------------------
// The book opens with an "Important Study Help" table of radicals and character
// parts. We transcribe the standard, unambiguous entries (real Unicode radicals
// with genuine readings/meanings) — the useful core for a learner — and keep the
// book's own names. Its purely-mnemonic pseudo-glyphs ("crooked TEN", "punkhead",
// "half a cover") are omitted rather than approximated with wrong characters.
window.C101.registerReference({
  bookId: 'gnr',
  id: 'gnr-radicals',
  icon: '🧩',
  title: 'Radicals & character parts',
  zh: '部首與字形',
  kind: 'table',
  intro: 'When a name is in CAPITALS, nearly every character containing that part relates to it (e.g. 扌 HAND → 打 hit, 推 push, 拉 pull). Learn these early — it makes the characters far easier to remember.',
  groups: [
    { title: 'People & body 人與身體', rows: [
      { hz: '人', name: 'PERSON (rén)' },
      { hz: '亻', name: 'person (人 at the side)' },
      { hz: '大', name: 'BIG (dà)' },
      { hz: '夫', name: 'MAN / “double big” (fū)' },
      { hz: '女', name: 'WOMAN (nǚ)' },
      { hz: '子', name: 'CHILD (zǐ)' },
      { hz: '心', name: 'HEART (xīn)' },
      { hz: '忄', name: 'HEART (心 at the side)' },
      { hz: '扌', name: 'HAND (shǒu)' },
      { hz: '手', name: 'HAND (shǒu)' },
      { hz: '又', name: 'AGAIN / a hand (yòu)' },
      { hz: '口', name: 'MOUTH (kǒu)' },
      { hz: '目', name: 'EYE (mù)' },
      { hz: '自', name: 'ONESELF (zì)' },
      { hz: '耳', name: 'EAR (ěr)' },
      { hz: '足', name: 'FOOT (zú)' },
      { hz: '身', name: 'BODY (shēn)' },
      { hz: '頁', name: 'PAGE / head (yè)' },
      { hz: '毛', name: 'FUR (máo)' },
      { hz: '父', name: 'FATHER (fù)' },
      { hz: '母', name: 'MOTHER (mǔ)' }
    ]},
    { title: 'Nature & the elements 自然', rows: [
      { hz: '日', name: 'SUN (rì)' },
      { hz: '月', name: 'MOON / FLESH (yuè)' },
      { hz: '火', name: 'FIRE (huǒ)' },
      { hz: '灬', name: 'four flames of FIRE' },
      { hz: '水', name: 'WATER (shuǐ)' },
      { hz: '氵', name: '3 drops of WATER' },
      { hz: '冫', name: 'ICE (2 drops)' },
      { hz: '山', name: 'MOUNTAIN (shān)' },
      { hz: '川', name: 'STREAM (chuān)' },
      { hz: '土', name: 'EARTH (tǔ)' },
      { hz: '石', name: 'STONE (shí)' },
      { hz: '田', name: 'FIELD (tián)' },
      { hz: '雨', name: 'RAIN (yǔ)' },
      { hz: '風', name: 'WIND (fēng)' },
      { hz: '西', name: 'WEST (xī)' }
    ]},
    { title: 'Plants 植物', rows: [
      { hz: '木', name: 'WOOD, TREE (mù)' },
      { hz: '禾', name: 'CEREAL (hé)' },
      { hz: '米', name: 'RICE (mǐ)' },
      { hz: '竹', name: 'BAMBOO (zhú)' },
      { hz: '艹', name: 'GRASS' }
    ]},
    { title: 'Animals 動物', rows: [
      { hz: '犬', name: 'ANIMAL / DOG (quǎn)' },
      { hz: '犭', name: 'animal (犬 at the side)' },
      { hz: '牛', name: 'OX, cow (niú)' },
      { hz: '豕', name: 'PIG (shǐ)' },
      { hz: '馬', name: 'HORSE (mǎ)' },
      { hz: '羊', name: 'SHEEP (yáng)' },
      { hz: '鳥', name: 'BIRD (niǎo)' },
      { hz: '隹', name: 'little BIRD (zhuī)' },
      { hz: '魚', name: 'FISH (yú)' },
      { hz: '虫', name: 'BUG (chóng)' },
      { hz: '龍', name: 'DRAGON (lóng)' },
      { hz: '羽', name: 'FEATHER (yǔ)' }
    ]},
    { title: 'Faith, words & money 信仰・言・財', rows: [
      { hz: '示', name: 'DEITY (shì)' },
      { hz: '礻', name: 'DEITY (示 at the side)' },
      { hz: '衣', name: 'CLOTHING (yī)' },
      { hz: '衤', name: 'CLOTHING (衣 at the side)' },
      { hz: '言', name: 'WORDS (yán)' },
      { hz: '貝', name: 'MONEY, seashell (bèi)' },
      { hz: '見', name: 'TO SEE (jiàn)' },
      { hz: '鬼', name: 'DEVIL, ghost (guǐ)' }
    ]},
    { title: 'Tools & things 器物', rows: [
      { hz: '力', name: 'STRENGTH (lì)' },
      { hz: '刀', name: 'KNIFE (dāo)' },
      { hz: '刂', name: 'long KNIFE' },
      { hz: '工', name: 'WORK (gōng)' },
      { hz: '王', name: 'PRECIOUS / KING (wáng)' },
      { hz: '士', name: 'SCHOLAR (shì)' },
      { hz: '門', name: 'DOOR (mén)' },
      { hz: '戶', name: 'HOUSEHOLD (hù)' },
      { hz: '尸', name: 'CORPSE, “dirty thing” (shī)' },
      { hz: '車', name: 'VEHICLE (chē)' },
      { hz: '舟', name: 'BOAT (zhōu)' },
      { hz: '弓', name: 'BOW (gōng)' },
      { hz: '戈', name: 'SPEAR (gē)' },
      { hz: '巾', name: 'CLOTH (jīn)' },
      { hz: '糸', name: 'SILK (sī)' },
      { hz: '網', name: 'NET (wǎng)' },
      { hz: '皿', name: 'UTENSIL (mǐn)' },
      { hz: '用', name: 'USE (yòng)' },
      { hz: '角', name: 'HORN (jiǎo)' },
      { hz: '皮', name: 'SKIN (pí)' },
      { hz: '金', name: 'METAL, GOLD (jīn)' }
    ]},
    { title: 'Actions, states & colours 動作・狀態・顏色', rows: [
      { hz: '立', name: 'TO STAND (lì)' },
      { hz: '走', name: 'to WALK (zǒu)' },
      { hz: '辶', name: 'small WALK (movement)' },
      { hz: '止', name: 'TO STOP (zhǐ)' },
      { hz: '文', name: 'ACADEMIC, writing (wén)' },
      { hz: '欠', name: 'to OWE / yawn (qiàn)' },
      { hz: '食', name: 'FOOD (shí)' },
      { hz: '舌', name: 'TONGUE (shé)' },
      { hz: '白', name: 'WHITE (bái)' },
      { hz: '黑', name: 'BLACK (hēi)' },
      { hz: '赤', name: 'RED (chì)' },
      { hz: '光', name: 'LIGHT (guāng)' },
      { hz: '革', name: 'LEATHER (gé)' }
    ]}
  ]
});

// ---- Appendix 2 — The Books of the Bible ----------------------------------
// All 66 books, in the book's own order/grouping, with the common abbreviation
// folded into the English gloss. Names converted to Traditional (canonical).
window.C101.registerReference({
  bookId: 'gnr',
  id: 'gnr-bible-books',
  icon: '📖',
  title: 'Books of the Bible',
  zh: '聖經各卷',
  kind: 'glossary',
  groups: [
    { title: '舊約 · Old Testament — 律法書 The Law', words: [
      { hanzi: '創世記',   pinyin: 'Chuàngshì Jì',   en: 'Genesis (創)' },
      { hanzi: '出埃及記', pinyin: 'Chū-Āijí Jì',     en: 'Exodus (出)' },
      { hanzi: '利未記',   pinyin: 'Lìwèi Jì',        en: 'Leviticus (利)' },
      { hanzi: '民數記',   pinyin: 'Mínshù Jì',       en: 'Numbers (民)' },
      { hanzi: '申命記',   pinyin: 'Shēnmìng Jì',     en: 'Deuteronomy (申)' }
    ]},
    { title: '歷史書 The Historical Books', words: [
      { hanzi: '約書亞記',   pinyin: 'Yuēshūyà Jì',      en: 'Joshua (書)' },
      { hanzi: '士師記',     pinyin: 'Shìshī Jì',        en: 'Judges (士)' },
      { hanzi: '路得記',     pinyin: 'Lùdé Jì',          en: 'Ruth (得)' },
      { hanzi: '撒母耳記上', pinyin: 'Sāmǔ’ěr Jì Shàng', en: '1 Samuel (撒上)' },
      { hanzi: '撒母耳記下', pinyin: 'Sāmǔ’ěr Jì Xià',   en: '2 Samuel (撒下)' },
      { hanzi: '列王記上',   pinyin: 'Lièwáng Jì Shàng', en: '1 Kings (王上)' },
      { hanzi: '列王記下',   pinyin: 'Lièwáng Jì Xià',   en: '2 Kings (王下)' },
      { hanzi: '歷代志上',   pinyin: 'Lìdài Zhì Shàng',  en: '1 Chronicles (代上)' },
      { hanzi: '歷代志下',   pinyin: 'Lìdài Zhì Xià',    en: '2 Chronicles (代下)' },
      { hanzi: '以斯拉記',   pinyin: 'Yǐsīlā Jì',        en: 'Ezra (拉)' },
      { hanzi: '尼希米記',   pinyin: 'Níxīmǐ Jì',        en: 'Nehemiah (尼)' },
      { hanzi: '以斯帖記',   pinyin: 'Yǐsītiē Jì',       en: 'Esther (斯)' }
    ]},
    { title: '詩文書 The Literary Books', words: [
      { hanzi: '約伯記', pinyin: 'Yuēbó Jì',    en: 'Job (伯)' },
      { hanzi: '詩篇',   pinyin: 'Shīpiān',     en: 'Psalms (詩)' },
      { hanzi: '箴言',   pinyin: 'Zhēnyán',     en: 'Proverbs (箴)' },
      { hanzi: '傳道書', pinyin: 'Chuándào Shū', en: 'Ecclesiastes (傳)' },
      { hanzi: '雅歌',   pinyin: 'Yǎ Gē',       en: 'Song of Songs (歌)' }
    ]},
    { title: '預言書 The Prophets', words: [
      { hanzi: '以賽亞書',   pinyin: 'Yǐsàiyà Shū',   en: 'Isaiah (賽)' },
      { hanzi: '耶利米書',   pinyin: 'Yēlìmǐ Shū',    en: 'Jeremiah (耶)' },
      { hanzi: '耶利米哀歌', pinyin: 'Yēlìmǐ Āigē',   en: 'Lamentations (哀)' },
      { hanzi: '以西結書',   pinyin: 'Yǐxījié Shū',   en: 'Ezekiel (結)' },
      { hanzi: '但以理書',   pinyin: 'Dànyǐlǐ Shū',   en: 'Daniel (但)' },
      { hanzi: '何西阿書',   pinyin: 'Héxī’ā Shū', en: 'Hosea (何)' },
      { hanzi: '約珥書',     pinyin: 'Yuē’ěr Shū', en: 'Joel (珥)' },
      { hanzi: '阿摩司書',   pinyin: 'Āmósī Shū',     en: 'Amos (摩)' },
      { hanzi: '俄巴底亞書', pinyin: 'Ébādǐyà Shū',   en: 'Obadiah (俄)' },
      { hanzi: '約拿書',     pinyin: 'Yuēná Shū',     en: 'Jonah (拿)' },
      { hanzi: '彌迦書',     pinyin: 'Míjiā Shū',     en: 'Micah (彌)' },
      { hanzi: '那鴻書',     pinyin: 'Nàhóng Shū',    en: 'Nahum (鴻)' },
      { hanzi: '哈巴谷書',   pinyin: 'Hābāgǔ Shū',    en: 'Habakkuk (哈)' },
      { hanzi: '西番雅書',   pinyin: 'Xīfānyǎ Shū',   en: 'Zephaniah (番)' },
      { hanzi: '哈該書',     pinyin: 'Hāgāi Shū',     en: 'Haggai (該)' },
      { hanzi: '撒迦利亞書', pinyin: 'Sājiālìyà Shū', en: 'Zechariah (亞)' },
      { hanzi: '瑪拉基書',   pinyin: 'Mǎlājī Shū',    en: 'Malachi (瑪)' }
    ]},
    { title: '新約 · New Testament — 福音書 The Gospels', words: [
      { hanzi: '馬太福音', pinyin: 'Mǎtài Fúyīn',  en: 'Matthew (太)' },
      { hanzi: '馬可福音', pinyin: 'Mǎkě Fúyīn',   en: 'Mark (可)' },
      { hanzi: '路加福音', pinyin: 'Lùjiā Fúyīn',  en: 'Luke (路)' },
      { hanzi: '約翰福音', pinyin: 'Yuēhàn Fúyīn', en: 'John (約)' },
      { hanzi: '使徒行傳', pinyin: 'Shǐtú Xíngzhuàn', en: 'Acts (徒)' }
    ]},
    { title: '書信 The Epistles', words: [
      { hanzi: '羅馬書',       pinyin: 'Luómǎ Shū',          en: 'Romans (羅)' },
      { hanzi: '哥林多前書',   pinyin: 'Gēlínduō Qiánshū',   en: '1 Corinthians (林前)' },
      { hanzi: '哥林多後書',   pinyin: 'Gēlínduō Hòushū',    en: '2 Corinthians (林後)' },
      { hanzi: '加拉太書',     pinyin: 'Jiālātài Shū',       en: 'Galatians (加)' },
      { hanzi: '以弗所書',     pinyin: 'Yǐfúsuǒ Shū',        en: 'Ephesians (弗)' },
      { hanzi: '腓立比書',     pinyin: 'Féilìbǐ Shū',        en: 'Philippians (腓)' },
      { hanzi: '歌羅西書',     pinyin: 'Gēluóxī Shū',        en: 'Colossians (西)' },
      { hanzi: '帖撒羅尼迦前書', pinyin: 'Tiēsāluóníjiā Qiánshū', en: '1 Thessalonians (帖前)' },
      { hanzi: '帖撒羅尼迦後書', pinyin: 'Tiēsāluóníjiā Hòushū',  en: '2 Thessalonians (帖後)' },
      { hanzi: '提摩太前書',   pinyin: 'Tímótài Qiánshū',    en: '1 Timothy (提前)' },
      { hanzi: '提摩太後書',   pinyin: 'Tímótài Hòushū',     en: '2 Timothy (提後)' },
      { hanzi: '提多書',       pinyin: 'Tíduō Shū',          en: 'Titus (多)' },
      { hanzi: '腓利門書',     pinyin: 'Féilìmén Shū',       en: 'Philemon (門)' },
      { hanzi: '希伯來書',     pinyin: 'Xībólái Shū',        en: 'Hebrews (來)' },
      { hanzi: '雅各書',       pinyin: 'Yǎgè Shū',           en: 'James (雅)' },
      { hanzi: '彼得前書',     pinyin: 'Bǐdé Qiánshū',       en: '1 Peter (彼前)' },
      { hanzi: '彼得後書',     pinyin: 'Bǐdé Hòushū',        en: '2 Peter (彼後)' },
      { hanzi: '約翰一書',     pinyin: 'Yuēhàn Yīshū',       en: '1 John (約壹)' },
      { hanzi: '約翰二書',     pinyin: 'Yuēhàn Èrshū',       en: '2 John (約貳)' },
      { hanzi: '約翰三書',     pinyin: 'Yuēhàn Sānshū',      en: '3 John (約叁)' },
      { hanzi: '猶大書',       pinyin: 'Yóudà Shū',          en: 'Jude (猶)' }
    ]},
    { title: '啟示 Revelation', words: [
      { hanzi: '啟示錄', pinyin: 'Qǐshì Lù', en: 'Revelation (啟)' }
    ]}
  ]
});

// ---- Glossary — every word taught in the course ---------------------------
// Generated at render time from the book's own lesson data (source:'book-words'),
// so it's always complete, deduped and in sync — a searchable dictionary of every
// word the 25 lessons teach, sorted by pinyin. (The scanned book ships a 31-page
// Chinese–English glossary; this in-app version is built from the curated data.)
window.C101.registerReference({
  bookId: 'gnr',
  id: 'gnr-glossary',
  icon: '📚',
  title: 'Glossary',
  zh: '詞彙表',
  kind: 'glossary',
  source: 'book-words',
  note: 'Every word taught across the 25 lessons, sorted by pinyin. Type in the box to look one up.'
});

// ---- Closing passage — 信主 (Believing in the Lord) ------------------------
// The book's altar-call passage after Lesson 25 (pp.162–163), Chinese only in the
// source; converted to Traditional, with an English translation supplied here.
window.C101.registerReference({
  bookId: 'gnr',
  id: 'gnr-prayer',
  icon: '🙏',
  title: 'A prayer to receive Christ',
  zh: '信主',
  kind: 'passage',
  sections: [
    {
      zh: '神愛你，他愛世上每一個人，並且為你的生命安排了一個奇妙的計劃。但是，人因有罪而與神隔絕，不能知道也不能經驗神的愛和神為他生命的計劃。這是多麼悲慘啊！耶穌基督是神為人的罪所預備的唯一救法。他在十字架上為人的罪受苦而死，並復活。他的寶血洗淨了人類一切的罪惡。基督成為神與人中間的橋樑，溝通了兩者之間的深淵。但是，如果我們不親自接受耶穌基督，接受他為我們的救主和生命的主，我們仍無法與神重新和好，仍無法經驗到神的大愛和神對我們生命的計劃。因此，我們應該首先為罪自責，承認自己是一個罪人，並且願意悔改，藉著信心，相信基督能赦免我們的罪，接受他進入我們的心，請他掌管我們的一生，永遠稱他為主。這樣，我們就與過去的罪一刀兩斷，在耶穌基督裡重生，因而稱義，成為一個新人，成為神的兒女，開始神為我們生命的計劃。',
      en: 'God loves you; He loves every person in the world, and He has arranged a wonderful plan for your life. But because of sin, people are cut off from God, unable to know or experience God’s love and His plan for their lives. How tragic this is! Jesus Christ is the only way of salvation God has prepared for the sin of mankind. On the cross He suffered and died for the sins of men, and rose again. His precious blood has washed away all the sins of mankind. Christ became the bridge between God and man, spanning the chasm between them. But if we do not personally receive Jesus Christ — receive Him as our Savior and the Lord of our life — we still cannot be reconciled with God, nor experience His great love and His plan for our lives. Therefore we should first take the blame for our sin, admit that we are sinners, and be willing to repent; through faith, believe that Christ can forgive our sins, receive Him into our hearts, ask Him to take charge of our whole life, and forever call Him Lord. In this way we make a clean break with our past sin, are born again in Jesus Christ, and so are justified, become a new person, become a child of God, and begin the plan God has for our lives.'
    },
    {
      zh: '你能想到人生中有什麼比接受基督更奇妙呢？神知道你的心，他看重你內心的態度，過於你外在的言語。你可向創造宇宙、萬能的神禱告：「神啊，我需要你。我願意打開心門接受耶穌作我的救主和生命的主。感謝你赦免我的罪。求你管理我的一生，使我成為你所喜悅的人。奉主耶穌的名禱告，阿們。」基督就會照著他的應許，進入你的生命，並且將永生賜給你，永不離開你。因為，他絕不會欺騙你。',
      en: 'Can you think of anything in life more wonderful than receiving Christ? God knows your heart; He values the attitude of your inner heart more than your outward words. You may pray to the almighty God who created the universe: “God, I need You. I am willing to open the door of my heart and receive Jesus as my Savior and the Lord of my life. Thank You for forgiving my sins. I ask You to take charge of my whole life and make me a person who pleases You. In the name of the Lord Jesus I pray, Amen.” Christ will then, according to His promise, enter your life, give you eternal life, and never leave you — for He will never deceive you.'
    }
  ]
});
