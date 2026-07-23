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

  // ---- Language / script picker (top-left) ----------------------------------
  // A small dropdown driven by Lang.langs(), so adding a language later needs no
  // UI change here. Picking one re-renders everything through Lang.zh(...).
  function buildLangSelect() {
    const root = $('#lang-select');
    if (!root) return;
    root.innerHTML = '';

    const btn = el('button', 'lang-btn');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    const cur = el('span', 'lang-cur', Lang.current().label);
    btn.appendChild(cur);
    btn.appendChild(el('span', 'lang-caret', '▾'));

    const menu = el('ul', 'lang-menu');
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    Lang.langs().forEach((lng) => {
      const li = el('li', 'lang-opt', lng.name);
      li.setAttribute('role', 'option');
      if (lng.id === Lang.current().id) li.classList.add('sel');
      li.addEventListener('click', () => {
        if (Lang.set(lng.id)) {
          buildLangSelect();     // refresh label + selected mark
          applyLang();           // re-render everything in the new script
        }
        closeLangMenu();
      });
      menu.appendChild(li);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden ? (menu.hidden = false, btn.setAttribute('aria-expanded', 'true'))
                  : closeLangMenu();
    });

    root.appendChild(btn);
    root.appendChild(menu);
  }

  // Close the (single) open language menu. Bound once to document in init so
  // rebuilding the picker doesn't stack listeners.
  function closeLangMenu() {
    const m = $('.lang-menu'), b = $('.lang-btn');
    if (m && !m.hidden) { m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }
  }

  // Re-paint every screen's Chinese in the active script. Home is fully rebuilt;
  // the static brand is refreshed too. (No session is on-screen when the picker
  // is reachable, so re-rendering home is enough.)
  function applyLang() {
    const brand = document.querySelector('.brand');
    if (brand) brand.textContent = Lang.zh('課程 101');
    renderHome();
  }

  // ---- Home: the learning path ----------------------------------------------
  // The home screen is a Duolingo-style winding trail. Each lesson "part" (Learn
  // parts, the 📖 Reading drill, and the chapter Test) is a bubble node. Nodes
  // unlock in order: the next one opens once the current is cleared (its session
  // finished — see Session.answer → State.markPartCleared). Watercolor set
  // dressing from the Course 101 book scatters along the trail.

  // Each section of the chapter carries its own watercolor illustrations from the
  // Course 101 book, echoing that section's theme (Ch.1's "big questions", the
  // creation account, etc.). They float alongside the trail in a soft halo so they
  // stay legible; line-art pieces (invert:true) are flipped to glow white on the
  // dark band. Pieces are spread across the section's nodes at render time.
  const SECTION_ART = {
    'ch01-l1': [ { img: 'star.png',      side: 'right', size: 'lg' } ],  // Nature of Man — shooting star
    'ch01-l2': [ { img: 'book-tree.png', side: 'right', size: 'lg' } ]   // The Creation Account — tree
    // ch01-l3 (In the Beginning), ch01-l4 (Anticipating Parent), ch01-l5 (A Fork
    // in the Road): awaiting hand-picked assets. Drop files in assets/, add them
    // here and to sw.js's ASSETS list.
  };

  let trailNodeEls = []; // {btn, node} cached each render for (re)drawing the path
  let jumpTargets = { current: null, chapters: [] }; // scroll anchors for the Jump menu

  // Build the render model: chapters → sections (each a background band) → nodes,
  // plus a capstone chapter-test node. Assigns each node a linear seq (for the
  // serpentine + gating) and its section's illustrations.
  function buildModel() {
    const chapters = [];
    const allNodes = [];
    let seq = 0;
    C101.chapters().forEach((ch) => {
      const cm = { title: ch.title, zh: ch.zh, sections: [], test: null };
      ch.lessons.forEach((lesson, li) => {
        const art = SECTION_ART[lesson.id] || [];
        const parts = C101.parts(lesson);
        const sm = { id: lesson.id, title: lesson.title, zh: lesson.zh,
                     band: (li % 5) + 1, nodes: [] };
        parts.forEach((part, pi) => {
          const node = makeNode(part, part.kind, seq++);
          node.decor = art.filter((_, ai) => artRow(ai, art.length, parts.length) === pi);
          sm.nodes.push(node); allNodes.push(node);
        });
        cm.sections.push(sm);
      });
      if ((ch.sentences || []).length) {
        const test = { id: `test-${ch.id}`, chapterId: ch.id, kind: 'test',
          label: 'Chapter Test', count: ch.sentences.length };
        cm.test = makeNode(test, 'test', seq++);
        allNodes.push(cm.test);
      }
      chapters.push(cm);
    });
    // Gating: unlocked if first or previous cleared; current = first open+uncleared.
    let prevCleared = true, currentTaken = false;
    for (const n of allNodes) {
      n.unlocked = prevCleared;
      if (n.unlocked && !n.cleared && !currentTaken) { n.current = true; currentTaken = true; }
      prevCleared = n.cleared;
    }
    return { chapters, allNodes };
  }

  function makeNode(part, kind, seq) {
    return {
      part, kind, seq, id: part.id,
      cleared: State.partCleared(part.id),
      bestAcc: State.partBestAcc(part.id),
      unlocked: false, current: false, decor: []
    };
  }

  // Which node (0..nodes-1) an art piece ai (of count) lands on — evenly spread.
  function artRow(ai, count, nodes) {
    if (count <= 1) return Math.min(1, nodes - 1);
    return Math.round(ai * (nodes - 1) / (count - 1));
  }

  function renderHome() {
    const s = State.get();
    $('#stat-streak').textContent = s.streak;
    $('#stat-xp').textContent = s.xp;

    const due = SRS.dueWords().length;
    const reviewBtn = $('#review-btn');
    reviewBtn.textContent = due ? `Review · ${due} due` : 'Review · all caught up';
    reviewBtn.disabled = due === 0;

    const scene = $('#chapter-list');
    scene.className = 'path-scene';
    scene.innerHTML = '';
    trailNodeEls = [];
    jumpTargets = { current: null, chapters: [] };

    const model = buildModel();
    let rowIdx = 0;
    for (const ch of model.chapters) {
      const header = chapterHeader(ch);
      jumpTargets.chapters.push({ title: ch.title, el: header });
      scene.appendChild(header);
      for (const sec of ch.sections) {
        const band = el('div', 'band b' + sec.band);
        band.appendChild(sectionBanner(sec));
        for (const node of sec.nodes) band.appendChild(nodeRow(node, rowIdx++));
        band.appendChild(sectionActions(C101.lesson(sec.id)));
        scene.appendChild(band);
      }
      if (ch.test) {
        const band = el('div', 'band capstone');
        band.appendChild(nodeRow(ch.test, rowIdx++));
        scene.appendChild(band);
      }
    }
    // The current node's bubble is the "current lesson" jump anchor.
    const cur = trailNodeEls.find(({ node }) => node.current);
    jumpTargets.current = cur ? cur.btn : null;
    buildJumpMenu();
    // Draw the bending, filling trail once layout has settled.
    requestAnimationFrame(() => drawTrail(scene));
  }

  // A section's two extra affordances, sitting just below its trail nodes:
  // read the authentic C101 book passage, and browse the section's word list.
  // Both open the shared modal. Available any time (they're study aids, not gated
  // exercises). The 📖 Read button only appears if the section has a passage.
  function sectionActions(lesson) {
    const row = el('div', 'section-actions');
    if (!lesson) return row;
    if (lesson.reading && lesson.reading.zh) {
      const read = el('button', 'sec-btn', '📖 Read the C101 text');
      read.addEventListener('click', () => openModal((b) => buildReading(b, lesson)));
      row.appendChild(read);
    }
    const vocab = el('button', 'sec-btn', '📋 Vocab list');
    vocab.addEventListener('click', () => openModal((b) => buildVocab(b, lesson)));
    row.appendChild(vocab);
    return row;
  }

  // Night-sky strip that opens the chapter. (The shooting star now sits with the
  // Nature of Man section below, so the header stays clean.)
  function chapterHeader(ch) {
    const h = el('div', 'trail-chapter');
    h.appendChild(el('div', 'trail-chapter-title', ch.title));
    h.appendChild(el('div', 'trail-chapter-zh', Lang.zh(ch.zh)));
    return h;
  }

  function sectionBanner(e) {
    const b = el('div', 'trail-banner');
    b.appendChild(el('span', 'trail-banner-name', e.title));
    b.appendChild(el('span', 'trail-banner-zh', Lang.zh(e.zh)));
    return b;
  }

  function decorImg(file, cls) {
    const img = el('img', 'decor ' + (cls || ''));
    img.src = 'assets/' + file;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.setAttribute('loading', 'lazy');
    return img;
  }

  // A section illustration floating at one edge of the trail, in a soft light halo
  // so both silhouettes and (inverted) line-art read over the band.
  function decorPiece(piece) {
    const halo = el('div', 'decor-halo decor-' + piece.side + ' decor-' + piece.size);
    halo.appendChild(decorImg(piece.img, 'decor-img' + (piece.invert ? ' inv' : '')));
    return halo;
  }

  // One step of the winding trail: the node bubble, offset side-to-side, with its
  // section's set-dressing floating alongside.
  function nodeRow(node, rowIdx) {
    const row = el('div', 'node-row');
    const offset = Math.round(Math.sin(rowIdx * 0.9) * 76); // gentle serpentine
    row.style.setProperty('--x', offset + 'px');

    for (const piece of (node.decor || [])) row.appendChild(decorPiece(piece));

    const wrap = nodeBubble(node);
    row.appendChild(wrap);
    trailNodeEls.push({ btn: wrap.querySelector('.node'), node });
    return row;
  }

  // ---- The connecting trail (SVG) -------------------------------------------
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // Smooth curve through node centres (Catmull-Rom → cubic bezier) so the path
  // bends around and links the bubbles.
  function smoothPath(p) {
    if (p.length < 2) return '';
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  }

  // Measure the live node positions and draw the winding path behind them; its
  // cleared prefix is lit gold and reaches halfway toward the current node.
  function drawTrail(scene) {
    if (!scene || !scene.clientHeight) return;            // not visible yet
    const old = scene.querySelector('.trail-svg');
    if (old) old.remove();
    const els = trailNodeEls;
    if (els.length < 2) return;

    const sr = scene.getBoundingClientRect();
    const w = scene.clientWidth, h = scene.scrollHeight;
    const pts = els.map(({ btn }) => {
      const r = btn.getBoundingClientRect();
      return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
    });

    const svg = svgEl('svg', { class: 'trail-svg', width: w, height: h, viewBox: `0 0 ${w} ${h}` });
    svg.appendChild(svgEl('path', { class: 'trail-line', d: smoothPath(pts) }));

    let done = 0; // contiguous cleared prefix = how far we've walked
    for (const { node } of els) { if (node.cleared) done++; else break; }
    if (done >= 1) {
      const gold = pts.slice(0, done);
      if (done < pts.length) {
        gold.push({ x: (pts[done - 1].x + pts[done].x) / 2,
                    y: (pts[done - 1].y + pts[done].y) / 2 });
      }
      if (gold.length >= 2) svg.appendChild(svgEl('path', { class: 'trail-line-fill', d: smoothPath(gold) }));
    }
    scene.insertBefore(svg, scene.firstChild);
  }

  function redrawTrail() {
    if ($('#home').classList.contains('active')) drawTrail($('#chapter-list'));
  }

  function nodeBubble(node) {
    const wrap = el('div', 'node-wrap');
    if (node.current) {
      const bubble = el('div', 'start-bubble', node.cleared ? 'REVIEW' : 'START');
      wrap.appendChild(bubble);
    }

    const btn = el('button', 'node');
    btn.classList.add('node-' + node.kind);
    if (!node.unlocked) btn.classList.add('locked');
    if (node.cleared) btn.classList.add('cleared');
    if (node.current) btn.classList.add('current');

    btn.appendChild(el('span', 'node-ico', nodeIcon(node)));
    wrap.appendChild(btn);

    // Stars earned (by best accuracy) sit under a cleared node.
    if (node.cleared) wrap.appendChild(starRow(node.bestAcc));
    wrap.appendChild(el('div', 'node-label', nodeLabel(node)));

    if (node.unlocked) {
      btn.addEventListener('click', () => {
        node.kind === 'test' ? startTest(node.part.chapterId) : startPart(node.part);
      });
    } else {
      btn.setAttribute('aria-disabled', 'true');
      btn.title = 'Finish the previous step to unlock';
    }
    return wrap;
  }

  function nodeIcon(node) {
    if (!node.unlocked) return '🔒';
    if (node.kind === 'test') return '🏆';
    if (node.kind === 'reading') return '📖';
    return '⭐';
  }

  function nodeLabel(node) {
    if (node.kind === 'test') return 'Chapter Test';
    return node.part.label;
  }

  function starRow(acc) {
    const stars = acc >= 0.95 ? 3 : acc >= 0.75 ? 2 : 1;
    const row = el('div', 'node-stars');
    for (let i = 0; i < 3; i++) {
      row.appendChild(el('span', 'star' + (i < stars ? ' on' : ''), '★'));
    }
    return row;
  }

  // ---- Modal: reading passage & vocab list ----------------------------------
  // A shared bottom-sheet overlay over the home path. `build` fills #modal-body.

  function openModal(build) {
    const body = $('#modal-body');
    body.innerHTML = '';
    build(body);
    const m = $('#modal');
    m.hidden = false;
    m.querySelector('.modal-card').scrollTop = 0;
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    const m = $('#modal');
    if (!m || m.hidden) return;
    m.hidden = true;
    document.body.classList.remove('modal-open');
    if (window.speechSynthesis) speechSynthesis.cancel(); // stop any passage playback
  }

  // Split a passage into paragraphs (blank-line separated, single newlines too).
  function paragraphs(text) {
    return String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }

  function modalHead(body, kicker, lesson) {
    body.appendChild(el('div', 'modal-kicker', kicker));
    body.appendChild(el('div', 'modal-title', lesson.title));
    body.appendChild(el('div', 'modal-sub', Lang.zh(lesson.zh)));
  }

  // The authentic book passage for a section: the real Chinese to read unaided,
  // with a play button (TTS) and a reveal for the English (ground-truth) text.
  function buildReading(body, lesson) {
    modalHead(body, '📖 Read the C101 text', lesson);
    const r = lesson.reading || {};

    const controls = el('div', 'reading-controls');
    const play = el('button', 'pill-btn', '🔊 Play');
    play.addEventListener('click', () => Audio101.speak(r.zh || ''));
    controls.appendChild(play);
    const toggle = el('button', 'pill-btn', 'Show English');
    controls.appendChild(toggle);
    body.appendChild(controls);

    const zhWrap = el('div', 'reading-zh');
    paragraphs(r.zh).forEach((p) => zhWrap.appendChild(el('p', 'reading-p', Lang.zh(p))));
    body.appendChild(zhWrap);

    const en = el('div', 'reading-en');
    paragraphs(r.en).forEach((p) => en.appendChild(el('p', 'reading-p', p)));
    en.hidden = true;
    body.appendChild(en);
    toggle.addEventListener('click', () => {
      en.hidden = !en.hidden;
      toggle.textContent = en.hidden ? 'Show English' : 'Hide English';
    });
  }

  // The section's word list — hanzi, pinyin, gloss, and a per-word play button.
  function buildVocab(body, lesson) {
    modalHead(body, '📋 Section vocab · ' + lesson.words.length + ' words', lesson);
    const list = el('div', 'vocab-list');
    for (const w of lesson.words) {
      const rowEl = el('div', 'vocab-row');
      const main = el('div', 'vocab-main');
      main.appendChild(el('div', 'vocab-hz', Lang.zh(w.hanzi)));
      main.appendChild(el('div', 'vocab-py', w.pinyin));
      rowEl.appendChild(main);
      rowEl.appendChild(el('div', 'vocab-en', w.en));
      rowEl.appendChild(speakerBtn(w.hanzi));
      list.appendChild(rowEl);
    }
    body.appendChild(list);
  }

  // ---- Jump menu ------------------------------------------------------------
  // A floating control that scrolls the (long) path to the current lesson or to
  // any chapter. Rebuilt each render from jumpTargets.

  function buildJumpMenu() {
    const menu = $('#jump-menu');
    if (!menu) return;
    menu.innerHTML = '';
    const items = [];
    if (jumpTargets.current) items.push({ label: '▸ Current lesson', el: jumpTargets.current, cur: true });
    jumpTargets.chapters.forEach((c) => items.push({ label: c.title, el: c.el }));
    for (const it of items) {
      const li = el('li', 'jump-item' + (it.cur ? ' jump-cur' : ''), it.label);
      li.setAttribute('role', 'menuitem');
      li.addEventListener('click', () => { scrollToEl(it.el); closeJump(); });
      menu.appendChild(li);
    }
  }

  function scrollToEl(target) {
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function toggleJump(e) {
    e.stopPropagation();
    const menu = $('#jump-menu'), btn = $('#jump-btn');
    if (menu.hidden) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
    else closeJump();
  }

  function closeJump() {
    const menu = $('#jump-menu'), btn = $('#jump-btn');
    if (menu && !menu.hidden) { menu.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); }
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
    const hz = el('div', 'hanzi-lg', Lang.zh(w.hanzi));
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
      p.appendChild(el('span', 'hanzi-md', Lang.zh(item.word.hanzi)));
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
        b.appendChild(el('span', 'opt-hanzi', Lang.zh(opt)));
        const w = C101.word(opt);
        if (w && !reading) b.appendChild(el('span', 'opt-pinyin', w.pinyin));
      }
      b.dataset.val = opt; // canonical (Traditional) value — reveal/grade off this, not display text
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
    const parts = item.zh.split(item.correct); // split on canonical text
    parts.forEach((seg, i) => {
      if (i > 0) zh.appendChild(el('span', 'cloze-gap', '____'));
      if (seg) zh.appendChild(el('span', 'cloze-seg', Lang.zh(seg)));
    });
    stage.appendChild(zh);

    const opts = el('div', 'options cloze-options');
    for (const opt of item.options) {
      const b = el('button', 'option');
      b.appendChild(el('span', 'opt-hanzi', Lang.zh(opt)));
      b.dataset.val = opt; // canonical value for reveal/grading
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
      // reveal the right one — compare the canonical value, not the (maybe
      // script-converted) display text.
      optsEl.querySelectorAll('.option').forEach(o => {
        const val = o.dataset.val != null ? o.dataset.val : o.textContent;
        if (val === item.correct) o.classList.add('correct');
      });
    }

    ok ? Audio101.SFX.correct() : Audio101.SFX.wrong();

    foot.classList.add(ok ? 'ok' : 'bad');
    const banner = el('div', 'feedback');
    banner.textContent = ok ? 'Correct!' : `Answer: ${Lang.zh(item.correct)}` +
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
    buildLangSelect();
    document.addEventListener('click', closeLangMenu); // outside-click, bound once
    const brand = document.querySelector('.brand');
    if (brand) brand.textContent = Lang.zh('課程 101');
    $('#review-btn').addEventListener('click', startReview);

    // Jump menu (scroll the path) + modal (reading / vocab) wiring.
    $('#jump-btn').addEventListener('click', toggleJump);
    document.addEventListener('click', closeJump); // outside-click, bound once
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    $('#session-exit').addEventListener('click', () => { session = null; renderHome(); showScreen('home'); });
    $('#results-done').addEventListener('click', () => { renderHome(); showScreen('home'); });
    // Re-measure the connecting trail when the layout can shift.
    let t = null;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(redrawTrail, 120); });
    window.addEventListener('load', redrawTrail);
    renderHome();
    showScreen('home');
  }

  return { init, showScreen, renderHome };
})();
