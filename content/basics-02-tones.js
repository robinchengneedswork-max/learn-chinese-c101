// Basics 2 — Tones. `drill: 'tone'` asks session.js for the tone drill: hear the
// word, then pick the tone it carries. The options are generated — the word's own
// syllables respelled under each candidate tone (mā / má / mǎ / mà / ma), so the
// choice is between real pinyin rather than abstract numbers. Nothing here needs
// per-word option data; src/pinyin.js reads the tone off the `pinyin` field, so
// the ONLY thing that must be right in this file is the tone mark itself.
//
// Two-syllable entries drill the tone *pattern*, which is the part that stays
// hard long after the individual tones are easy. Some of them (生命, 聖經, 世界)
// are Course 101 vocabulary on purpose: word progress is keyed by hanzi and
// shared across books, so drilling their tones here also feeds their SRS record
// in Chapter 1.
window.C101.register({
  bookId: 'basics',
  track: 'phonics',
  aux: true,

  id: 'bas-tones',
  title: 'Tones',
  zh: '聲調',
  lessons: [
    // The canonical demonstration set: one syllable, five meanings.
    { id: 'bas-tones-l1', title: 'The four tones (+ neutral)', zh: '四聲', drill: 'tone',
      words: [
        { hanzi: '媽', pinyin: 'mā', en: 'mother' },
        { hanzi: '麻', pinyin: 'má', en: 'hemp; numb' },
        { hanzi: '馬', pinyin: 'mǎ', en: 'horse' },
        { hanzi: '罵', pinyin: 'mà', en: 'to scold; to curse' },
        { hanzi: '嗎', pinyin: 'ma', en: '(question particle)' }
      ]
    },

    { id: 'bas-tones-l2', title: 'First & second tone', zh: '一聲與二聲', drill: 'tone',
      words: [
        { hanzi: '花', pinyin: 'huā',  en: 'flower' },
        { hanzi: '說', pinyin: 'shuō', en: 'to say; to speak' },
        { hanzi: '三', pinyin: 'sān',  en: 'three' },
        { hanzi: '來', pinyin: 'lái',  en: 'to come' },
        { hanzi: '人', pinyin: 'rén',  en: 'person; people' },
        { hanzi: '神', pinyin: 'shén', en: 'God; deity' },
        { hanzi: '王', pinyin: 'wáng', en: 'king' },
        { hanzi: '明', pinyin: 'míng', en: 'bright; clear' }
      ]
    },

    { id: 'bas-tones-l3', title: 'Third & fourth tone', zh: '三聲與四聲', drill: 'tone',
      crossover: { to: 'bas-rad-l1', why: '大 dà and 手 shǒu are drilled here for tone and there for shape.' },
      words: [
        { hanzi: '我', pinyin: 'wǒ',   en: 'I; me' },
        { hanzi: '好', pinyin: 'hǎo',  en: 'good; well' },
        { hanzi: '你', pinyin: 'nǐ',   en: 'you' },
        { hanzi: '水', pinyin: 'shuǐ', en: 'water' },
        { hanzi: '大', pinyin: 'dà',   en: 'big; great' },
        { hanzi: '愛', pinyin: 'ài',   en: 'to love; love' },
        { hanzi: '看', pinyin: 'kàn',  en: 'to look; to watch' },
        { hanzi: '手', pinyin: 'shǒu', en: 'hand' }
      ]
    },

    // Tone PAIRS. A word is not two tones played in sequence — the pattern is the
    // unit you actually remember, and it's what you get wrong when the syllables
    // are each fine on their own.
    { id: 'bas-tones-l4', title: 'Tone pairs', zh: '雙音節聲調', drill: 'tone',
      words: [
        { hanzi: '中國', pinyin: 'zhōng guó', en: 'China' },
        { hanzi: '老師', pinyin: 'lǎo shī',   en: 'teacher' },
        { hanzi: '學生', pinyin: 'xué shēng', en: 'student' },
        { hanzi: '朋友', pinyin: 'péng yǒu',  en: 'friend' },
        { hanzi: '謝謝', pinyin: 'xiè xie',   en: 'thank you' },
        { hanzi: '生命', pinyin: 'shēng mìng', en: 'life (of a living being)' },
        { hanzi: '聖經', pinyin: 'shèng jīng', en: 'the Bible; scripture' },
        { hanzi: '世界', pinyin: 'shì jiè',    en: 'world' }
      ]
    }
  ]
});

// ---- Reference: tone changes -----------------------------------------------
// Sandhi is a READING rule, not a recall item: the tone written is not the tone
// spoken, so drilling it as a question would contradict the drills above (which
// grade the written tone). It belongs in the Reference area — look it up, don't
// get quizzed on it. Rows are "what you see → what you say".
window.C101.registerReference({
  bookId: 'basics',
  id: 'bas-tone-changes',
  icon: '🎵',
  title: 'Tone changes',
  zh: '變調',
  kind: 'table',
  intro: 'Some tones shift depending on what follows them. The writing keeps the original tone — the change is only in the mouth, so these are rules for reading aloud, not spelling.',
  groups: [
    { title: 'Third tone before third tone', rows: [
      { hz: '你好', name: 'nǐ hǎo → ní hǎo — hello' },
      { hz: '很好', name: 'hěn hǎo → hén hǎo — very good' },
      { hz: '所以', name: 'suǒ yǐ → suó yǐ — therefore' }
    ]},
    { title: 'Third tone before any other tone', rows: [
      { hz: '好人', name: 'hǎo rén — a half-third: it dips and stays low, no rise' },
      { hz: '我們', name: 'wǒ men — same; the full dip-and-rise is rare in running speech' }
    ]},
    { title: '不 bù before a fourth tone', rows: [
      { hz: '不是', name: 'bù shì → bú shì — is not' },
      { hz: '不要', name: 'bù yào → bú yào — do not want' },
      { hz: '不好', name: 'bù hǎo — unchanged: 好 is third tone' }
    ]},
    { title: '一 yī before other tones', rows: [
      { hz: '一天', name: 'yī tiān → yì tiān — one day (before 1st/2nd/3rd)' },
      { hz: '一個', name: 'yī gè → yí gè — one (before a 4th tone)' },
      { hz: '第一', name: 'dì yī — unchanged when it is an ordinal or stands alone' }
    ]}
  ]
});
