// headless.js — logic-only tests for the C101 engine (no DOM/browser).
// Loads config/content/chapter/state/srs/session in a shared vm scope and
// simulates full sessions. Run: npm test
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const files = [
  'src/config.js', 'src/content.js', 'content/chapter-01.js',
  'src/state.js', 'src/srs.js', 'src/session.js'
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
vm.runInContext(src + '\n;globalThis.__api = { CONFIG, C101, State, SRS, Session };', sandbox);
const { CONFIG, C101, State, SRS, Session } = sandbox.__api;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name); }
}

State.load();

// --- content loaded correctly
ok('one chapter registered', C101.chapters().length === 1);
ok('16 lessons', C101.lessons().length === 16);
ok('228 words', C101.allWords().length === 228);
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

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
