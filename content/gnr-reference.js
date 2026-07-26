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
