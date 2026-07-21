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
ok('5 lessons', C101.lessons().length === 5);
ok('60 words', C101.allWords().length === 60);
ok('every word has pinyin+en', C101.allWords().every(w => w.pinyin && w.en && w.pinyin !== '?'));
ok('word lookup works', C101.word('生命').en.startsWith('life'));

// --- sections split into bite-size parts (learn parts + a reading part)
const l1 = C101.lesson('ch01-l1');
const l1parts = C101.parts(l1);
ok('12-word section -> 2 learn parts + 1 reading', l1parts.length === 3);
const learnParts = l1parts.filter(p => p.kind === 'learn');
const readParts = l1parts.filter(p => p.kind === 'reading');
ok('two learn parts', learnParts.length === 2);
ok('learn parts cover all section words',
   learnParts.reduce((n, p) => n + p.words.length, 0) === l1.words.length);
ok('one reading part with all words', readParts.length === 1 && readParts[0].words.length === l1.words.length);
ok('each learn part is <= PART_SIZE', learnParts.every(p => p.words.length <= CONFIG.PART_SIZE));

// --- reading part session: MC only, no intro, mode 'reading'
const rSess = Session.forPart(readParts[0]);
ok('reading session has no intro cards', rSess.queue.every(i => i.kind !== 'intro'));
ok('reading session marked mode reading', rSess.mode === 'reading');
ok('reading items carry reading mode', rSess.queue.every(i => i.mode === 'reading'));

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
const lesson = C101.lesson('ch01-l1');
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
const l2 = C101.lesson('ch01-l2');
s = Session.forLesson(l2);
// answer first quiz item wrong (skip intros)
let firstQuiz = null;
while (!s.done) {
  const item = s.current();
  if (item.kind === 'intro') { s.answer(null); continue; }
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
