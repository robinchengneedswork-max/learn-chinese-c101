// ui.js — screens, home dashboard, and exercise rendering. Reads State/SRS/
// Session; owns all DOM. Screen pattern: .screen + .screen.active, showScreen(id).
'use strict';

const UI = (function () {
  let session = null;   // active Session or null
  let answered = false; // has the current item been answered (awaiting Continue)?
  const $ = (sel, root) => (root || document).querySelector(sel);

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function speakerBtn(text) {
    const b = el('button', 'speaker', '🔊');
    b.setAttribute('aria-label', 'Play audio');
    b.addEventListener('click', () => Audio101.speak(text));
    return b;
  }

  // ---- Home -----------------------------------------------------------------

  function renderHome() {
    const s = State.get();
    $('#stat-streak').textContent = s.streak;
    $('#stat-xp').textContent = s.xp;

    const due = SRS.dueWords().length;
    const reviewBtn = $('#review-btn');
    reviewBtn.textContent = due ? `Review · ${due} due` : 'Review · all caught up';
    reviewBtn.disabled = due === 0;

    const list = $('#chapter-list');
    list.innerHTML = '';
    for (const ch of C101.chapters()) {
      list.appendChild(el('h2', 'chapter-title', ch.title));
      list.appendChild(el('div', 'chapter-zh', ch.zh));
      for (const lesson of ch.lessons) {
        // Section header, then its bite-size parts (learn parts + Reading part).
        const sec = el('div', 'section-head');
        sec.appendChild(el('span', 'section-name', lesson.title));
        sec.appendChild(el('span', 'section-zh', lesson.zh));
        list.appendChild(sec);
        const row = el('div', 'part-row');
        for (const part of C101.parts(lesson)) row.appendChild(partCard(part));
        list.appendChild(row);
      }
      if ((ch.sentences || []).length) list.appendChild(testCard(ch));
    }
  }

  function partCard(part) {
    const card = el('button', 'part-card');
    if (part.kind === 'reading') card.classList.add('reading');
    const mastery = SRS.lessonMastery(part);
    if (mastery >= 1) card.classList.add('mastered');

    card.appendChild(el('span', 'part-label', part.label));
    if (part.kind === 'reading') {
      card.appendChild(el('span', 'part-meta', 'no pinyin'));
    } else {
      const learned = part.words.filter(w => !SRS.isNew(w.hanzi)).length;
      card.appendChild(el('span', 'part-meta', `${learned}/${part.words.length}`));
    }

    const bar = el('div', 'bar part-bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = (mastery * 100) + '%';
    bar.appendChild(fill);
    card.appendChild(bar);

    card.addEventListener('click', () => startPart(part));
    return card;
  }

  function testCard(chapter) {
    const card = el('button', 'test-card');
    card.appendChild(el('span', 'test-ico', '📝'));
    const body = el('div', 'test-body');
    body.appendChild(el('span', 'test-name', 'Chapter Test'));
    body.appendChild(el('span', 'test-meta',
      `${chapter.sentences.length} fill-in-the-blank sentences`));
    card.appendChild(body);
    card.addEventListener('click', () => startTest(chapter.id));
    return card;
  }

  // ---- Session flow ---------------------------------------------------------

  function startPart(part) {
    session = Session.forPart(part);
    if (session.done) return;
    beginSession();
  }

  function startTest(chapterId) {
    session = Session.forTest(C101.chapter(chapterId));
    if (session.done) return;
    beginSession();
  }

  function startReview() {
    session = Session.forReview();
    if (session.done) return;
    beginSession();
  }

  function beginSession() {
    answered = false;
    showScreen('session');
    renderItem();
  }

  function renderItem() {
    if (session.done) return renderResults();
    answered = false;
    const item = session.current();

    $('#session-bar-fill').style.width = (session.progress() * 100) + '%';
    const stage = $('#session-stage');
    stage.innerHTML = '';
    const foot = $('#session-foot');
    foot.className = 'session-foot';
    foot.innerHTML = '';

    if (item.kind === 'intro') renderIntro(stage, foot, item);
    else if (item.kind === 'cloze') renderCloze(stage, foot, item);
    else renderMC(stage, foot, item);
  }

  function renderIntro(stage, foot, item) {
    const w = item.word;
    stage.appendChild(el('div', 'prompt-label', 'New word'));
    const card = el('div', 'flashcard');
    const hz = el('div', 'hanzi-lg', w.hanzi);
    hz.appendChild(speakerBtn(w.hanzi));
    card.appendChild(hz);
    card.appendChild(el('div', 'pinyin-lg', w.pinyin));
    card.appendChild(el('div', 'gloss-lg', w.en));
    stage.appendChild(card);
    Audio101.speak(w.hanzi);

    const cont = el('button', 'continue', 'Got it');
    cont.addEventListener('click', () => { session.answer(null); renderItem(); });
    foot.appendChild(cont);
  }

  function renderMC(stage, foot, item) {
    const reading = item.mode === 'reading'; // hide pinyin — train unaided reading

    // Prompt
    if (item.kind === 'zh2en') {
      stage.appendChild(el('div', 'prompt-label',
        reading ? 'Read this — what does it mean?' : 'What does this mean?'));
      const p = el('div', 'prompt-hanzi');
      p.appendChild(el('span', 'hanzi-md', item.word.hanzi));
      p.appendChild(speakerBtn(item.word.hanzi));
      stage.appendChild(p);
      if (!reading) stage.appendChild(el('div', 'prompt-pinyin', item.word.pinyin));
    } else if (item.kind === 'en2zh') {
      stage.appendChild(el('div', 'prompt-label', 'Pick the Chinese'));
      stage.appendChild(el('div', 'prompt-en', item.word.en));
    } else { // listen
      stage.appendChild(el('div', 'prompt-label', 'What did you hear?'));
      const big = speakerBtn(item.word.hanzi);
      big.className = 'speaker speaker-big';
      big.textContent = '🔊';
      stage.appendChild(big);
      Audio101.speak(item.word.hanzi);
    }

    // Options
    const opts = el('div', 'options');
    for (const opt of item.options) {
      const b = el('button', 'option');
      if (item.kind === 'zh2en') {
        b.textContent = opt;
      } else {
        b.appendChild(el('span', 'opt-hanzi', opt));
        const w = C101.word(opt);
        if (w && !reading) b.appendChild(el('span', 'opt-pinyin', w.pinyin));
      }
      b.addEventListener('click', () => onChoose(item, opt, b, opts, foot));
      opts.appendChild(b);
    }
    stage.appendChild(opts);
  }

  // Fill-in-the-blank: English translation clue + the Chinese sentence with the
  // target word shown as a gap. Choose the word, or toggle "type it" and enter
  // tone-tolerant pinyin. Grading (via session.answer) accepts either.
  function renderCloze(stage, foot, item) {
    stage.appendChild(el('div', 'prompt-label', 'Fill in the blank'));
    stage.appendChild(el('div', 'cloze-en', item.en));

    const zh = el('div', 'cloze-zh');
    const parts = item.zh.split(item.correct);
    parts.forEach((seg, i) => {
      if (i > 0) zh.appendChild(el('span', 'cloze-gap', '____'));
      if (seg) zh.appendChild(el('span', 'cloze-seg', seg));
    });
    stage.appendChild(zh);

    const opts = el('div', 'options cloze-options');
    for (const opt of item.options) {
      const b = el('button', 'option');
      b.appendChild(el('span', 'opt-hanzi', opt));
      b.addEventListener('click', () => onChoose(item, opt, b, opts, foot));
      opts.appendChild(b);
    }
    stage.appendChild(opts);

    // Optional typed answer (pinyin, tone-tolerant).
    const typeWrap = el('div', 'type-wrap');
    const toggle = el('button', 'type-toggle', '⌨︎ Type it instead');
    const form = el('div', 'type-form');
    form.style.display = 'none';
    const input = el('input', 'type-input');
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'type pinyin, e.g. shengming');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocomplete', 'off');
    const submit = el('button', 'type-submit', 'Check');
    const grade = () => {
      if (answered) return;
      const val = input.value.trim();
      if (!val) return;
      onChoose(item, val, null, opts, foot);
    };
    submit.addEventListener('click', grade);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') grade(); });
    toggle.addEventListener('click', () => {
      form.style.display = 'flex';
      toggle.style.display = 'none';
      input.focus();
    });
    form.appendChild(input);
    form.appendChild(submit);
    typeWrap.appendChild(toggle);
    typeWrap.appendChild(form);
    stage.appendChild(typeWrap);
  }

  function onChoose(item, choice, btn, optsEl, foot) {
    if (answered) return;
    answered = true;
    // Cloze accepts the hanzi (a choice) or tone-tolerant typed pinyin.
    const ok = item.kind === 'cloze'
      ? (choice === item.correct || Session.pinyinMatches(choice, item.word))
      : choice === item.correct;

    optsEl.querySelectorAll('.option').forEach(o => { o.disabled = true; });
    const stage = optsEl.parentElement;
    if (stage) stage.querySelectorAll('.type-input, .type-submit, .type-toggle')
      .forEach(n => { n.disabled = true; });
    if (btn) btn.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) {
      // reveal the right one
      optsEl.querySelectorAll('.option').forEach(o => {
        const val = item.kind === 'zh2en' ? o.textContent
          : o.querySelector('.opt-hanzi').textContent;
        if (val === item.correct) o.classList.add('correct');
      });
    }

    ok ? Audio101.SFX.correct() : Audio101.SFX.wrong();

    foot.classList.add(ok ? 'ok' : 'bad');
    const banner = el('div', 'feedback');
    banner.textContent = ok ? 'Correct!' : `Answer: ${item.correct}` +
      (item.kind !== 'zh2en' && C101.word(item.correct) ? ` (${C101.word(item.correct).pinyin})` : '');
    foot.appendChild(banner);

    const cont = el('button', 'continue', 'Continue');
    cont.addEventListener('click', () => { session.answer(choice); renderItem(); });
    foot.appendChild(cont);
  }

  // ---- Results --------------------------------------------------------------

  function renderResults() {
    Audio101.SFX.finish();
    showScreen('results');
    const acc = session.total
      ? Math.round((session.correctCount / (session.correctCount + session.missed || 1)) * 100)
      : 100;
    const id = session.lesson.id || '';
    $('#results-title').textContent =
      id === 'review' ? 'Review complete!'
      : id.indexOf('test-') === 0 ? 'Chapter test complete!'
      : 'Lesson complete!';
    $('#results-body').innerHTML = '';
    const stats = $('#results-body');
    stats.appendChild(statChip(session.correctCount, 'correct'));
    stats.appendChild(statChip(acc + '%', 'accuracy'));
    stats.appendChild(statChip(State.get().xp, 'total XP'));
    session = null;
  }

  function statChip(value, label) {
    const c = el('div', 'chip');
    c.appendChild(el('div', 'chip-val', String(value)));
    c.appendChild(el('div', 'chip-lbl', label));
    return c;
  }

  // ---- Wiring ---------------------------------------------------------------

  function init() {
    $('#review-btn').addEventListener('click', startReview);
    $('#session-exit').addEventListener('click', () => { session = null; renderHome(); showScreen('home'); });
    $('#results-done').addEventListener('click', () => { renderHome(); showScreen('home'); });
    renderHome();
    showScreen('home');
  }

  return { init, showScreen, renderHome };
})();
