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

  // What to actually pronounce for a word. Normally the word itself — but a
  // Basics entry may set `say` because its own glyph is unspeakable: a bare
  // radical like 氵 has no reading of its own, so it's read as its parent 水.
  const spoken = (w) => (w && (w.say || w.hanzi)) || '';

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

  // ---- Book (module) picker -------------------------------------------------
  // The app can hold several selectable books (Course 101, Good News Reader…).
  // Each is its own learning path; the picker swaps which one the home shows.
  // The choice persists across sessions. Word progress is shared (keyed by
  // hanzi), so switching books never resets anything.
  const BOOK_KEY = 'c101.book.v1';

  function savedBookId() { try { return localStorage.getItem(BOOK_KEY); } catch (e) { return null; } }
  function restoreBook() {
    const id = savedBookId();
    if (id) C101.setBook(id); // no-op if the id isn't registered
  }
  function chooseBook(id) {
    if (!C101.setBook(id)) return;
    try { localStorage.setItem(BOOK_KEY, id); } catch (e) { /* best-effort */ }
    renderHome();
  }

  // A row of book tabs, rebuilt each render so the active one stays highlighted.
  // Hidden entirely when there's only one book (nothing to switch between).
  function buildBookTabs() {
    const root = $('#book-tabs');
    if (!root) return;
    root.innerHTML = '';
    const list = C101.books();
    if (list.length < 2) { root.hidden = true; return; }
    root.hidden = false;
    const curId = (C101.currentBook() || {}).id;
    for (const bk of list) {
      const tab = el('button', 'book-tab' + (bk.id === curId ? ' active' : ''));
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', bk.id === curId ? 'true' : 'false');
      tab.appendChild(el('span', 'book-tab-name', bk.title));
      tab.appendChild(el('span', 'book-tab-zh', Lang.zh(bk.zh)));
      tab.addEventListener('click', () => { if (bk.id !== curId) chooseBook(bk.id); });
      root.appendChild(tab);
    }
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
  // Scroll anchors captured each render, shared by the Jump menu and the chapter
  // rail: one per chapter and one per section, plus the current node's bubble.
  let jumpTargets = { current: null, chapters: [], sections: [] };

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
    // An "open" book (Basics) skips gating entirely — it's a toolbox you dip into
    // for the drill you need, not a course you walk end to end.
    const openBook = !!(C101.currentBook() || {}).open;
    let prevCleared = true, currentTaken = false;
    for (const n of allNodes) {
      n.unlocked = openBook || prevCleared;
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

    buildBookTabs();
    const book = C101.currentBook();
    const tag = document.querySelector('.tagline');
    if (tag && book) {
      tag.textContent = 'Vocabulary from ';
      tag.appendChild(el('em', null, book.tagline));
      tag.appendChild(document.createTextNode('.'));
    }

    const due = SRS.dueWords().length;
    const reviewBtn = $('#review-btn');
    reviewBtn.textContent = due ? `Review · ${due} due` : 'Review · all caught up';
    reviewBtn.disabled = due === 0;

    const scene = $('#chapter-list');
    scene.className = 'path-scene';
    scene.innerHTML = '';
    trailNodeEls = [];
    jumpTargets = { current: null, chapters: [], sections: [] };

    const model = buildModel();
    let rowIdx = 0;
    for (const ch of model.chapters) {
      const header = chapterHeader(ch);
      jumpTargets.chapters.push({ title: ch.title, el: header });
      scene.appendChild(header);
      for (const sec of ch.sections) {
        const band = el('div', 'band b' + sec.band);
        jumpTargets.sections.push({ title: sec.title, el: band });
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
    // The book's back-matter (radicals, glossary, appendices, …) as a Reference
    // area at the foot of the path — study aids, not gated exercises.
    const refs = C101.references();
    if (refs.length) scene.appendChild(referenceBand(refs));
    // The current node's bubble is the "current lesson" jump anchor.
    const cur = trailNodeEls.find(({ node }) => node.current);
    jumpTargets.current = cur ? cur.btn : null;
    buildJumpMenu();
    // Draw the bending, filling trail once layout has settled — and measure the
    // rail from the same settled layout.
    requestAnimationFrame(() => { drawTrail(scene); layoutRail(); });
  }

  // A section's two extra affordances, sitting just below its trail nodes:
  // read the authentic C101 book passage, and browse the section's word list.
  // Both open the shared modal. Available any time (they're study aids, not gated
  // exercises). The 📖 Read button only appears if the section has a passage.
  function sectionActions(lesson) {
    const row = el('div', 'section-actions');
    if (!lesson) return row;
    if (lesson.reading && lesson.reading.zh) {
      const read = el('button', 'sec-btn', '📖 Read the text');
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

  // Anything that can change the page height (resize, late-loading art) moves
  // the trail and the rail's tick positions alike.
  function redrawTrail() {
    if (!$('#home').classList.contains('active')) return;
    drawTrail($('#chapter-list'));
    layoutRail();
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
    if (node.kind === 'cloze') return '✍️';
    // Basics drills read at a glance on the path.
    const drill = node.part.drill;
    if (drill === 'tone') return '🎵';
    if (drill === 'sound') return '👂';
    if (drill === 'radical') return '🧩';
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
    modalHead(body, '📖 Read the text', lesson);
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
      rowEl.appendChild(speakerBtn(spoken(w)));
      list.appendChild(rowEl);
    }
    body.appendChild(list);
  }

  // ---- Reference (附錄) ------------------------------------------------------
  // The book's back-matter as a band at the foot of the path: one button per
  // reference doc, each opening the shared modal. Not SRS, not gated.

  function referenceBand(refs) {
    const band = el('div', 'band reference');
    const banner = el('div', 'trail-banner');
    banner.appendChild(el('span', 'trail-banner-name', 'Reference'));
    banner.appendChild(el('span', 'trail-banner-zh', Lang.zh('附錄')));
    band.appendChild(banner);
    const row = el('div', 'section-actions ref-actions');
    for (const doc of refs) {
      const btn = el('button', 'sec-btn', (doc.icon ? doc.icon + ' ' : '') + doc.title);
      btn.addEventListener('click', () => openModal((b) => buildReference(b, doc)));
      row.appendChild(btn);
    }
    band.appendChild(row);
    return band;
  }

  function refHead(body, doc) {
    body.appendChild(el('div', 'modal-kicker', (doc.icon ? doc.icon + ' ' : '') + 'Reference'));
    body.appendChild(el('div', 'modal-title', doc.title));
    body.appendChild(el('div', 'modal-sub', Lang.zh(doc.zh)));
  }

  function buildReference(body, doc) {
    if (doc.kind === 'table') return buildRefTable(body, doc);
    if (doc.kind === 'glossary') return buildRefGlossary(body, doc);
    if (doc.kind === 'passage') return buildRefPassage(body, doc);
  }

  // A grouped table of parts/characters (the radicals doc): each row is a big
  // glyph and its book name/meaning, under a group heading.
  function buildRefTable(body, doc) {
    refHead(body, doc);
    if (doc.intro) body.appendChild(el('p', 'ref-intro', doc.intro));
    for (const g of (doc.groups || [])) {
      if (g.title) body.appendChild(el('div', 'ref-group', g.title));
      const grid = el('div', 'ref-table');
      for (const r of (g.rows || [])) {
        const cell = el('div', 'ref-cell');
        cell.appendChild(el('div', 'ref-hz', Lang.zh(r.hz)));
        cell.appendChild(el('div', 'ref-name', r.name));
        grid.appendChild(cell);
      }
      body.appendChild(grid);
    }
  }

  // A long word list (Bible books, the cumulative glossary): hanzi · pinyin ·
  // gloss with a per-word play button, plus a live filter box for long lists.
  // Accepts either a flat `words` list or `groups:[{title, words}]`.
  // Gather every distinct word taught across the current book's lessons, sorted
  // like a dictionary (by pinyin). Powers the auto-generated cumulative glossary.
  function bookGlossaryWords() {
    const seen = new Set(); const words = [];
    const book = C101.currentBook();
    for (const ch of (book ? book.chapters : []))
      for (const l of ch.lessons)
        for (const w of l.words)
          if (!seen.has(w.hanzi)) { seen.add(w.hanzi); words.push(w); }
    words.sort((a, b) => (a.pinyin || '').toLowerCase().localeCompare((b.pinyin || '').toLowerCase()));
    return words;
  }

  function buildRefGlossary(body, doc) {
    refHead(body, doc);
    // Normalize to groups; count total for the filter threshold.
    const groups = doc.source === 'book-words'
      ? [{ title: null, words: bookGlossaryWords() }]
      : doc.groups || [{ title: null, words: doc.words || [] }];
    const total = groups.reduce((n, g) => n + g.words.length, 0);
    if (doc.note) body.appendChild(el('p', 'ref-intro', doc.note));

    const wordRow = (w) => {
      const rowEl = el('div', 'vocab-row');
      const main = el('div', 'vocab-main');
      main.appendChild(el('div', 'vocab-hz', Lang.zh(w.hanzi)));
      main.appendChild(el('div', 'vocab-py', w.pinyin));
      rowEl.appendChild(main);
      rowEl.appendChild(el('div', 'vocab-en', w.en));
      rowEl.appendChild(speakerBtn(spoken(w)));
      return rowEl;
    };
    const match = (w, needle) => !needle ||
      w.hanzi.includes(needle) || (w.pinyin || '').toLowerCase().includes(needle) ||
      (w.en || '').toLowerCase().includes(needle);

    const list = el('div', 'vocab-list');
    const render = (q) => {
      list.innerHTML = '';
      const needle = (q || '').trim().toLowerCase();
      let shown = 0;
      for (const g of groups) {
        const hits = g.words.filter((w) => match(w, needle));
        if (!hits.length) continue;
        if (g.title) list.appendChild(el('div', 'ref-group', g.title));
        for (const w of hits) { list.appendChild(wordRow(w)); shown++; }
      }
      if (!shown) list.appendChild(el('p', 'ref-intro', 'No matches.'));
    };

    if (total > 24) {
      const search = el('input', 'ref-search');
      search.type = 'search';
      search.placeholder = 'Filter ' + total + ' words — hanzi, pinyin or English';
      search.addEventListener('input', () => render(search.value));
      body.appendChild(search);
    }
    body.appendChild(list);
    render('');
  }

  // A prose passage (closing prayer, appendix essays): each section is Chinese to
  // read, with a Play (TTS) button and an English reveal — like the reading modal.
  function buildRefPassage(body, doc) {
    refHead(body, doc);
    const sections = doc.sections || [];
    const allZh = sections.map(s => s.zh).join('\n');

    const controls = el('div', 'reading-controls');
    const play = el('button', 'pill-btn', '🔊 Play');
    play.addEventListener('click', () => Audio101.speak(allZh));
    controls.appendChild(play);
    const toggle = el('button', 'pill-btn', 'Show English');
    controls.appendChild(toggle);
    body.appendChild(controls);

    const ens = [];
    for (const sec of sections) {
      const zhWrap = el('div', 'reading-zh');
      paragraphs(sec.zh).forEach((p) => zhWrap.appendChild(el('p', 'reading-p', Lang.zh(p))));
      body.appendChild(zhWrap);
      const en = el('div', 'reading-en');
      paragraphs(sec.en).forEach((p) => en.appendChild(el('p', 'reading-p', p)));
      en.hidden = true;
      body.appendChild(en);
      ens.push(en);
    }
    toggle.addEventListener('click', () => {
      const show = ens[0] ? ens[0].hidden : false;
      ens.forEach((en) => { en.hidden = !show; });
      toggle.textContent = show ? 'Hide English' : 'Show English';
    });
  }

  // ---- Jump menu ------------------------------------------------------------
  // A floating control that scrolls the (long) path to the current lesson or to
  // any chapter. Rebuilt each render from jumpTargets.

  // The waypoints of the path, for both the Jump menu and the rail: chapters
  // when the book has several, otherwise its sections — a one-chapter book
  // (Course 101 so far) would get a single useless waypoint.
  function pathAnchors() {
    return jumpTargets.chapters.length >= 2 ? jumpTargets.chapters : jumpTargets.sections;
  }

  function buildJumpMenu() {
    const menu = $('#jump-menu');
    if (!menu) return;
    menu.innerHTML = '';
    const items = [];
    if (jumpTargets.current) items.push({ label: '▸ Current lesson', el: jumpTargets.current, cur: true });
    pathAnchors().forEach((c) => items.push({ label: c.title, el: c.el }));
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

  // ---- Chapter rail ---------------------------------------------------------
  // A book can run long — the Good News Reader is 7 chapters / 25 sections /
  // ~150 nodes — and flicking down to chapter 6 on a phone is miserable. The
  // rail is a mini-map of the path pinned to the right edge: a tick per waypoint
  // at its true position in the page, a thumb showing the slice you're looking
  // at, and a green dot for the lesson you're up to. Tap a tick to jump; drag
  // anywhere on the rail to scrub, with the waypoint name shown as you pass it.
  //
  // It measures the live document, so it lays out after render (in the same
  // frame as the trail) and re-lays out whenever the page height can change.

  const RAIL_MIN_PAGES = 1.6;  // don't take up screen unless the path is this tall
  const RAIL_SNAP = 0.05;      // tap within this fraction of a tick = jump to it
  const RAIL_DRAG = 6;         // px of movement before a tap becomes a scrub
  const HEADER_PAD = 76;       // sticky app-header + air, when landing on a waypoint

  let railStops = [];          // {frac, title, el} — the tappable waypoints
  let railDrag = null;         // {moved} while a pointer is down on the rail

  function docHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function absTop(node) { return node.getBoundingClientRect().top + window.scrollY; }

  // (Re)build the ticks from measured positions. Cheap enough to run whole.
  function layoutRail() {
    const rail = $('#path-rail');
    if (!rail) return;
    const stops = pathAnchors();
    const docH = docHeight();
    railStops = [];
    // Nothing to navigate: a short path scrolls fine on its own.
    if (stops.length < 2 || docH < window.innerHeight * RAIL_MIN_PAGES) {
      rail.hidden = true;
      rail.innerHTML = '';
      document.body.classList.remove('has-rail');
      return;
    }
    rail.hidden = false;
    // The rail swallows pointers in its strip, so the page keeps a gutter clear
    // for it. The book tabs are the exception — squeezing them wraps their names
    // onto a third line — so the rail simply starts below them instead. They sit
    // at the top of the document and scroll away, so their at-rest bottom edge is
    // the only position that can ever collide.
    document.body.classList.add('has-rail');
    const tabs = $('#book-tabs');
    rail.style.top = tabs && !tabs.hidden
      ? Math.round(absTop(tabs) + tabs.offsetHeight + 10) + 'px' : '';
    rail.innerHTML = '';
    rail.appendChild(el('div', 'rail-track'));

    // Numbers only while they stay legible; past that the ticks are plain dots
    // and the drag label carries the names.
    const numbered = stops.length <= 12;
    stops.forEach((s, i) => {
      const frac = clamp01(absTop(s.el) / docH);
      const tick = el('div', 'rail-tick' + (numbered ? '' : ' dot'));
      tick.style.top = (frac * 100) + '%';
      if (numbered) tick.appendChild(el('span', 'rail-tick-n', String(i + 1)));
      rail.appendChild(tick);
      railStops.push({ frac, title: s.title, el: s.el, tick });
    });

    // Where you're up to, so the rail answers "where's my lesson?" too.
    if (jumpTargets.current) {
      const here = el('div', 'rail-here');
      const frac = clamp01((absTop(jumpTargets.current) + jumpTargets.current.offsetHeight / 2) / docH);
      here.style.top = (frac * 100) + '%';
      rail.appendChild(here);
      railStops.push({ frac, title: '▸ Current lesson', el: jumpTargets.current, current: true });
    }

    const thumb = el('div', 'rail-thumb');
    rail.appendChild(thumb);
    const label = el('div', 'rail-label');
    label.hidden = true;
    rail.appendChild(label);
    updateRail();
  }

  // Move the thumb to match the scroll position and light the tick we're inside.
  function updateRail() {
    const rail = $('#path-rail');
    if (!rail || rail.hidden) return;
    const thumb = rail.querySelector('.rail-thumb');
    if (!thumb) return;
    const docH = docHeight(), viewH = window.innerHeight, y = window.scrollY;
    thumb.style.height = clamp01(viewH / docH) * 100 + '%';
    thumb.style.top = clamp01(y / docH) * 100 + '%';

    const mid = (y + viewH / 2) / docH;
    let inside = null;
    for (const s of railStops) { if (!s.current && s.frac <= mid) inside = s; }
    for (const s of railStops) {
      if (s.tick) s.tick.classList.toggle('on', s === inside);
    }
  }

  function scrollToAnchor(el_) {
    if (!el_) return;
    window.scrollTo({ top: Math.max(0, absTop(el_) - HEADER_PAD), behavior: 'smooth' });
  }

  // Free scrub: put the grabbed fraction of the document a bit above centre, so
  // what you're aiming at is under your thumb rather than behind it.
  function scrubTo(frac) {
    window.scrollTo({ top: Math.max(0, frac * docHeight() - window.innerHeight * 0.35) });
  }

  function railFrac(e, rail) {
    const r = rail.getBoundingClientRect();
    return clamp01((e.clientY - r.top) / r.height);
  }

  // The waypoint a scrub is currently sitting in (or the nearest one below).
  function railStopAt(frac) {
    let cur = null;
    for (const s of railStops) { if (!s.current && s.frac <= frac + 0.005) cur = s; }
    return cur || railStops.find((s) => !s.current) || null;
  }

  function showRailLabel(frac) {
    const rail = $('#path-rail');
    const label = rail && rail.querySelector('.rail-label');
    const stop = railStopAt(frac);
    if (!label || !stop) return;
    label.textContent = stop.title;
    label.style.top = frac * 100 + '%';
    label.hidden = false;
  }

  function onRailDown(e) {
    const rail = $('#path-rail');
    if (!rail || rail.hidden) return;
    e.preventDefault();
    e.stopPropagation();          // don't let the doc-level handlers close menus mid-drag
    railDrag = { y: e.clientY, moved: false };
    rail.classList.add('dragging');
    if (rail.setPointerCapture) rail.setPointerCapture(e.pointerId);
    showRailLabel(railFrac(e, rail));
  }

  function onRailMove(e) {
    if (!railDrag) return;
    const rail = $('#path-rail');
    if (!railDrag.moved && Math.abs(e.clientY - railDrag.y) < RAIL_DRAG) return;
    railDrag.moved = true;
    const frac = railFrac(e, rail);
    scrubTo(frac);
    showRailLabel(frac);
  }

  // A tap (no real movement) snaps to the tick you aimed at; if you tapped well
  // away from any tick, it just scrolls there.
  function onRailUp(e) {
    if (!railDrag) return;
    const rail = $('#path-rail');
    const moved = railDrag.moved;
    railDrag = null;
    rail.classList.remove('dragging');
    const label = rail.querySelector('.rail-label');
    if (label) label.hidden = true;
    if (moved) return;
    const frac = railFrac(e, rail);
    let best = null, bd = Infinity;
    for (const s of railStops) {
      const d = Math.abs(s.frac - frac);
      if (d < bd) { bd = d; best = s; }
    }
    if (best && bd <= RAIL_SNAP) scrollToAnchor(best.el);
    else window.scrollTo({ top: Math.max(0, frac * docHeight() - window.innerHeight * 0.35), behavior: 'smooth' });
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
    else if (item.kind === 'build' || item.kind === 'dictate') renderBuild(stage, foot, item);
    else if (item.kind === 'type') renderType(stage, foot, item);
    else if (item.kind === 'pairs') renderPairs(stage, foot, item);
    else if (item.kind === 'tone') renderTone(stage, foot, item);
    else if (item.kind === 'hear2py') renderHear(stage, foot, item);
    else if (item.kind === 'contains') renderContains(stage, foot, item);
    else renderMC(stage, foot, item);
  }

  // ---- Basics drills ---------------------------------------------------------
  // All three are option-picking items, so they share onChoose/showFeedback with
  // multiple choice; only the prompt and the option faces differ.

  function optionList(item, faces, foot) {
    const opts = el('div', 'options');
    for (const opt of item.options) {
      const b = el('button', 'option');
      faces(b, opt);
      b.dataset.val = opt;  // canonical value — grading and reveal read this
      b.addEventListener('click', () => onChoose(item, opt, b, opts, foot));
      opts.appendChild(b);
    }
    return opts;
  }

  // Tone: hear the word, pick the tone. The options are the word's own syllables
  // spelled under each candidate tone, so the learner chooses between real
  // pinyin ("mā / má / mǎ / mà / ma") rather than bare numbers.
  function renderTone(stage, foot, item) {
    stage.appendChild(el('div', 'prompt-label',
      item.bases.length > 1 ? 'Which tones?' : 'Which tone?'));

    const p = el('div', 'prompt-hanzi');
    p.appendChild(el('span', 'hanzi-md', Lang.zh(item.word.hanzi)));
    p.appendChild(speakerBtn(spoken(item.word)));
    stage.appendChild(p);
    stage.appendChild(el('div', 'prompt-en', item.word.en));
    Audio101.speak(spoken(item.word));

    stage.appendChild(optionList(item, (b, opt) => {
      b.classList.add('option-tone');
      b.appendChild(el('span', 'opt-hanzi', Pinyin.spell(item.bases, opt)));
      b.appendChild(el('span', 'opt-pinyin', toneCaption(opt)));
    }, foot));
  }

  // "2-4" -> "rising · falling" (a single tone just names itself).
  function toneCaption(pattern) {
    return String(pattern).split('-').map(t => Pinyin.toneName(Number(t))).join(' · ');
  }

  // Sound: hear it, pick the spelling out of the lesson's minimal-pair set.
  function renderHear(stage, foot, item) {
    stage.appendChild(el('div', 'prompt-label', 'What did you hear?'));
    const big = speakerBtn(spoken(item.word));
    big.className = 'speaker speaker-big';
    big.textContent = '🔊';
    stage.appendChild(big);
    Audio101.speak(spoken(item.word));

    stage.appendChild(optionList(item, (b, opt) => {
      b.appendChild(el('span', 'opt-hanzi', opt));
    }, foot));
  }

  // Radical: which of these real words contains this character part?
  //
  // Deliberately NOT script-converted, unlike every other drill. The question is
  // about the shape on the page, and simplification rewrites the parts: 言 shrinks
  // to 讠 inside 说话, so "which word contains 言?" would have no true answer in
  // Simplified. Canonical Traditional here keeps the question answerable, with a
  // caption saying so when that differs from what the learner picked.
  function renderContains(stage, foot, item) {
    stage.appendChild(el('div', 'prompt-label', 'Which character contains this part?'));
    const p = el('div', 'prompt-hanzi');
    p.appendChild(el('span', 'hanzi-md', item.word.hanzi));
    stage.appendChild(p);
    stage.appendChild(el('div', 'prompt-en', item.word.en));
    if (Lang.current().convert) {
      stage.appendChild(el('div', 'prompt-note', 'Traditional forms — the parts are what changed in simplification.'));
    }

    stage.appendChild(optionList(item, (b, opt) => {
      b.appendChild(el('span', 'opt-hanzi', opt));
      const w = C101.word(opt);
      if (w) b.appendChild(el('span', 'opt-pinyin', w.pinyin));
    }, foot));
  }

  // Sentence building: tap word tiles in order to assemble the Chinese. The
  // answer tray is the working area; tapping a placed tile sends it back.
  // 'dictate' hides the English and plays the sentence instead.
  function renderBuild(stage, foot, item) {
    const listen = item.kind === 'dictate';
    stage.appendChild(el('div', 'prompt-label',
      listen ? 'Listen, then build the sentence' : 'Build the sentence'));

    if (listen) {
      const big = speakerBtn(item.zh);
      big.className = 'speaker speaker-big';
      big.textContent = '🔊';
      stage.appendChild(big);
      Audio101.speak(item.zh);
    } else {
      stage.appendChild(el('div', 'build-en', item.en));
    }

    const tray = el('div', 'build-tray');
    const bank = el('div', 'build-bank');
    stage.appendChild(tray);
    stage.appendChild(bank);

    const chosen = [];   // canonical tokens, in tap order
    const check = el('button', 'continue', 'Check');
    check.disabled = true;

    function sync() {
      check.disabled = chosen.length === 0;
    }
    function placeInTray(tok, bankBtn) {
      const t = el('button', 'tile tile-placed', Lang.zh(tok));
      t.dataset.val = tok;
      t.addEventListener('click', () => {
        if (answered) return;
        const i = chosen.indexOf(tok);
        // remove this exact placement (first match is fine — tiles are 1:1)
        if (i >= 0) chosen.splice(i, 1);
        tray.removeChild(t);
        bankBtn.disabled = false;
        bankBtn.classList.remove('tile-used');
        sync();
      });
      tray.appendChild(t);
    }
    for (const tok of item.tiles) {
      const b = el('button', 'tile', Lang.zh(tok));
      b.dataset.val = tok;
      b.addEventListener('click', () => {
        if (answered || b.disabled) return;
        chosen.push(tok);
        b.disabled = true;
        b.classList.add('tile-used');
        placeInTray(tok, b);
        sync();
      });
      bank.appendChild(b);
    }

    check.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const guess = chosen.join('');
      const ok = guess === item.correct;
      bank.querySelectorAll('.tile').forEach(t => { t.disabled = true; });
      tray.querySelectorAll('.tile').forEach(t => { t.disabled = true; });
      tray.classList.add(ok ? 'ok' : 'bad');
      foot.innerHTML = '';
      showFeedback(item, guess, ok, foot);
    });
    foot.appendChild(check);
  }

  // Typed recall: English gloss in, hanzi or tone-tolerant pinyin out. No options.
  function renderType(stage, foot, item) {
    stage.appendChild(el('div', 'prompt-label', 'Type it — no options'));
    stage.appendChild(el('div', 'prompt-en', item.word.en));

    const form = el('div', 'type-form type-solo');
    const input = el('input', 'type-input');
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'pinyin, e.g. shengming');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocomplete', 'off');
    form.appendChild(input);
    stage.appendChild(form);
    setTimeout(() => input.focus(), 0);

    const check = el('button', 'continue', 'Check');
    const grade = () => {
      if (answered) return;
      const val = input.value.trim();
      if (!val) return;
      answered = true;
      const ok = Session.pinyinMatches(val, item.word);
      input.disabled = true;
      input.classList.add(ok ? 'correct' : 'wrong');
      foot.innerHTML = '';
      showFeedback(item, val, ok, foot);
    };
    check.addEventListener('click', grade);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') grade(); });
    foot.appendChild(check);
  }

  // Matching board: tap a hanzi then its English (or vice versa) until clear.
  // Completing the board is the "answer"; a perfect clear counts as correct.
  function renderPairs(stage, foot, item) {
    stage.appendChild(el('div', 'prompt-label', 'Tap the pairs'));

    const cells = [];
    item.words.forEach((w) => {
      cells.push({ key: w.hanzi, face: Lang.zh(w.hanzi), zh: true, say: spoken(w) });
      cells.push({ key: w.hanzi, face: w.en, zh: false, say: spoken(w) });
    });
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    const board = el('div', 'pairs-board');
    let sel = null, left = item.words.length, misses = 0, busy = false;

    cells.forEach((c) => {
      const b = el('button', 'pair-cell' + (c.zh ? ' pair-zh' : ''), c.face);
      b.dataset.key = c.key;
      b.addEventListener('click', () => {
        if (answered || busy || b.classList.contains('matched') || b === sel) return;
        if (!sel) { sel = b; b.classList.add('sel'); return; }
        const a = sel;
        if (a.dataset.key === b.dataset.key) {
          a.classList.remove('sel');
          a.classList.add('matched'); b.classList.add('matched');
          a.disabled = b.disabled = true;
          sel = null;
          Audio101.speak(c.say);
          if (--left === 0) {
            answered = true;
            foot.innerHTML = '';
            showFeedback(item, true, misses === 0, foot);
          }
        } else {
          misses += 1;
          busy = true;
          b.classList.add('miss'); a.classList.add('miss');
          Audio101.SFX.wrong();
          setTimeout(() => {
            a.classList.remove('sel', 'miss'); b.classList.remove('miss');
            sel = null; busy = false;
          }, 420);
        }
      });
      board.appendChild(b);
    });
    stage.appendChild(board);
  }

  function renderIntro(stage, foot, item) {
    const w = item.word;
    stage.appendChild(el('div', 'prompt-label', 'New word'));
    const card = el('div', 'flashcard');
    const hz = el('div', 'hanzi-lg', Lang.zh(w.hanzi));
    hz.appendChild(speakerBtn(spoken(w)));
    card.appendChild(hz);
    card.appendChild(el('div', 'pinyin-lg', w.pinyin));
    card.appendChild(el('div', 'gloss-lg', w.en));
    // A radical's own note ("nearly every character with this part relates to
    // water") is the whole reason to learn it, so the intro card carries it.
    if (w.note) card.appendChild(el('div', 'gloss-note', w.note));
    stage.appendChild(card);
    Audio101.speak(spoken(w));

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
      p.appendChild(speakerBtn(spoken(item.word)));
      stage.appendChild(p);
      if (!reading) stage.appendChild(el('div', 'prompt-pinyin', item.word.pinyin));
    } else if (item.kind === 'en2zh') {
      stage.appendChild(el('div', 'prompt-label', 'Pick the Chinese'));
      stage.appendChild(el('div', 'prompt-en', item.word.en));
    } else { // listen
      stage.appendChild(el('div', 'prompt-label', 'What did you hear?'));
      const big = speakerBtn(spoken(item.word));
      big.className = 'speaker speaker-big';
      big.textContent = '🔊';
      stage.appendChild(big);
      Audio101.speak(spoken(item.word));
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
    // Passage clozes come straight from the book text and carry no translation —
    // the surrounding Chinese is the only context, which is the point.
    stage.appendChild(el('div', 'prompt-label',
      item.en ? 'Fill in the blank' : 'From the reading — fill in the blank'));
    if (item.en) stage.appendChild(el('div', 'cloze-en', item.en));

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

    showFeedback(item, choice, ok, foot);
  }

  // Shared end-of-item feedback: sound, banner with the right answer, Continue.
  // Every exercise kind funnels through here so grading stays in one place.
  function showFeedback(item, choice, ok, foot) {
    ok ? Audio101.SFX.correct() : Audio101.SFX.wrong();

    foot.classList.add(ok ? 'ok' : 'bad');
    const banner = el('div', 'feedback');
    if (ok) {
      banner.textContent = 'Correct!';
    } else if (item.kind === 'build' || item.kind === 'dictate') {
      banner.textContent = `Answer: ${Lang.zh(item.zh)}`;
    } else if (item.kind === 'type') {
      banner.textContent = `Answer: ${Lang.zh(item.word.hanzi)} (${item.word.pinyin})`;
    } else if (item.kind === 'tone') {
      // The answer is a tone pattern; show it as the spelling it produces.
      banner.textContent = `Answer: ${Pinyin.spell(item.bases, item.correct)}` +
        ` — ${toneCaption(item.correct)}`;
    } else if (item.kind === 'hear2py') {
      banner.textContent = `Answer: ${item.correct} ${Lang.zh(item.word.hanzi)}`;
    } else if (item.kind === 'contains') {
      // Canonical, to match the (unconverted) question.
      const w = C101.word(item.correct);
      banner.textContent = `Answer: ${item.correct}` + (w ? ` (${w.pinyin}) — ${w.en}` : '');
    } else {
      banner.textContent = `Answer: ${Lang.zh(item.correct)}` +
        (item.kind !== 'zh2en' && C101.word(item.correct)
          ? ` (${C101.word(item.correct).pinyin})` : '');
    }
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
    restoreBook();       // re-select the last-used book before first render
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
    // Chapter rail: pointer-driven, so it owns its gestures outright.
    const rail = $('#path-rail');
    if (rail) {
      rail.addEventListener('pointerdown', onRailDown);
      rail.addEventListener('pointermove', onRailMove);
      rail.addEventListener('pointerup', onRailUp);
      rail.addEventListener('pointercancel', onRailUp);
    }
    // Follow the scroll with the thumb, at most once a frame.
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; updateRail(); });
    }, { passive: true });

    // Re-measure the connecting trail when the layout can shift.
    let t = null;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(redrawTrail, 120); });
    window.addEventListener('load', redrawTrail);
    renderHome();
    showScreen('home');
  }

  return { init, showScreen, renderHome };
})();
