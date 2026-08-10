// headless.js — logic-only tests for the C101 engine (no DOM/browser).
// Loads config/content/chapter/state/srs/session in a shared vm scope and
// simulates full sessions. Run: npm test
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// Every content file, in index.html's order — the Basics radical drill draws its
// example characters from the WHOLE graded corpus (Course 101 + Good News
// Reader), so a test loading only Chapter 1 would report real examples as stray.
const files = [
  'src/config.js', 'src/content.js', 'content/chapter-01.js',
  'content/gnr-chapter-01.js', 'content/gnr-chapter-02.js', 'content/gnr-chapter-03.js',
  'content/gnr-chapter-04.js', 'content/gnr-chapter-05.js', 'content/gnr-chapter-06.js',
  'content/gnr-chapter-07.js',
  'content/basics-01-sounds.js', 'content/basics-02-tones.js',
  'content/basics-03-radicals.js', 'content/basics-04-core.js',
  'src/pinyin.js', 'src/state.js', 'src/srs.js', 'src/session.js'
];
const src = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');

// minimal browser shims
const store = new Map();
const sandbox = {
  window: {},
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  },
  Date, Math, JSON, console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
// expose the module globals we need back onto the sandbox for the test tail
vm.runInContext(src + '\n;globalThis.__api = { CONFIG, C101, State, SRS, Session, Pinyin };', sandbox);
const { CONFIG, C101, State, SRS, Session, Pinyin } = sandbox.__api;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name); }
}

State.load();

// --- content loaded correctly
ok('one chapter in the current book', C101.chapters().length === 1);
ok('16 lessons', C101.chapter('ch01').lessons.length === 16);
ok('228 words in chapter 1',
   new Set(C101.chapter('ch01').lessons.flatMap(l => l.words.map(w => w.hanzi))).size === 228);
ok('805 words in the graded corpus', C101.allWords().length === 805);
ok('every word has pinyin+en', C101.allWords().every(w => w.pinyin && w.en && w.pinyin !== '?'));
ok('word lookup works', C101.word('生命').en.startsWith('life'));

// --- sections split into bite-size parts (learn parts + a reading part)
const l1 = C101.lesson('ch01-l1a');
const l1parts = C101.parts(l1);
const learnParts = l1parts.filter(p => p.kind === 'learn');
const readParts = l1parts.filter(p => p.kind === 'reading');
const clozeParts = l1parts.filter(p => p.kind === 'cloze');
ok('section -> ceil(words/PART_SIZE) learn parts + reading + sentences',
   l1parts.length === Math.ceil(l1.words.length / CONFIG.PART_SIZE) + 1 + clozeParts.length);
ok('section with sentences gets one cloze part', clozeParts.length === 1);
ok('cloze part carries its sentences', clozeParts[0].sentences.length > 0);
ok('every section blank is taught by that section', C101.lessons().every(les => {
  const own = new Set(les.words.map(w => w.hanzi));
  return (les.sentences || []).every(s => own.has(s.blank) &&
                                          s.zh.split(s.blank).length === 2);
}));
// the sentence node mixes fill-the-gap with building the whole line
{
  const cs = Session.forPart(clozeParts[0]);
  const kinds = cs.queue.map(i => i.kind);
  ok('sentence session has items', cs.total > 0);
  ok('sentence session has cloze items', kinds.indexOf('cloze') >= 0);
  ok('sentence session has build items', kinds.indexOf('build') >= 0);
  ok('sentence session ends with a dictation',
     cs.queue[cs.queue.length - 1].kind === 'dictate');
  ok('cloze options always include the answer',
     cs.queue.filter(i => i.kind === 'cloze')
             .every(i => i.options.indexOf(i.correct) >= 0));
  const builds = cs.queue.filter(i => i.kind === 'build' || i.kind === 'dictate');
  ok('build tiles contain every token of the answer',
     builds.every(i => i.sentence.tokens.every(t => i.tiles.indexOf(t) >= 0)));
  ok('build tiles add decoys', builds.every(i => i.tiles.length > i.sentence.tokens.length));
  ok('joining the tokens reproduces the sentence',
     builds.every(i => i.correct === i.sentence.tokens.join('')));
  let g = 0;
  while (!cs.done && g++ < 500) cs.answer(cs.current().correct);
  ok('sentence session completes all-correct', cs.done && cs.missed === 0);
}
// a wrong sentence build is requeued, not silently passed
{
  const cs = Session.forPart(clozeParts[0]);
  const bi = cs.queue.findIndex(i => i.kind === 'build');
  while (cs.idx < bi) cs.answer(cs.current().correct);
  const before = cs.queue.length;
  cs.answer('这不是答案');
  ok('wrong build requeues a fresh attempt', cs.queue.length === before + 1);
  ok('requeued item is another build', cs.queue[cs.queue.length - 1].kind === 'build');
}
// typed recall + the pairs warm-up
{
  store.clear(); State.reset(); State.load();
  const w = C101.word('生命');
  SRS.grade('生命', true);              // no longer brand-new → earns a typed item
  const part = { id: 'tmp', kind: 'learn', title: 't', zh: 't', words: [w] };
  const ts = Session.forPart(part);
  const typed = ts.queue.find(i => i.kind === 'type');
  ok('seen words get a typed-recall item', !!typed);
  ok('typed recall accepts tone-tolerant pinyin', Session.pinyinMatches('shengming', w));
  ok('typed recall accepts the hanzi', Session.pinyinMatches('生命', w));
  ok('typed recall rejects a wrong answer', !Session.pinyinMatches('zaijian', w));
}
{
  store.clear(); State.reset(); State.load();
  const ps = Session.forPart(C101.parts(C101.lesson('ch01-l1a'))[0]);
  const board = ps.queue.find(i => i.kind === 'pairs');
  ok('a learn part opens with a pairs warm-up', !!board);
  ok('pairs board holds several words', board.words.length >= 4);
  const boxBefore = (State.get().words[board.words[0].hanzi] || {}).box;
  while (ps.current().kind !== 'pairs') ps.answer(null);
  ps.answer(true);
  ok('clearing the board does not promote SRS',
     ((State.get().words[board.words[0].hanzi] || {}).box) === boxBefore);
}
ok('learn parts cover all section words',
   learnParts.reduce((n, p) => n + p.words.length, 0) === l1.words.length);
ok('one reading part with all words', readParts.length === 1 && readParts[0].words.length === l1.words.length);
ok('each learn part is <= PART_SIZE', learnParts.every(p => p.words.length <= CONFIG.PART_SIZE));

// --- reading part session: MC only, no intro, mode 'reading'
const rSess = Session.forPart(readParts[0]);
ok('reading session has no intro cards', rSess.queue.every(i => i.kind !== 'intro'));
ok('reading session marked mode reading', rSess.mode === 'reading');
ok('reading MC items carry reading mode',
   rSess.queue.filter(i => i.kind === 'zh2en' || i.kind === 'en2zh')
              .every(i => i.mode === 'reading'));
// passage clozes: the book's own sentence, a taught word removed, no translation
{
  const pc = rSess.queue.filter(i => i.kind === 'cloze');
  ok('reading part includes passage clozes', pc.length > 0);
  ok('passage clozes have no English clue', pc.every(i => !i.en));
  ok('passage cloze blank appears once in its sentence',
     pc.every(i => i.zh.split(i.correct).length === 2));
  ok('passage cloze text comes from the section passage',
     pc.every(i => l1.reading.zh.indexOf(i.zh.replace(/[。！？；!?;]+$/, '')) >= 0));
  ok('passage cloze is a single sentence, not two run together',
     pc.every(i => !/[。！？!?][^]/.test(i.zh)));
}

// --- chapter test: one cloze per sentence, correct is among options
const ch = C101.chapter('ch01');
ok('chapter has test sentences', C101.sentences('ch01').length > 0);
ok('every cloze blank appears in its sentence',
   C101.sentences('ch01').every(s => s.zh.indexOf(s.blank) >= 0 && C101.word(s.blank)));
const tSess = Session.forTest(ch);
ok('test builds one cloze per sentence', tSess.total === C101.sentences('ch01').length);
ok('all test items are cloze', tSess.queue.every(i => i.kind === 'cloze'));
ok('cloze correct is among its options', tSess.queue.every(i => i.options.indexOf(i.correct) >= 0));

// --- pinyin matching (typed answers): tone-tolerant + hanzi accepted
const bible = C101.word('聖經');
ok('toneless pinyin matches', Session.pinyinMatches('shengjing', bible));
ok('typed hanzi matches', Session.pinyinMatches('聖經', bible));
ok('wrong pinyin rejected', !Session.pinyinMatches('nihao', bible));

// --- a full chapter test answering everything correctly completes + gives XP
store.clear(); State.reset(); State.load();
let ts = Session.forTest(ch);
let tguard = 0;
while (!ts.done && tguard++ < 1000) { ts.answer(ts.current().correct); }
ok('chapter test completes', ts.done);
ok('chapter test awards XP', State.get().xp > 0);

// --- all words start "new"
store.clear(); State.reset(); State.load();
ok('words start new', C101.allWords().every(w => SRS.isNew(w.hanzi)));

// --- run a full lesson answering everything correctly
const lesson = C101.lesson('ch01-l1a');
let s = Session.forLesson(lesson);
ok('session has intro cards for new words', s.queue.some(i => i.kind === 'intro'));
let guard = 0;
while (!s.done && guard++ < 1000) {
  const item = s.current();
  s.answer(item.kind === 'intro' ? null : item.correct);
}
ok('all-correct session completes', s.done);
ok('no words missed when all correct', s.missed === 0);
ok('lesson words no longer new', lesson.words.every(w => !SRS.isNew(w.hanzi)));
ok('xp accrued', State.get().xp > 0);
ok('streak set', State.get().streak >= 1);

// --- a wrong answer demotes/ requeues
store.clear(); State.reset(); State.load();
const l2 = C101.lesson('ch01-l2a');
s = Session.forLesson(l2);
// answer first multiple-choice item wrong (skip intros and the pairs warm-up)
let firstQuiz = null;
while (!s.done) {
  const item = s.current();
  if (item.kind === 'intro') { s.answer(null); continue; }
  if (item.kind === 'pairs') { s.answer(true); continue; }
  firstQuiz = item; break;
}
const wrongChoice = firstQuiz.options.find(o => o !== firstQuiz.correct);
const beforeLen = s.queue.length;
s.answer(wrongChoice);
ok('wrong answer requeues item', s.queue.length === beforeLen + 1);
ok('wrong answer recorded', State.get().words[firstQuiz.hanzi].wrong === 1);

// --- SRS scheduling math
store.clear(); State.reset(); State.load();
SRS.grade('生命', true);
ok('correct moves to box 1', State.get().words['生命'].box === 1);
ok('box1 due ~4h out', Math.abs(State.get().words['生命'].due - (Date.now() + CONFIG.SRS_INTERVALS[1])) < 2000);
SRS.grade('生命', false);
ok('wrong demotes box', State.get().words['生命'].box === 0);

// --- path progression: clearing a part's session marks it cleared (gating)
store.clear(); State.reset(); State.load();
const p1 = C101.parts(C101.lesson('ch01-l1a'))[0];
ok('part starts uncleared', !State.partCleared(p1.id));
let ps = Session.forPart(p1);
let pguard = 0;
while (!ps.done && pguard++ < 2000) {
  const item = ps.current();
  ps.answer(item.kind === 'intro' ? null : item.correct);
}
ok('finishing a part clears it', State.partCleared(p1.id));
ok('cleared part records best accuracy', State.partBestAcc(p1.id) > 0);
ok('an untouched part stays locked (uncleared)',
   !State.partCleared(C101.parts(C101.lesson('ch01-l2a'))[0].id));
ok('review sessions never clear a node', !State.partCleared('review'));

// --- review session pulls due words
store.clear(); State.reset(); State.load();
// make one word due in the past
SRS.grade('宇宙', true);
State.get().words['宇宙'].due = Date.now() - 1000;
ok('due word detected', SRS.dueWords().some(w => w.hanzi === '宇宙'));
const rev = Session.forReview();
ok('review session built from due words', rev.total >= 1);

// ============================================================================
// Basics book — sounds, tones, radicals, everyday words
// ============================================================================
store.clear(); State.reset(); State.load();

const basics = C101.books().find(b => b.id === 'basics');
ok('basics book registered', !!basics);
ok('basics is an open path (no gating)', basics.open === true);
ok('basics has four chapters', basics.chapters.length === 4);

// --- isolation: aux words are real study items but out of the graded corpus
{
  const corpus = new Set(C101.allWords().map(w => w.hanzi));
  ok('aux words stay out of the graded corpus', !corpus.has('氵') && !corpus.has('亻'));
  ok('graded corpus is unchanged by the Basics book', C101.allWords().length === 805);
  ok('aux words are still looked up by hanzi', !!C101.word('氵') && C101.word('氵').en.includes('water'));
  // A word the real book already teaches is NOT shadowed by the Basics copy.
  ok('a shared word keeps its Course 101 record', C101.word('生命').chapterId === 'ch01');

  // The point of the isolation: no Course 101 question may offer a radical or a
  // bare tone syllable as a distractor.
  const aux = new Set(C101.auxWords().map(w => w.hanzi));
  let leaked = null;
  for (const les of C101.chapter('ch01').lessons) {
    for (const part of C101.parts(les).filter(p => p.kind === 'learn')) {
      for (const item of Session.forPart(part).queue) {
        for (const o of (item.options || [])) if (aux.has(o)) leaked = o;
      }
    }
  }
  ok('no aux item leaks into a Course 101 lesson', leaked === null);
}

// --- tone drill
{
  store.clear(); State.reset(); State.load();
  ok('tone lessons carry a drill flag', C101.lesson('bas-tones-l1').drill === 'tone');
  const tp = C101.parts(C101.lesson('bas-tones-l1'));
  ok('a drill lesson gets no Reading part', tp.every(p => p.kind !== 'reading'));
  ok('parts carry the drill through', tp.every(p => p.drill === 'tone'));

  const ts2 = Session.forPart(tp[0]);
  const tones = ts2.queue.filter(i => i.kind === 'tone');
  ok('tone part builds tone items', tones.length > 0);
  ok('tone answer is the pattern read off the pinyin',
     tones.every(i => i.correct === Pinyin.pattern(i.word.pinyin)));
  ok('tone options include the answer', tones.every(i => i.options.indexOf(i.correct) >= 0));
  ok('tone options are distinct', tones.every(i => new Set(i.options).size === i.options.length));
  ok('a one-syllable tone item offers all five tones',
     tones.filter(i => i.bases.length === 1).every(i => i.options.length === 5));
  // The options must render as different spellings, or the question is unanswerable.
  ok('tone options spell out differently',
     tones.every(i => new Set(i.options.map(o => Pinyin.spell(i.bases, o))).size === i.options.length));
  // 媽/麻/馬/罵 differ only by tone — exactly what the drill is for.
  ok('the four-tone lesson really is one syllable in four tones',
     new Set(C101.lesson('bas-tones-l1').words.map(w => Pinyin.strip(w.pinyin))).size === 1);

  const tps = Session.forPart(tp[0]);
  let tg = 0;
  while (!tps.done && tg++ < 500) {
    const it = tps.current();
    tps.answer(it.kind === 'intro' ? null : it.correct);
  }
  ok('tone session completes all-correct', tps.done && tps.missed === 0);

  // Two-syllable words drill the PATTERN.
  const pairPart = C101.parts(C101.lesson('bas-tones-l4'))[0];
  const pairItems = Session.forPart(pairPart).queue.filter(i => i.kind === 'tone');
  ok('tone pairs produce two-part patterns', pairItems.every(i => i.correct.indexOf('-') > 0));
  ok('生命 is drilled as 1-4', Pinyin.pattern('shēng mìng') === '1-4');
}

// --- sound drill: options are the lesson's own minimal pairs
{
  store.clear(); State.reset(); State.load();
  const sp = C101.parts(C101.lesson('bas-sounds-l1'))[0];
  const ss = Session.forPart(sp);
  const hears = ss.queue.filter(i => i.kind === 'hear2py');
  ok('sound part builds listening items', hears.length > 0);
  ok('sound answer is the word\'s own pinyin', hears.every(i => i.correct === i.word.pinyin));
  ok('sound options include the answer', hears.every(i => i.options.indexOf(i.correct) >= 0));
  const lessonWords = C101.lesson('bas-sounds-l1').words;
  const lessonPy = new Set(lessonWords.map(w => w.pinyin));
  const lessonHz = new Set(lessonWords.map(w => w.hanzi));
  ok('sound distractors come from the same contrast set',
     hears.every(i => i.options.every(o => lessonPy.has(o))));
  // The listen→hanzi item is scoped the same way, or it stops being a listening
  // test: options drawn chapter-wide wouldn't sound alike at all.
  ok('listening options are confusable too',
     ss.queue.filter(i => i.kind === 'listen').every(i => i.options.every(o => lessonHz.has(o))));
  ok('sound options are distinct', hears.every(i => new Set(i.options).size === i.options.length));
  let sg = 0;
  while (!ss.done && sg++ < 500) {
    const it = ss.current();
    ss.answer(it.kind === 'intro' ? null : it.correct);
  }
  ok('sound session completes all-correct', ss.done && ss.missed === 0);
}

// --- radical drill + the curation rules the contains-item depends on
{
  store.clear(); State.reset(); State.load();
  const radLessons = C101.chapter('bas-radicals').lessons;
  const rads = radLessons.flatMap(l => l.words);
  ok('all 95 radicals are taught', rads.length === 95);
  ok('every radical has a pinyin and a gloss', rads.every(w => w.pinyin && w.en));
  // Distinct glosses: two options meaning the same thing is an unanswerable item.
  ok('radical glosses are distinct', new Set(rads.map(w => w.en)).size === rads.length);
  ok('side-forms carry a spoken parent', rads.filter(w => w.hanzi === '氵' || w.hanzi === '亻')
     .every(w => !!w.say));

  // Rule 1: examples are single characters drawn from the graded corpus.
  const corpusChars = new Set();
  for (const w of C101.allWords()) for (const c of w.hanzi) corpusChars.add(c);
  const exs = rads.flatMap(w => (w.examples || []).map(e => [w.hanzi, e]));
  ok('radical examples exist', exs.length > 50);
  ok('every example is a single character', exs.every(([, e]) => [...e].length === 1));
  const notInCorpus = exs.filter(([, e]) => !corpusChars.has(e));
  if (notInCorpus.length) console.log('     stray:', notInCorpus.map(x => x[1]).join(' '));
  ok('every example character appears in the graded corpus', notInCorpus.length === 0);

  // Rule 2 (partially checkable): a character listed under two radicals would be
  // a second correct answer whenever the other one is the question.
  const seenEx = new Map();
  const dupes = [];
  for (const [rad, e] of exs) {
    if (seenEx.has(e)) dupes.push(`${e} (${seenEx.get(e)} + ${rad})`);
    else seenEx.set(e, rad);
  }
  if (dupes.length) console.log('     dupes:', dupes.join(', '));
  ok('no example character is claimed by two radicals', dupes.length === 0);

  const rp = C101.parts(C101.lesson('bas-rad-l2'));
  ok('radical parts carry the drill', rp.every(p => p.drill === 'radical'));
  const rs = Session.forPart(rp[0]);
  const cons = rs.queue.filter(i => i.kind === 'contains');
  ok('radical part builds contains items', cons.length > 0);
  ok('the contains answer is one of that radical\'s examples',
     cons.every(i => (i.word.examples || []).indexOf(i.correct) >= 0));
  ok('contains decoys are never that radical\'s own examples',
     cons.every(i => i.options.filter(o => (i.word.examples || []).indexOf(o) >= 0).length === 1));
  ok('contains offers four options', cons.every(i => i.options.length === 4));
  ok('radical part opens with a pairs warm-up', rs.queue.some(i => i.kind === 'pairs'));
  ok('no typed recall in a drill part', rs.queue.every(i => i.kind !== 'type'));
  let rg = 0;
  while (!rs.done && rg++ < 500) {
    const it = rs.current();
    rs.answer(it.kind === 'intro' ? null : (it.kind === 'pairs' ? true : it.correct));
  }
  ok('radical session completes all-correct', rs.done && rs.missed === 0);
}

// --- a missed drill item is requeued, same as any other exercise
{
  store.clear(); State.reset(); State.load();
  const s2 = Session.forPart(C101.parts(C101.lesson('bas-tones-l1'))[0]);
  while (s2.current().kind === 'intro') s2.answer(null);
  const idx = s2.queue.findIndex((i, n) => n >= s2.idx && i.kind === 'tone');
  while (s2.idx < idx) s2.answer(s2.current().correct);
  const before = s2.queue.length;
  s2.answer(s2.current().options.find(o => o !== s2.current().correct));
  ok('a missed tone item is requeued', s2.queue.length === before + 1);
  ok('the requeued item is another tone item', s2.queue[s2.queue.length - 1].kind === 'tone');
}

// --- everyday words are ordinary vocabulary (no drill), so they keep Reading
{
  const coreParts = C101.parts(C101.lesson('bas-core-l1'));
  ok('a non-drill Basics lesson still gets a Reading part',
     coreParts.some(p => p.kind === 'reading'));
  ok('numbers lesson teaches 1-10', C101.lesson('bas-core-l1').words.length === 10);
}

// --- pinyin helpers
ok('tone read off a mark', Pinyin.toneOf('mǎ') === 3 && Pinyin.toneOf('ma') === 5);
ok('ü survives stripping', Pinyin.strip('lǜ') === 'lü' && Pinyin.toneOf('nǚ') === 3);
ok('tone mark placed by the a/o/e rule', Pinyin.withTone('jiu', 2) === 'jiú' &&
   Pinyin.withTone('hui', 4) === 'huì' && Pinyin.withTone('xiang', 3) === 'xiǎng');
ok('pattern round-trips', Pinyin.spell(['sheng', 'ming'], '1-4') === 'shēng mìng');

// --- min lag: two questions about the same word never bunch together
{
  store.clear(); State.reset(); State.load();
  const LAG = CONFIG.MIN_ITEM_LAG;

  // Closest pair of questions about the same word, in queue positions. The
  // pairs board is excluded (it stands for five words, not the one in .hanzi).
  function tightest(queue) {
    const at = new Map();
    let min = Infinity;
    queue.forEach((it, i) => {
      if (it.kind === 'pairs') return;
      if (at.has(it.hanzi)) min = Math.min(min, i - at.get(it.hanzi));
      at.set(it.hanzi, i);
    });
    return min;
  }
  const distinct = q => new Set(q.filter(i => i.kind !== 'pairs').map(i => i.hanzi)).size;

  // Every learn part of every section, plus the reading parts and the test.
  const queues = [];
  for (const les of C101.chapter('ch01').lessons) {
    for (const part of C101.parts(les)) queues.push(Session.forPart(part).queue);
  }
  queues.push(Session.forTest(C101.chapter('ch01')).queue);

  // The gap is only satisfiable when there are more distinct words than the lag.
  const short = queues.filter(q => distinct(q) > LAG);
  const bad = short.filter(q => tightest(q) <= LAG);
  if (bad.length) console.log('     tightest:', bad.map(tightest).join(', '));
  ok('no two questions about a word land within the min lag',
     short.length > 0 && bad.length === 0);
  // Guard against the check above passing vacuously: these queues must really
  // ask about the same word more than once, or there is nothing to space.
  ok('the queues do repeat words', short.some(q => q.length > distinct(q)));

  // Intro cards are queued ahead of the drills; the run-in is spaced too, so
  // the last word introduced is not the first one asked about.
  const withIntros = queues.filter(q => q.filter(i => i.kind === 'intro').length > LAG);
  ok('the intro run-in is spaced from the first questions',
     withIntros.length > 0 && withIntros.every(q => tightest(q) > LAG));

  // space() keeps the queue intact — same items, same count, nothing dropped.
  {
    const items = 'abcdef'.split('').flatMap(h => [{ hanzi: h }, { hanzi: h }, { hanzi: h }]);
    const out = Session.space(items.slice());
    const count = h => out.filter(i => i.hanzi === h).length;
    ok('space keeps every item', out.length === items.length);
    ok('space drops and duplicates nothing',
       'abcdef'.split('').every(h => count(h) === 3));
    ok('space satisfies the lag when it can', tightest(out) > LAG);
  }

  // Degenerate: too few words to satisfy the lag. It must still do the best
  // available thing (alternate) rather than emit a back-to-back repeat.
  {
    const out = Session.space([{ hanzi: 'x' }, { hanzi: 'x' }, { hanzi: 'y' }, { hanzi: 'y' }]);
    ok('two words alternate when the lag is unsatisfiable', tightest(out) === 2);
  }
}

// ---- Combo: consecutive correct answers within a session --------------------
{
  store.clear(); State.reset(); State.load();
  const part = C101.parts(C101.lesson('ch01-l1a'))[0];

  // A clean run counts up; bestCombo remembers the high-water mark.
  const s = Session.forPart(part);
  let graded = 0;   // items that count toward a run: not intro, not the pairs board
  let answered = 0;
  while (!s.done && answered < 6) {
    const item = s.current();
    if (item.kind === 'intro') { s.answer(null); continue; }
    if (item.kind !== 'pairs') graded++;
    s.answer(item.correct);
    answered++;
  }
  ok('a run of correct answers builds the combo', s.combo === graded && graded > 0);
  ok('bestCombo tracks the high-water mark', s.bestCombo === s.combo);

  // A miss breaks it, and the next correct answer starts a fresh run — while
  // bestCombo keeps the earlier best.
  const before = s.bestCombo;
  const missItem = s.current();
  if (missItem && missItem.kind !== 'intro' && missItem.kind !== 'pairs') {
    const wrongChoice = (missItem.options || []).find(o => o !== missItem.correct) || '__nope__';
    s.answer(wrongChoice);
    ok('a miss resets the combo to zero', s.combo === 0);
    ok('a miss leaves bestCombo alone', s.bestCombo === before);
  }

  // The pairs board is excluded, exactly as it is from SRS: it asks about five
  // words at once, so it is not a link in a run either way.
  store.clear(); State.reset(); State.load();
  const s2 = Session.forPart(part);
  const pairsItem = s2.queue.find(i => i.kind === 'pairs');
  if (pairsItem) {
    while (s2.current() !== pairsItem && !s2.done) s2.answer(s2.current().correct);
    const comboBefore = s2.combo;
    s2.answer(pairsItem.correct);
    ok('the pairs board does not join a combo run', s2.combo === comboBefore);
  }
}

// ---- Combo milestones: when the run gets a sound of its own ------------------
// The arithmetic lives in audio.js (which needs an AudioContext, so it isn't
// loaded here), but the constants it reads must stay sane: the reward has to be
// rare enough to stay a reward, and every ordinary correct answer must sound
// identical — the thing the old per-link pitch climb got wrong.
{
  const milestone = n => !!n && n % CONFIG.COMBO_MILESTONE === 0;
  ok('a single correct answer is not a milestone', !milestone(1));
  ok('a broken run (streak 0) is not a milestone', !milestone(0));
  ok('the milestone lands on the Nth link', milestone(CONFIG.COMBO_MILESTONE));
  ok('and repeats every N after that', milestone(CONFIG.COMBO_MILESTONE * 3));
  ok('nothing in between fires', !milestone(CONFIG.COMBO_MILESTONE + 1));
  ok('the milestone is rare enough to stay a reward', CONFIG.COMBO_MILESTONE >= 4);
  ok('the banner celebrates at or before the first milestone',
     CONFIG.COMBO_CELEBRATE <= CONFIG.COMBO_MILESTONE);
  ok('the lift is a real interval, not a chipmunk', CONFIG.COMBO_LIFT > 1 && CONFIG.COMBO_LIFT <= 2);
  ok('the two notes read as two', CONFIG.COMBO_LIFT_GAP > 0.03 && CONFIG.COMBO_LIFT_GAP < 0.3);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
