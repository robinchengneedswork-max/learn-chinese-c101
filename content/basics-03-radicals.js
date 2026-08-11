// Basics 3 — Radicals & character parts. The 95 entries of the Good News Reader's
// "Important Study Help" table, promoted from a browsable reference table into a
// drilled chapter. (The table itself still lives in content/gnr-reference.js for
// the GNR book; this is the same material as exercises.)
//
// `drill: 'radical'` runs part→meaning, meaning→part, and the "which character
// contains this part?" item built from `examples`.
//
// ---- Curating `examples` ---------------------------------------------------
// Two rules, both load-bearing:
//
//  1. Every example character must appear somewhere in the GRADED CORPUS (the
//     Course 101 / GNR vocabulary) — verified by the headless tests. The point of
//     the drill is that you meet these characters in the books, not that they are
//     textbook specimens.
//
//  2. An example must contain its own radical AND NO OTHER radical in this
//     chapter. The drill draws its decoys from other radicals' example lists, so
//     a character with two drilled parts is a second correct answer to somebody
//     else's question. 案 (宀+女+木) is out because 女 and 木 are both drilled;
//     洗 (氵+先) is in because 先 is not.
//
// There is no character-decomposition data in this repo, so rule 2 is curation,
// not computation: the tests can only catch a character listed under two
// radicals, not one whose second part was overlooked. Add examples by hand and
// check the components. A radical with no clean example simply gets none — the
// drill skips the item (see containsItem in session.js) and still teaches the
// part by meaning, which is why plenty of entries below have no `examples`.
//
// `say` gives TTS something pronounceable: a bare 氵 has no reading of its own,
// so it is read aloud as its parent 水.
window.C101.register({
  bookId: 'basics',
  track: 'radicals', trackTitle: 'Radicals', trackZh: '部首',
  aux: true,

  id: 'bas-radicals',
  title: 'Radicals & Character Parts',
  zh: '部首與字形',
  lessons: [
    { id: 'bas-rad-l1', title: 'People & the body', zh: '人與身體', drill: 'radical',
      crossover: { to: 'bas-sounds-l4', why: '女 nǚ is the ü sound that English speakers lose — hear it against nu next door.' },
      words: [
        { hanzi: '人', pinyin: 'rén', en: 'person', examples: ['今', '介', '以'],
          note: 'When a part is a whole character on its own it usually sits on top or underneath; the squeezed side-form 亻 is the same word.' },
        { hanzi: '亻', pinyin: 'rén', en: 'person (at the side)', say: '人',
          examples: ['作', '付', '代'],
          note: 'By far the most common part in the book: characters about what people do and what people are like.' },
        { hanzi: '大', pinyin: 'dà', en: 'big', examples: ['太', '天'] },
        { hanzi: '夫', pinyin: 'fū', en: 'man; husband (a "double big")' },
        { hanzi: '女', pinyin: 'nǚ', en: 'woman', examples: ['妙', '妹', '姐'] },
        { hanzi: '子', pinyin: 'zǐ', en: 'child', examples: ['字', '存', '孤'] },
        { hanzi: '心', pinyin: 'xīn', en: 'heart; mind', examples: ['忍', '愛'],
          note: 'Chinese puts thinking in the heart, not the head — 心 marks feelings AND thoughts.' },
        { hanzi: '忄', pinyin: 'xīn', en: 'heart (at the side)', say: '心',
          examples: ['快', '性', '恨'] },
        { hanzi: '扌', pinyin: 'shǒu', en: 'hand (at the side)', say: '手',
          examples: ['打', '抱', '托'],
          note: 'Nearly every character with 扌 is something you do with your hands: 打 hit, 推 push, 拉 pull.' },
        { hanzi: '手', pinyin: 'shǒu', en: 'hand (full form)' },
        { hanzi: '又', pinyin: 'yòu', en: 'again; a hand', examples: ['受', '反'] },
        { hanzi: '口', pinyin: 'kǒu', en: 'mouth', examples: ['叫', '吃', '味', '呼'],
          note: 'Anything you do with your mouth — eat, call, taste, ask.' },
        { hanzi: '目', pinyin: 'mù', en: 'eye', examples: ['眼', '眠', '睛', '直'] },
        { hanzi: '自', pinyin: 'zì', en: 'oneself (a nose)' },
        { hanzi: '耳', pinyin: 'ěr', en: 'ear' },
        { hanzi: '足', pinyin: 'zú', en: 'foot', examples: ['跟', '跡', '跪'] },
        { hanzi: '身', pinyin: 'shēn', en: 'body' },
        { hanzi: '頁', pinyin: 'yè', en: 'page; a head', examples: ['頓', '願', '頭'],
          note: 'Deceptive: 頁 means "page" as a word, but inside a character it is a HEAD — 頭 head, 顏 face.' },
        { hanzi: '毛', pinyin: 'máo', en: 'fur; hair' },
        { hanzi: '父', pinyin: 'fù', en: 'father' },
        { hanzi: '母', pinyin: 'mǔ', en: 'mother' }
      ]
    },

    { id: 'bas-rad-l2', title: 'Nature & the elements', zh: '自然', drill: 'radical',
      crossover: { to: 'bas-sounds-l2', why: '西 xī vs 中 zhōng is the j/q/x against zh/ch/sh contrast, on parts you now know.' },
      words: [
        { hanzi: '日', pinyin: 'rì', en: 'sun; day', examples: ['早', '晚', '晨'] },
        { hanzi: '月', pinyin: 'yuè', en: 'moon; month', examples: ['期', '有'],
          note: 'Two parts share this shape: the moon, and a squashed 肉 "flesh" — which is why body-part characters look like they contain a moon.' },
        { hanzi: '火', pinyin: 'huǒ', en: 'fire', examples: ['燈'] },
        { hanzi: '灬', pinyin: 'huǒ', en: 'fire (four flames underneath)', say: '火',
          examples: ['無'] },
        { hanzi: '水', pinyin: 'shuǐ', en: 'water (full form)' },
        { hanzi: '氵', pinyin: 'shuǐ', en: 'water (three drops)', say: '水',
          examples: ['法', '注', '洗', '流', '清', '深'],
          note: 'Three drops on the left = liquids and everything they do: 洗 wash, 流 flow, 深 deep.' },
        { hanzi: '冫', pinyin: 'bīng', en: 'ice (two drops)', say: '冰', examples: ['決'] },
        { hanzi: '山', pinyin: 'shān', en: 'mountain' },
        { hanzi: '川', pinyin: 'chuān', en: 'stream' },
        { hanzi: '土', pinyin: 'tǔ', en: 'earth; soil', examples: ['在', '地', '基'] },
        { hanzi: '石', pinyin: 'shí', en: 'stone', examples: ['碎'] },
        { hanzi: '田', pinyin: 'tián', en: 'field', examples: ['畏'] },
        { hanzi: '雨', pinyin: 'yǔ', en: 'rain', examples: ['需'] },
        { hanzi: '風', pinyin: 'fēng', en: 'wind' },
        { hanzi: '西', pinyin: 'xī', en: 'west' }
      ]
    },

    { id: 'bas-rad-l3', title: 'Plants & animals', zh: '植物與動物', drill: 'radical',
      crossover: { to: 'bas-tones-l1', why: '馬 mǎ is the horse in mā má mǎ mà — the classic four-tone set.' },
      words: [
        { hanzi: '木', pinyin: 'mù', en: 'wood; tree', examples: ['本', '根', '楚', '未'] },
        { hanzi: '禾', pinyin: 'hé', en: 'cereal; growing grain', examples: ['私', '科', '租', '稱'] },
        { hanzi: '米', pinyin: 'mǐ', en: 'rice', examples: ['精', '粹'] },
        { hanzi: '竹', pinyin: 'zhú', en: 'bamboo', examples: ['笑', '管'],
          note: 'Bamboo sits on top, flattened. Books, writing and counting all carry it — bamboo strips were the paper.' },
        { hanzi: '艹', pinyin: 'cǎo', en: 'grass (two shoots on top)', say: '草' },
        { hanzi: '犬', pinyin: 'quǎn', en: 'dog; animal (full form)' },
        { hanzi: '犭', pinyin: 'quǎn', en: 'animal (at the side)', say: '犬', examples: ['猶', '犯'] },
        { hanzi: '牛', pinyin: 'niú', en: 'ox; cow', examples: ['物', '牲'] },
        { hanzi: '豕', pinyin: 'shǐ', en: 'pig', examples: ['家'],
          note: 'A pig under a roof is 家 — home. Livestock indoors was what made a house a household.' },
        { hanzi: '馬', pinyin: 'mǎ', en: 'horse' },
        { hanzi: '羊', pinyin: 'yáng', en: 'sheep' },
        { hanzi: '鳥', pinyin: 'niǎo', en: 'bird' },
        { hanzi: '隹', pinyin: 'zhuī', en: 'a short-tailed bird', examples: ['雄'] },
        { hanzi: '魚', pinyin: 'yú', en: 'fish' },
        { hanzi: '虫', pinyin: 'chóng', en: 'bug; insect' },
        { hanzi: '龍', pinyin: 'lóng', en: 'dragon' },
        { hanzi: '羽', pinyin: 'yǔ', en: 'feather', examples: ['翁'] }
      ]
    },

    { id: 'bas-rad-l4', title: 'Faith, words & money', zh: '信仰・言・財', drill: 'radical',
      words: [
        { hanzi: '示', pinyin: 'shì', en: 'deity; to show (full form)' },
        { hanzi: '礻', pinyin: 'shì', en: 'deity (at the side)', say: '示',
          examples: ['祈', '神'],
          note: 'The part to know for this book: 神 God, 祈 pray, 福 blessing, 禮 rite, 禱 supplication.' },
        { hanzi: '衣', pinyin: 'yī', en: 'clothing (full form)', examples: ['表'] },
        { hanzi: '衤', pinyin: 'yī', en: 'clothing (at the side)', say: '衣', examples: ['複'],
          note: 'One stroke from 礻 DEITY, and worth the care: 被 (clothing) is not 神 (deity).' },
        { hanzi: '言', pinyin: 'yán', en: 'words; speech',
          examples: ['計', '討', '設', '許', '訴', '講'],
          note: 'Saying, asking, arguing, promising — the most common part in a book of doctrine.' },
        { hanzi: '貝', pinyin: 'bèi', en: 'money; a seashell', examples: ['責', '貴', '質'],
          note: 'Cowrie shells were the currency, so 貝 marks value, cost, buying and debt.' },
        { hanzi: '見', pinyin: 'jiàn', en: 'to see' },
        { hanzi: '鬼', pinyin: 'guǐ', en: 'devil; ghost', examples: ['魂'] }
      ]
    },

    { id: 'bas-rad-l5', title: 'Tools & things', zh: '器物', drill: 'radical',
      words: [
        { hanzi: '力', pinyin: 'lì', en: 'strength', examples: ['勇', '動', '務'] },
        { hanzi: '刀', pinyin: 'dāo', en: 'knife (full form)', examples: ['切', '分'] },
        { hanzi: '刂', pinyin: 'dāo', en: 'knife (standing at the right)', say: '刀',
          examples: ['列', '刑', '判', '到', '剝'],
          note: 'Cutting, dividing, judging, punishing — anything with an edge to it.' },
        { hanzi: '工', pinyin: 'gōng', en: 'work', examples: ['巨'] },
        { hanzi: '王', pinyin: 'wáng', en: 'king; jade', examples: ['球'] },
        { hanzi: '士', pinyin: 'shì', en: 'scholar' },
        { hanzi: '門', pinyin: 'mén', en: 'door; gate', examples: ['開'] },
        { hanzi: '戶', pinyin: 'hù', en: 'household; a one-leaf door', examples: ['房', '所'] },
        { hanzi: '尸', pinyin: 'shī', en: 'corpse; a "dirty thing"' },
        { hanzi: '車', pinyin: 'chē', en: 'vehicle; cart', examples: ['較', '輩'] },
        { hanzi: '舟', pinyin: 'zhōu', en: 'boat', examples: ['般'] },
        { hanzi: '弓', pinyin: 'gōng', en: 'bow', examples: ['引', '弟', '弱', '張'] },
        { hanzi: '戈', pinyin: 'gē', en: 'spear; halberd', examples: ['成', '我'] },
        { hanzi: '巾', pinyin: 'jīn', en: 'cloth', examples: ['市', '希', '帶'] },
        { hanzi: '糸', pinyin: 'sī', en: 'silk; thread', examples: ['紀', '約', '純', '組', '經'],
          note: 'Thread means connection: 經 scripture (the warp of a weave), 結 to tie, 組 to organise.' },
        { hanzi: '網', pinyin: 'wǎng', en: 'net', examples: ['罪', '罕'],
          note: 'Flattened to 罒 on top. A net over something is trouble: 罪 sin, 罰 punishment.' },
        { hanzi: '皿', pinyin: 'mǐn', en: 'utensil; dish' },
        { hanzi: '用', pinyin: 'yòng', en: 'use' },
        { hanzi: '角', pinyin: 'jiǎo', en: 'horn; angle' },
        { hanzi: '皮', pinyin: 'pí', en: 'skin' },
        { hanzi: '金', pinyin: 'jīn', en: 'metal; gold', examples: ['釘', '鋒'] }
      ]
    },

    { id: 'bas-rad-l6', title: 'Actions, states & colours', zh: '動作・狀態・顏色', drill: 'radical',
      crossover: { to: 'bas-sounds-l5', why: '光 guāng is one of the -uang glides drilled over in Phonics.' },
      words: [
        { hanzi: '立', pinyin: 'lì', en: 'to stand', examples: ['產'] },
        { hanzi: '走', pinyin: 'zǒu', en: 'to walk', examples: ['起', '越'] },
        { hanzi: '辶', pinyin: 'chuò', en: 'movement (a short walk)', say: '走',
          examples: ['迎', '近', '述', '追', '退', '逃', '通'],
          note: 'The sweeping stroke underneath means going somewhere: 進 advance, 退 retreat, 道 the way.' },
        { hanzi: '止', pinyin: 'zhǐ', en: 'to stop; a foot', examples: ['正', '此', '武'] },
        { hanzi: '文', pinyin: 'wén', en: 'writing; academic' },
        { hanzi: '欠', pinyin: 'qiàn', en: 'to owe; to yawn', examples: ['欣'] },
        { hanzi: '食', pinyin: 'shí', en: 'food; to eat', examples: ['飢', '飽'] },
        { hanzi: '舌', pinyin: 'shé', en: 'tongue' },
        { hanzi: '白', pinyin: 'bái', en: 'white', examples: ['的'] },
        { hanzi: '黑', pinyin: 'hēi', en: 'black' },
        { hanzi: '赤', pinyin: 'chì', en: 'red' },
        { hanzi: '光', pinyin: 'guāng', en: 'light' },
        { hanzi: '革', pinyin: 'gé', en: 'leather' }
      ]
    }
  ]
});
