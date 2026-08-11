// Basics 1 — Sounds & Pinyin. The first chapter of the optional **Basics** book
// (bookId 'basics'): the sounds Mandarin makes that English doesn't distinguish,
// drilled by ear.
//
// `drill: 'sound'` asks session.js for the listening drill (hear it, pick the
// spelling) instead of the usual vocabulary session. Its multiple-choice options
// are drawn from the SAME LESSON, which is why every lesson here is a deliberate
// contrast set: the distractors are the near-misses, so the item is a real
// discrimination rather than a guess between unrelated syllables. Choose words
// for a lesson accordingly — one row per side of the contrast.
//
// `aux: true` keeps these bare syllables out of the Course 101 / GNR distractor
// pools (see src/content.js); `bookOpen: true` leaves every node unlocked, since
// Basics is a toolbox you dip into, not a course you walk end to end.
window.C101.register({
  bookId: 'basics',
  // Basics runs as two parallel tracks (see README "Books (modules)"). Only the
  // first chapter of each needs to name it, exactly as with the book metadata.
  track: 'phonics', trackTitle: 'Phonics', trackZh: '發音',
  bookTitle: 'Basics',
  bookZh: '基礎',
  bookTagline: 'Basics: the sounds, tones, character parts and everyday words the book assumes',
  bookOpen: true,
  aux: true,

  id: 'bas-sounds',
  title: 'Sounds & Pinyin',
  zh: '發音與拼音',
  lessons: [
    // The classic wall for English speakers: the retroflex series (tongue curled
    // back) against the plain one. Same vowel on both sides, so only the initial
    // can tell them apart.
    { id: 'bas-sounds-l1', title: 'zh · ch · sh vs z · c · s', zh: '捲舌音', drill: 'sound',
      words: [
        { hanzi: '知', pinyin: 'zhī', en: 'to know' },
        { hanzi: '自', pinyin: 'zì',  en: 'self; oneself' },
        { hanzi: '吃', pinyin: 'chī', en: 'to eat' },
        { hanzi: '詞', pinyin: 'cí',  en: 'word; term' },
        { hanzi: '十', pinyin: 'shí', en: 'ten' },
        { hanzi: '思', pinyin: 'sī',  en: 'to think' },
        { hanzi: '是', pinyin: 'shì', en: 'to be' },
        { hanzi: '死', pinyin: 'sǐ',  en: 'to die' }
      ]
    },

    // The palatal series. j/q/x are made at the front of the mouth with a spread
    // smile; zh/ch/sh at the back with the tongue curled. English hears both as
    // "j / ch / sh", which is exactly the problem.
    { id: 'bas-sounds-l2', title: 'j · q · x vs zh · ch · sh', zh: '舌面音', drill: 'sound',
      crossover: { to: 'bas-rad-l2', why: '西 xī and 山 shān are both character parts — meet them again as building blocks.' },
      words: [
        { hanzi: '家', pinyin: 'jiā',   en: 'home; family' },
        { hanzi: '七', pinyin: 'qī',    en: 'seven' },
        { hanzi: '西', pinyin: 'xī',    en: 'west' },
        { hanzi: '中', pinyin: 'zhōng', en: 'middle; centre' },
        { hanzi: '出', pinyin: 'chū',   en: 'to go out' },
        { hanzi: '書', pinyin: 'shū',   en: 'book' },
        { hanzi: '常', pinyin: 'cháng', en: 'often; constant' },
        { hanzi: '山', pinyin: 'shān',  en: 'mountain' }
      ]
    },

    // -n closes on the tongue tip, -ng at the back of the throat. The pair is
    // meaning-bearing in Chinese and inaudible to most English speakers at first.
    { id: 'bas-sounds-l3', title: 'Final -n vs -ng', zh: '前鼻音與後鼻音', drill: 'sound',
      crossover: { to: 'bas-rad-l1', why: '心 xīn, the -n half of this pair, is also one of the commonest parts in the book.' },
      words: [
        { hanzi: '心', pinyin: 'xīn',   en: 'heart' },
        { hanzi: '星', pinyin: 'xīng',  en: 'star' },
        { hanzi: '分', pinyin: 'fēn',   en: 'to divide; minute' },
        { hanzi: '風', pinyin: 'fēng',  en: 'wind' },
        { hanzi: '真', pinyin: 'zhēn',  en: 'true; real' },
        { hanzi: '爭', pinyin: 'zhēng', en: 'to contend; to strive' },
        { hanzi: '天', pinyin: 'tiān',  en: 'sky; heaven; day' },
        { hanzi: '聽', pinyin: 'tīng',  en: 'to listen' }
      ]
    },

    // ü (the "umlaut u": say "ee" and round your lips) against plain u. Written
    // without its dots after j/q/x/y, which is why 去 looks like "qu" but isn't.
    { id: 'bas-sounds-l4', title: 'ü vs u', zh: 'ü 與 u', drill: 'sound',
      crossover: { to: 'bas-rad-l2', why: '雨 yǔ and 月 yuè are parts as well as sounds — 雨 tops every weather character.' },
      words: [
        { hanzi: '女', pinyin: 'nǚ',   en: 'woman; female' },
        { hanzi: '魚', pinyin: 'yú',   en: 'fish' },
        { hanzi: '雨', pinyin: 'yǔ',   en: 'rain' },
        { hanzi: '五', pinyin: 'wǔ',   en: 'five' },
        { hanzi: '路', pinyin: 'lù',   en: 'road; way' },
        { hanzi: '綠', pinyin: 'lǜ',   en: 'green' },
        { hanzi: '月', pinyin: 'yuè',  en: 'moon; month' },
        { hanzi: '遠', pinyin: 'yuǎn', en: 'far; distant' }
      ]
    },

    // Glides. The medial -i- and -u- are easy to drop entirely when reading fast,
    // which turns 錢 into 前-ish mush; these force you to hear them.
    { id: 'bas-sounds-l5', title: 'Glides: -ian · -iang · -uan · -uang', zh: '介音', drill: 'sound',
      words: [
        { hanzi: '錢', pinyin: 'qián',  en: 'money' },
        { hanzi: '強', pinyin: 'qiáng', en: 'strong' },
        { hanzi: '先', pinyin: 'xiān',  en: 'first; earlier' },
        { hanzi: '想', pinyin: 'xiǎng', en: 'to think; to want' },
        { hanzi: '關', pinyin: 'guān',  en: 'to close; to shut' },
        { hanzi: '光', pinyin: 'guāng', en: 'light' },
        { hanzi: '全', pinyin: 'quán',  en: 'whole; complete' },
        { hanzi: '群', pinyin: 'qún',   en: 'group; crowd' }
      ]
    }
  ]
});
