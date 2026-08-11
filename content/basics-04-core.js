// Basics 4 — Everyday Words. The glue Course 101 assumes you already have: it
// teaches 救贖 and 創造 but never stops to teach 不, 很, 個 or how to say a date.
//
// No `drill` here — these are ordinary vocabulary, so they get the normal learn
// parts plus a no-pinyin 📖 Reading part. They stay `aux` (out of the Course 101
// distractor pool) purely for consistency within the book; progress is shared by
// hanzi as everywhere else, so a word met here counts if it turns up in a chapter.
window.C101.register({
  bookId: 'basics',
  track: 'phonics',
  aux: true,

  id: 'bas-core',
  title: 'Everyday Words',
  zh: '常用詞',
  lessons: [
    { id: 'bas-core-l1', title: 'Numbers 1–10', zh: '數字',
      words: [
        { hanzi: '一', pinyin: 'yī',  en: 'one' },
        { hanzi: '二', pinyin: 'èr',  en: 'two' },
        { hanzi: '三', pinyin: 'sān', en: 'three' },
        { hanzi: '四', pinyin: 'sì',  en: 'four' },
        { hanzi: '五', pinyin: 'wǔ',  en: 'five' },
        { hanzi: '六', pinyin: 'liù', en: 'six' },
        { hanzi: '七', pinyin: 'qī',  en: 'seven' },
        { hanzi: '八', pinyin: 'bā',  en: 'eight' },
        { hanzi: '九', pinyin: 'jiǔ', en: 'nine' },
        { hanzi: '十', pinyin: 'shí', en: 'ten' }
      ]
    },

    { id: 'bas-core-l2', title: 'Bigger numbers', zh: '大數',
      words: [
        { hanzi: '零',   pinyin: 'líng',     en: 'zero' },
        { hanzi: '百',   pinyin: 'bǎi',      en: 'hundred' },
        { hanzi: '千',   pinyin: 'qiān',     en: 'thousand' },
        { hanzi: '萬',   pinyin: 'wàn',      en: 'ten thousand' },
        { hanzi: '億',   pinyin: 'yì',       en: 'hundred million' },
        { hanzi: '兩',   pinyin: 'liǎng',    en: 'two (of something — used before a measure word)' },
        { hanzi: '半',   pinyin: 'bàn',      en: 'half' },
        { hanzi: '多少', pinyin: 'duō shǎo', en: 'how many; how much' },
        { hanzi: '第',   pinyin: 'dì',       en: '(prefix making a number ordinal: 第一 first)' }
      ]
    },

    // Chinese dates run big-to-small: year, month, day. 二〇二五年三月四日.
    { id: 'bas-core-l3', title: 'Time & dates', zh: '時間',
      words: [
        { hanzi: '年',   pinyin: 'nián',     en: 'year' },
        { hanzi: '月',   pinyin: 'yuè',      en: 'month; moon' },
        { hanzi: '日',   pinyin: 'rì',       en: 'day; sun (formal, for dates)' },
        { hanzi: '號',   pinyin: 'hào',      en: 'day of the month (spoken)' },
        { hanzi: '星期', pinyin: 'xīng qí',  en: 'week' },
        { hanzi: '今天', pinyin: 'jīn tiān', en: 'today' },
        { hanzi: '明天', pinyin: 'míng tiān', en: 'tomorrow' },
        { hanzi: '昨天', pinyin: 'zuó tiān', en: 'yesterday' },
        { hanzi: '小時', pinyin: 'xiǎo shí', en: 'hour' },
        { hanzi: '分鐘', pinyin: 'fēn zhōng', en: 'minute' },
        { hanzi: '現在', pinyin: 'xiàn zài', en: 'now' }
      ]
    },

    { id: 'bas-core-l4', title: 'Everyday glue', zh: '常用字',
      words: [
        { hanzi: '是',   pinyin: 'shì',     en: 'to be; yes' },
        { hanzi: '不',   pinyin: 'bù',      en: 'not' },
        { hanzi: '有',   pinyin: 'yǒu',     en: 'to have; there is' },
        { hanzi: '沒有', pinyin: 'méi yǒu', en: 'to not have; there is not' },
        { hanzi: '很',   pinyin: 'hěn',     en: 'very' },
        { hanzi: '也',   pinyin: 'yě',      en: 'also; too' },
        { hanzi: '都',   pinyin: 'dōu',     en: 'all; both' },
        { hanzi: '和',   pinyin: 'hé',      en: 'and; with' },
        { hanzi: '在',   pinyin: 'zài',     en: 'at; in; to be located at' },
        { hanzi: '這',   pinyin: 'zhè',     en: 'this' },
        { hanzi: '那',   pinyin: 'nà',      en: 'that' },
        { hanzi: '嗎',   pinyin: 'ma',      en: '(turns a statement into a yes/no question)' }
      ]
    },

    // Counting anything needs a measure word between the number and the noun —
    // 一個人, never 一人. 個 is the fallback when you can't recall the right one.
    { id: 'bas-core-l5', title: 'Measure words', zh: '量詞',
      words: [
        { hanzi: '個', pinyin: 'gè',   en: '(general measure word — the safe default)' },
        { hanzi: '位', pinyin: 'wèi',  en: '(measure word for people, politely)' },
        { hanzi: '本', pinyin: 'běn',  en: '(measure word for books)' },
        { hanzi: '張', pinyin: 'zhāng', en: '(measure word for flat things: paper, tables)' },
        { hanzi: '隻', pinyin: 'zhī',  en: '(measure word for animals)' },
        { hanzi: '件', pinyin: 'jiàn', en: '(measure word for matters and garments)' },
        { hanzi: '條', pinyin: 'tiáo', en: '(measure word for long thin things: roads, fish)' },
        { hanzi: '次', pinyin: 'cì',   en: '(measure word for times/occurrences)' }
      ]
    },

    { id: 'bas-core-l6', title: 'People & pronouns', zh: '人稱',
      words: [
        { hanzi: '我',   pinyin: 'wǒ',      en: 'I; me' },
        { hanzi: '你',   pinyin: 'nǐ',      en: 'you' },
        { hanzi: '他',   pinyin: 'tā',      en: 'he; him' },
        { hanzi: '她',   pinyin: 'tā',      en: 'she; her' },
        { hanzi: '我們', pinyin: 'wǒ men',  en: 'we; us' },
        { hanzi: '你們', pinyin: 'nǐ men',  en: 'you (plural)' },
        { hanzi: '他們', pinyin: 'tā men',  en: 'they; them' },
        { hanzi: '誰',   pinyin: 'shéi',    en: 'who' },
        { hanzi: '什麼', pinyin: 'shén me', en: 'what' },
        { hanzi: '名字', pinyin: 'míng zì', en: 'name' }
      ]
    }
  ]
});
