// ui.js — screens, home dashboard, and exercise rendering. Reads State/SRS/
// Session; owns all DOM. Screen pattern: .screen + .screen.active, showScreen(id).
'use strict';

const UI = (function () {
  let session = null;   // active Session or null
  let answered = false; // has the current item been answered (awaiting Continue)?
  let xpAtStart = 0;    // XP when this session began — the results chip counts up from it
  const $ = (sel, root) => (root || document).querySelector(sel);

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Every screen shares the document's one scroll position, and the home path
    // is now deliberately parked deep in the page. Without this, opening a lesson
    // from halfway down the trail starts the question already scrolled past.
    if (id !== 'home') window.scrollTo({ top: 0 });
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

  // ---- Header pickers: display script, and colour theme ----------------------
  // Two small dropdowns with identical mechanics, so they share one builder. Both
  // are driven by their module's own list (Lang.langs(), Theme.themes()), so
  // adding an option later needs no UI change here.
  function buildPicker(root, spec) {
    if (!root) return;
    root.innerHTML = '';

    const btn = el('button', 'lang-btn');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', spec.label);
    btn.appendChild(el('span', 'lang-cur', spec.current().label));
    btn.appendChild(el('span', 'lang-caret', '▾'));

    const menu = el('ul', 'lang-menu');
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    for (const opt of spec.options()) {
      const li = el('li', 'lang-opt', opt.name);
      li.setAttribute('role', 'option');
      if (opt.id === spec.current().id) li.classList.add('sel');
      li.addEventListener('click', () => { spec.onPick(opt.id); closeMenus(); });
      menu.appendChild(li);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = menu.hidden;
      closeMenus();   // at most one picker is ever open, including the other one
      if (opening) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
    });

    root.appendChild(btn);
    root.appendChild(menu);
  }

  // Picking a script re-renders everything through Lang.zh(...).
  function buildLangSelect() {
    buildPicker($('#lang-select'), {
      label: 'Display script',
      options: Lang.langs, current: Lang.current,
      onPick: (id) => { if (Lang.set(id)) { buildLangSelect(); applyLang(); } }
    });
  }

  // Picking a theme needs no re-render: the palette is CSS tokens, and the one
  // JS-side consumer (the results confetti) reads them at draw time.
  function buildThemeSelect() {
    buildPicker($('#theme-select'), {
      label: 'Colour theme',
      options: Theme.themes, current: Theme.current,
      onPick: (id) => { if (Theme.set(id)) buildThemeSelect(); }
    });
  }

  // Close every open picker menu. Bound once to document in init so rebuilding a
  // picker doesn't stack listeners.
  function closeMenus() {
    document.querySelectorAll('.lang-menu').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('.lang-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
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

  // ---- Track picker ---------------------------------------------------------
  // A book may run as parallel tracks (Basics: Phonics / Radicals). Stored as a
  // bookId -> trackId map, not a bare string: that way a track id can never be
  // applied to the wrong book, and coming back to a book returns you to the
  // track you left.
  const TRACK_KEY = 'c101.track.v1';

  function savedTracks() {
    try { return JSON.parse(localStorage.getItem(TRACK_KEY)) || {}; } catch (e) { return {}; }
  }
  function restoreTracks() {
    const map = savedTracks();
    // setTrack validates, so a track id left behind by an edited content file is
    // simply dropped — same contract as setBook.
    for (const bookId of Object.keys(map)) C101.setTrack(map[bookId], bookId);
  }
  function chooseTrack(id) {
    if (!C101.setTrack(id)) return;
    const book = C101.currentBook();
    const map = savedTracks();
    if (book) map[book.id] = id;
    try { localStorage.setItem(TRACK_KEY, JSON.stringify(map)); } catch (e) { /* best-effort */ }
    renderHome();
  }

  // A segmented control under the book tabs, deliberately lighter than them: two
  // rows of identical-looking tabs would fight over which is the primary choice.
  function buildTrackTabs() {
    const root = $('#track-tabs');
    if (!root) return;
    root.innerHTML = '';
    const list = C101.tracks();
    if (list.length < 2) { root.hidden = true; return; }
    root.hidden = false;
    const curId = (C101.currentTrack() || {}).id;
    for (const tr of list) {
      const tab = el('button', 'track-tab' + (tr.id === curId ? ' active' : ''));
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', tr.id === curId ? 'true' : 'false');
      tab.appendChild(el('span', 'track-tab-name', tr.title));
      if (tr.zh) tab.appendChild(el('span', 'track-tab-zh', Lang.zh(tr.zh)));
      tab.addEventListener('click', () => { if (tr.id !== curId) chooseTrack(tr.id); });
      root.appendChild(tab);
    }
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
  // The node whose session was opened last. The path lands here on the way back,
  // in preference to the current lesson — replaying an old node in chapter 5 and
  // then being thrown forward to chapter 2 is not "where I was".
  let lastPlayedId = null;
  // Where focusPath last parked the page, so a later re-aim can tell "the reader
  // hasn't moved" from "the reader scrolled away". null = we didn't place it.
  let focusedAt = null;

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

  // `focus` is how the page should land afterwards: 'auto' (default) drops you
  // there, 'smooth' travels — used on the way back from a session so advancing a
  // node reads as movement rather than a jump cut.
  function renderHome(focus) {
    const s = State.get();
    $('#stat-streak').textContent = s.streak;
    $('#stat-xp').textContent = s.xp;

    buildBookTabs();
    buildTrackTabs();
    const book = C101.currentBook();
    const tag = document.querySelector('.tagline');
    if (tag && book) {
      tag.textContent = 'Vocabulary from ';
      tag.appendChild(el('em', null, book.tagline));
      tag.appendChild(document.createTextNode('.'));
    }

    // The Review button opens the hub and is never disabled — "I want to revise"
    // has to be actionable even when the schedule has nothing due.
    const due = SRS.dueWords().length;
    const reviewBtn = $('#review-btn');
    reviewBtn.textContent = due ? `Review · ${due} due` : 'Review';
    reviewBtn.disabled = false;

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
        // The id is what a crossover link targets; pathAnchors/layoutRail only
        // ever read .title and .el, so carrying it is free.
        jumpTargets.sections.push({ id: sec.id, title: sec.title, el: band });
        band.appendChild(sectionBanner(sec));
        for (const node of sec.nodes) band.appendChild(nodeRow(node, rowIdx++));
        band.appendChild(sectionActions(C101.lesson(sec.id)));
        const cross = crossoverCard(C101.lesson(sec.id));
        if (cross) band.appendChild(cross);
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
    //
    // Rail FIRST: layoutRail toggles body.has-rail, which changes .home-main's
    // padding and so moves every node sideways. Measuring the trail before that
    // ran left the line offset from the bubbles it connects — invisible while the
    // rail's presence never changed mid-render, but it does now.
    requestAnimationFrame(() => {
      layoutRail();
      drawTrail(scene);
      focusPath(focus);
    });
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

  // ---- Crossovers between tracks --------------------------------------------
  // A lesson may recommend another one: `crossover: { to, why }`. The point is
  // that the two Basics tracks teach each other — the 氵 you just met is the
  // part in 洗, and 洗 vs 西 is exactly the sound contrast next door.
  //
  // Deliberately a card at the foot of the band, NOT a node on the path: a node
  // would take a seq, join the trail polyline, and need a cleared state it
  // hasn't got — and it would break the contiguous-cleared-prefix gold fill.
  //
  // The target's track is derived, never stored, so a chapter changing tracks
  // can't leave a stale pointer behind.
  function crossoverCard(lesson) {
    const x = lesson && lesson.crossover;
    if (!x) return null;
    const target = C101.lesson(x.to);
    const dest = C101.trackOfLesson(x.to);
    if (!target || !dest) return null;   // fail soft; the test is what catches typos

    const book = (C101.books().find(b => b.id === dest.bookId) || {});
    const track = book.trackIndex && book.trackIndex.get(dest.trackId);
    const card = el('button', 'crossover-card');
    card.appendChild(el('div', 'crossover-kicker',
      track ? `↗ Also in ${track.title}` : '↗ Also see'));
    const name = el('div', 'crossover-name', target.title);
    if (target.zh) name.appendChild(el('span', 'crossover-zh', ' ' + Lang.zh(target.zh)));
    card.appendChild(name);
    if (x.why) card.appendChild(el('div', 'crossover-why', x.why));
    card.addEventListener('click', () => goToLesson(x.to));
    return card;
  }

  // Switch to whatever book/track a lesson lives in, then scroll to its band.
  function goToLesson(lessonId) {
    const dest = C101.trackOfLesson(lessonId);
    if (!dest) return;
    const book = C101.currentBook();
    if (book && dest.bookId !== book.id) chooseBook(dest.bookId);
    if (dest.trackId && dest.trackId !== (C101.currentTrack() || {}).id) chooseTrack(dest.trackId);
    // renderHome fills jumpTargets synchronously, but the band's position isn't
    // settled until the same frame the trail is measured in.
    requestAnimationFrame(() => {
      const stop = jumpTargets.sections.find(s => s.id === lessonId);
      if (stop) scrollToAnchor(stop.el);
    });
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

  // ---- The Review hub -------------------------------------------------------
  // Review used to be a single button that drained the SRS inbox and then
  // disabled itself, which made it effectively once-a-day: the shortest non-zero
  // Leitner interval is 4h and the typical one is a day, so after a clean pass
  // there was nothing due and no way to say "drill me on chapter 3 again".
  //
  // The hub is always open. Its modes differ only in which words they choose;
  // the session they build is the same. Everything except "Due now" grades with
  // onlyIfDue, so choosing to revise early can't push a word's next review out.

  // The words of one chapter that the learner has actually met, deduped.
  function seenInChapter(chapter) {
    const out = [], got = new Set();
    for (const lesson of chapter.lessons) {
      for (const w of lesson.words) {
        if (got.has(w.hanzi)) continue;
        got.add(w.hanzi);
        if (!SRS.isNew(w.hanzi)) out.push(C101.word(w.hanzi) || w);
      }
    }
    return out;
  }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function reviewModeRow(body, spec) {
    const n = spec.words.length;
    // The count is what this row will actually drill, not how big the pool is:
    // a session takes CONFIG.REVIEW_SIZE words, so printing "61" next to a
    // 12-word session reads as a promise it doesn't keep. Where the pool is
    // bigger, the hint says so.
    const size = Math.min(n, CONFIG.REVIEW_SIZE);
    const row = el('button', 'review-mode' + (n ? '' : ' empty'));
    row.disabled = !n;
    const main = el('div', 'review-mode-main');
    main.appendChild(el('div', 'review-mode-name', spec.name));
    const hint = n > size && spec.backlog
      ? `${spec.hint} · ${n} waiting`
      : spec.hint;
    if (hint) main.appendChild(el('div', 'review-mode-hint', hint));
    row.appendChild(main);
    row.appendChild(el('div', 'review-mode-count', n ? String(size) : '—'));
    if (n) {
      row.addEventListener('click', () => {
        closeModal();
        startReview(spec.words, { title: spec.name, zh: spec.zh, onlyIfDue: spec.onlyIfDue });
      });
    }
    body.appendChild(row);
    return row;
  }

  function buildReviewHub(body) {
    const due = SRS.dueWords();
    const seen = SRS.seenWords();
    const weak = SRS.weakWords();

    body.appendChild(el('div', 'modal-kicker', 'Review'));
    body.appendChild(el('div', 'modal-title', 'What would you like to go over?'));
    body.appendChild(el('div', 'modal-sub',
      seen.length ? `${seen.length} words met so far` : 'Nothing learned yet — start a lesson.'));

    reviewModeRow(body, { name: 'Due now', zh: '複習', words: due, backlog: true,
      hint: due.length ? 'Closest to being forgotten'
                       : 'Nothing is due — try one of the others' });
    reviewModeRow(body, { name: 'Weakest words', zh: '弱點', words: weak, onlyIfDue: true,
      hint: 'The ones you keep getting wrong' });
    reviewModeRow(body, { name: 'Random mix', zh: '隨機', words: shuffled(seen), onlyIfDue: true,
      hint: 'Anything you\'ve met, in any book' });

    // Per-chapter redrills, across every book — the "I want chapter 3 again"
    // case, which the schedule alone can never offer.
    const groups = [];
    for (const book of C101.books()) {
      for (const ch of book.chapters) {
        const words = seenInChapter(ch);
        if (words.length) groups.push({ book, ch, words });
      }
    }
    if (groups.length) {
      body.appendChild(el('div', 'ref-group', 'By chapter'));
      let lastBook = null;
      for (const g of groups) {
        if (g.book !== lastBook && C101.books().length > 1) {
          body.appendChild(el('div', 'review-book', g.book.title));
          lastBook = g.book;
        }
        reviewModeRow(body, { name: g.ch.title, zh: g.ch.zh, words: shuffled(g.words),
                              onlyIfDue: true });
      }
    }
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
    if (jumpTargets.current) items.push({ label: '▸ Current lesson', cur: true });
    pathAnchors().forEach((c) => items.push({ label: c.title, el: c.el }));
    for (const it of items) {
      const li = el('li', 'jump-item' + (it.cur ? ' jump-cur' : ''), it.label);
      li.setAttribute('role', 'menuitem');
      // Waypoints land under the sticky header; "current lesson" is framed the
      // same way arriving on the path frames it, so the two routes agree. It asks
      // for the *current* node specifically — not focusPath's last-played
      // preference, which would send you somewhere the label didn't promise.
      li.addEventListener('click', () => {
        it.cur ? focusOn(jumpTargets.current, 'smooth') : scrollToAnchor(it.el);
        closeJump();
      });
      menu.appendChild(li);
    }
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
    // Never rebuild the control someone is currently holding. layoutRail wipes
    // the rail's contents, and a scrub scrolls the page, which on a phone fires
    // resize as the URL bar collapses — so without this the thumb and label you
    // are dragging get destroyed and recreated mid-gesture.
    if (railDrag) return;
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
    // Start below whichever header rows are showing — the track row is a second
    // one, and the rail would otherwise sit on top of it.
    const rows = [$('#book-tabs'), $('#track-tabs')].filter(r => r && !r.hidden);
    rail.style.top = rows.length
      ? Math.round(Math.max(...rows.map(r => absTop(r) + r.offsetHeight)) + 10) + 'px' : '';
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
    // Same frame as the scrub — see dragFrame. During a drag this fires on every
    // scroll the scrub causes, and reading a live innerHeight here meant the thumb
    // grew and shifted as the URL bar collapsed, under a finger that hadn't moved.
    const f = dragFrame();
    const docH = f.docH, viewH = f.viewH, y = window.scrollY;
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

  // ---- Landing on your place in the path -------------------------------------
  // Opening at the top of a 23,000px path and hunting for where you are was the
  // one thing to survive the first phone playtest. The rail and the Jump menu are
  // for going somewhere *deliberately*; resuming shouldn't need either.
  const FOCUS_BIAS = 0.45;  // fraction of the viewport left above the target

  function focusTarget() {
    if (lastPlayedId) {
      const played = trailNodeEls.find(({ node }) => node.id === lastPlayedId);
      if (played) return played.btn;
    }
    return jumpTargets.current;
  }

  function focusPath(behavior) { focusOn(focusTarget(), behavior); }

  // Put a node a little above centre, so the path ahead is visible rather than
  // sitting under the fold.
  function focusOn(target, behavior) {
    const how = behavior || 'auto';
    // Nothing to resume (a finished book, or a path with no nodes): show the top.
    if (!target) { window.scrollTo({ top: 0, behavior: how }); focusedAt = 0; return; }
    const r = target.getBoundingClientRect();
    // Already looking straight at it — don't jiggle the page for nothing.
    if (r.top >= HEADER_PAD && r.bottom <= window.innerHeight) return;
    window.scrollTo({ top: Math.max(0, absTop(target) - window.innerHeight * FOCUS_BIAS),
                      behavior: how });
    // A smooth scroll hasn't arrived yet, so there's no position to remember; the
    // re-aim below only ever follows an instant one anyway.
    focusedAt = how === 'smooth' ? null : Math.round(window.scrollY);
  }

  // The page and viewport as they were when the finger went down — or as they are
  // now, if no finger is down. EVERY number a gesture computes has to come from
  // here: the scroll it maps to, and the thumb it paints. Mixing a frozen ruler
  // into one and a live ruler into the other is what made the thumb crawl out
  // from under the finger while the page went somewhere else again.
  function dragFrame() {
    return railDrag || { docH: docHeight(), viewH: window.innerHeight };
  }

  // Free scrub: put the grabbed fraction of the document a bit above centre, so
  // what you're aiming at is under your thumb rather than behind it.
  function scrubTo(frac) {
    const f = dragFrame();
    window.scrollTo({ top: Math.max(0, frac * f.docH - f.viewH * 0.35) });
  }

  // Where on the rail a pointer is, 0..1.
  //
  // Measured against the strip as it was at pointerdown. On a phone, scrolling
  // collapses and expands the URL bar, which changes window.innerHeight — and the
  // rail is pinned top-and-bottom, so its height follows. Re-measuring mid-drag
  // meant the same finger position mapped to a different fraction from one frame
  // to the next, and since scrubbing scrolls, the scrub was changing the very
  // ruler it was measured with.
  //
  // Freezing this rect is only half the job, though, and the half that isn't done
  // here: a frozen rect describes a strip that is still visibly resizing, so the
  // arithmetic and the thing under the finger drift apart instead. onRailDown
  // pins the rail's height in the DOM for the gesture as well, which is what makes
  // this frozen rect stay *true* rather than merely stable.
  function railFrac(e, rail) {
    const r = (railDrag && railDrag.rect) || rail.getBoundingClientRect();
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
    // One finger owns the rail until it lets go. A second touch landing in the
    // strip — a thumb steadying the phone against the edge — used to overwrite
    // railDrag outright: new origin, new rect, `moved` reset to false. That second
    // finger's pointerup was then read as a *tap* and snapped the page to wherever
    // it happened to be resting, which is the jump to the top of the path.
    //
    // The exception is a drag that has already ended without telling us. iOS does
    // not always deliver an end event for a gesture it takes over (which is why
    // there are four of them bound), and a drag left open would wedge the rail for
    // good: layoutRail refuses to rebuild while one is live, and the height stays
    // pinned. If we took the capture and no longer hold it, the finger is gone.
    if (railDrag) {
      const stale = railDrag.captured && rail.hasPointerCapture
                 && !rail.hasPointerCapture(railDrag.id);
      if (!stale) return;
      endRailDrag();
    }
    e.preventDefault();
    e.stopPropagation();          // don't let the doc-level handlers close menus mid-drag
    // Freeze the gesture's frame of reference — and freeze it in the DOM too.
    //
    // The rail is pinned top-and-bottom, so its height is the viewport's height
    // less two constants. Scrubbing scrolls, scrolling collapses the URL bar, the
    // viewport grows, and the strip grows with it. Recording the rect alone left
    // the arithmetic stable while the strip under the finger kept resizing, so the
    // two described different rails. Pinning the height in pixels for the duration
    // means the strip on screen and the strip in the arithmetic are one strip, and
    // the URL bar can do as it likes.
    const rect = rail.getBoundingClientRect();
    rail.style.height = rect.height + 'px';
    rail.style.bottom = 'auto';
    railDrag = { id: e.pointerId, y: e.clientY, moved: false,
                 rect, docH: docHeight(), viewH: window.innerHeight };
    rail.classList.add('dragging');
    if (rail.setPointerCapture) {
      rail.setPointerCapture(e.pointerId);
      railDrag.captured = true;
    }
    showRailLabel(railFrac(e, rail));
  }

  function onRailMove(e) {
    if (!railDrag || e.pointerId !== railDrag.id) return;
    const rail = $('#path-rail');
    if (!railDrag.moved && Math.abs(e.clientY - railDrag.y) < RAIL_DRAG) return;
    railDrag.moved = true;
    const frac = railFrac(e, rail);
    scrubTo(frac);
    showRailLabel(frac);
  }

  function endRailDrag() {
    const rail = $('#path-rail');
    const moved = railDrag && railDrag.moved;
    railDrag = null;
    if (!rail) return moved;
    rail.classList.remove('dragging');
    // Hand the strip's height back to the stylesheet, and repaint the thumb on the
    // live ruler now that the frozen one is gone.
    rail.style.height = '';
    rail.style.bottom = '';
    const label = rail.querySelector('.rail-label');
    if (label) label.hidden = true;
    updateRail();
    return moved;
  }

  // The browser took the gesture away (it decided the touch was a page scroll,
  // or a system gesture cut in). Drop it silently — treating it as a tap here is
  // what made a slide fight the native scroll, each jumping the page in turn.
  // Bound to touchcancel and lostpointercapture as well as pointercancel, and
  // those don't all carry a pointerId — so only a positively *mismatched* one is
  // ignored. A cancel we can't attribute still ends the gesture.
  function onRailCancel(e) {
    if (e && e.pointerId != null && railDrag && e.pointerId !== railDrag.id) return;
    endRailDrag();
  }

  // A tap (no real movement) snaps to the tick you aimed at; if you tapped well
  // away from any tick, it just scrolls there.
  function onRailUp(e) {
    if (!railDrag || e.pointerId !== railDrag.id) return;
    const rail = $('#path-rail');
    // Read the position and the frame BEFORE ending the drag: endRailDrag drops
    // the frozen rect and unpins the height, after which railFrac would measure
    // this tap against a differently-sized strip than the one it was aimed at.
    const frac = railFrac(e, rail);
    const f = { docH: railDrag.docH, viewH: railDrag.viewH };
    if (endRailDrag()) return;
    let best = null, bd = Infinity;
    for (const s of railStops) {
      const d = Math.abs(s.frac - frac);
      if (d < bd) { bd = d; best = s; }
    }
    if (best && bd <= RAIL_SNAP) scrollToAnchor(best.el);
    else window.scrollTo({ top: Math.max(0, frac * f.docH - f.viewH * 0.35), behavior: 'smooth' });
  }

  // ---- Session flow ---------------------------------------------------------

  function startPart(part) {
    session = Session.forPart(part);
    if (session.done) return;
    lastPlayedId = part.id;   // so the path lands back here, not on the current node
    beginSession();
  }

  function startTest(chapterId) {
    session = Session.forTest(C101.chapter(chapterId));
    if (session.done) return;
    lastPlayedId = `test-${chapterId}`;
    beginSession();
  }

  function startReview(words, opts) {
    session = Session.forReview(words, opts);
    if (session.done) return;
    beginSession();
  }

  function beginSession() {
    answered = false;
    xpAtStart = State.get().xp;   // so the results chip can count up the gain
    Audio101.loadSamples();       // first gesture — decode the UI sounds now
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

  // ---- Tap feel --------------------------------------------------------------
  // Wrap a button so that pressing it answers back: a click sample, a haptic tick,
  // and the press collapse (CSS). The invisible <input switch> on top is the only
  // way to reach the Taptic Engine from a web page on current iOS — a *direct tap*
  // on a native switch control. It is progressive enhancement in both directions:
  // on Android navigator.vibrate does the work and the switch is inert; if Apple
  // closes the hole again we lose a tick and nothing else. The real <button> stays
  // underneath so keyboard and assistive tech are unaffected, which is why the
  // click handler lives on the wrapper — the tap lands on the switch, not the
  // button, and only the wrapper sees both.
  function tappable(btn, onTap) {
    const wrap = el('div', 'tap');
    const sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.setAttribute('switch', '');   // Safari 17.4+; ignored elsewhere
    sw.className = 'tap-switch';
    sw.tabIndex = -1;
    sw.setAttribute('aria-hidden', 'true');
    wrap.appendChild(btn);
    wrap.appendChild(sw);
    wrap.addEventListener('pointerdown', () => {
      if (btn.disabled) return;
      Audio101.SFX.tap();
      Audio101.buzz();
    });
    wrap.addEventListener('click', () => { if (!btn.disabled) onTap(); });
    return wrap;
  }

  // Same, for a button that's already in the document: wrap it where it stands.
  function tapWrapInPlace(btn, onTap) {
    const parent = btn.parentElement;
    const next = btn.nextSibling;
    const wrap = tappable(btn, onTap);   // this moves btn into wrap
    parent.insertBefore(wrap, next);
    return wrap;
  }

  function optionList(item, faces, foot) {
    const opts = el('div', 'options');
    for (const opt of item.options) {
      const b = el('button', 'option');
      faces(b, opt);
      b.dataset.val = opt;  // canonical value — grading and reveal read this
      opts.appendChild(tappable(b, () => onChoose(item, opt, b, opts, foot)));
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
      opts.appendChild(tappable(b, () => onChoose(item, opt, b, opts, foot)));
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
      opts.appendChild(tappable(b, () => onChoose(item, opt, b, opts, foot)));
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
    // A disabled input stops taking pointer events, so the overlays stop
    // swallowing taps once the answer is in.
    optsEl.querySelectorAll('.tap-switch').forEach(s => { s.disabled = true; });
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
    // The queue is graded on Continue, not here, so the run this answer *will*
    // reach is one ahead of session.combo. The pairs board never joins a run.
    const streak = (ok && item.kind !== 'pairs') ? session.combo + 1 : 0;
    ok ? Audio101.SFX.correct(streak) : Audio101.SFX.wrong();

    foot.classList.add(ok ? 'ok' : 'bad');
    const banner = el('div', 'feedback');
    if (ok) {
      // The milestone is the one the ear hears too (see SFX.correct), so give it
      // its own line rather than letting it read as just another 🔥.
      if (streak && streak % CONFIG.COMBO_MILESTONE === 0) {
        banner.textContent = `${streak} in a row! 🎉`;
      } else if (streak >= CONFIG.COMBO_CELEBRATE) {
        banner.textContent = `Correct! · ${streak} in a row 🔥`;
      } else {
        banner.textContent = 'Correct!';
      }
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
    foot.appendChild(tappable(cont, () => { session.answer(choice); renderItem(); }));
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
    // Only worth a chip once it's actually a run.
    if (session.bestCombo >= 2) stats.appendChild(statChip('×' + session.bestCombo, 'best streak'));
    const xpChip = statChip(xpAtStart, 'total XP');
    stats.appendChild(xpChip);
    countUp(xpChip.querySelector('.chip-val'), xpAtStart, State.get().xp);
    confetti();
    session = null;
  }

  // Roll the number up rather than printing it: the counting *is* the reward.
  function countUp(el_, from, to) {
    if (to <= from) { el_.textContent = String(to); return; }
    if (reducedMotion()) { el_.textContent = String(to); return; }
    const step = Math.max(1, Math.round((to - from) / 24));
    let cur = from;
    const iv = setInterval(() => {
      cur = Math.min(to, cur + step);
      el_.textContent = String(cur);
      if (cur < to) Audio101.SFX.tick(); else clearInterval(iv);
    }, 45);
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Resolve theme tokens to the colours they currently hold, for the one thing
  // that paints outside CSS (a canvas). Falls back to the ink colour if a token
  // is ever renamed, so a typo dulls the confetti instead of erasing it.
  function paletteColors(names) {
    const cs = getComputedStyle(document.documentElement);
    return names.map((n) => cs.getPropertyValue(n).trim() || '#888888');
  }

  // A short burst of falling paper over the results screen. Canvas rather than a
  // pile of DOM nodes, and it clears itself once the last piece is off-screen.
  function confetti() {
    const cv = $('#results-fx');
    if (!cv || reducedMotion()) return;
    const cx = cv.getContext('2d');
    const w = cv.width = cv.offsetWidth;
    const h = cv.height = cv.offsetHeight;
    // Read the palette out of the cascade rather than keeping a second copy of
    // it here — this was the one place a colour was hardcoded in JS, and it went
    // stale the moment the theme changed.
    const colors = paletteColors(['--brand', '--accent', '--gold', '--text', '--bar-fill-2']);
    const bits = [];
    for (let i = 0; i < 80; i++) {
      bits.push({
        x: Math.random() * w, y: -20 - Math.random() * h * 0.6,
        vx: (Math.random() - 0.5) * 1.6, vy: 1.5 + Math.random() * 2.5,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
        c: colors[(Math.random() * colors.length) | 0]
      });
    }
    (function frame() {
      cx.clearRect(0, 0, w, h);
      let live = 0;
      for (const b of bits) {
        b.vy += 0.03; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
        if (b.y < h + 20) live++;
        cx.save();
        cx.translate(b.x, b.y); cx.rotate(b.rot);
        cx.fillStyle = b.c;
        cx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        cx.restore();
      }
      if (live) requestAnimationFrame(frame);
      else cx.clearRect(0, 0, w, h);
    })();
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
    restoreTracks();     // …and each book's last-used track
    buildLangSelect();
    buildThemeSelect();
    Theme.apply();   // stamp the root + paint the browser chrome to match
    Theme.watch();   // 'System' means following it while the app is open, too
    document.addEventListener('click', closeMenus); // outside-click, bound once
    const brand = document.querySelector('.brand');
    if (brand) brand.textContent = Lang.zh('課程 101');
    $('#review-btn').addEventListener('click', () => openModal(buildReviewHub));

    // Jump menu (scroll the path) + modal (reading / vocab) wiring.
    $('#jump-btn').addEventListener('click', toggleJump);
    document.addEventListener('click', closeJump); // outside-click, bound once
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    const stamp = $('#build-stamp');
    if (stamp) stamp.textContent = CONFIG.BUILD;

    // Coming back from a session, travel to the landing spot rather than cutting
    // to it: after finishing a node the path advances one step, and seeing that
    // step happen is the point.
    $('#session-exit').addEventListener('click', () => { session = null; showScreen('home'); renderHome('smooth'); });
    // The results CTA is static markup, so it gets the tap layer in place.
    tapWrapInPlace($('#results-done'), () => { showScreen('home'); renderHome('smooth'); });
    // Chapter rail: pointer-driven, so it owns its gestures outright.
    const rail = $('#path-rail');
    if (rail) {
      rail.addEventListener('pointerdown', onRailDown);
      rail.addEventListener('pointermove', onRailMove);
      rail.addEventListener('pointerup', onRailUp);
      rail.addEventListener('pointercancel', onRailCancel);
      // Belt and braces: a gesture the browser takes over doesn't always deliver
      // pointercancel, and a drag left half-open sticks the label on screen.
      // Losing the capture covers every way a gesture can end.
      rail.addEventListener('lostpointercapture', onRailCancel);
      rail.addEventListener('touchcancel', onRailCancel);   // not touchend: pointerup owns the tap
      // `touch-action: none` alone didn't stop a phone from also scrolling the
      // page during a slide — the two then fought over the scroll position. A
      // non-passive touchmove that cancels the default is what actually holds.
      rail.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
      }, { passive: false });
    }
    // Follow the scroll with the thumb, at most once a frame.
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; updateRail(); });
    }, { passive: true });

    // Re-measure the connecting trail when the layout can shift.
    //
    // Width only. On a phone the address bar collapses and expands as you
    // scroll, and each toggle fires resize with a new innerHeight — so a plain
    // resize listener re-renders the path repeatedly *during scrolling*, which
    // is both wasteful and, mid-scrub, actively destructive. Nothing about the
    // path's layout depends on viewport height anyway.
    let t = null, lastW = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(redrawTrail, 120);
    });
    window.addEventListener('load', () => {
      redrawTrail();
      // The decor images are lazy, so they arrive after the first aim and push
      // every node further down the page. Re-aim — but only if the page is still
      // sitting exactly where we put it, i.e. the reader hasn't taken over.
      if (focusedAt != null && Math.abs(window.scrollY - focusedAt) < 4) focusPath('auto');
    });
    renderHome();
    showScreen('home');
  }

  // ---- New-version prompt ----------------------------------------------------
  // Shown when a newer service worker is installed and waiting. Deliberately a
  // prompt and not an automatic swap: reloading out from under someone in the
  // middle of a lesson would lose the queue they're part-way through.
  let updateOffered = false;
  function offerUpdate(accept) {
    if (updateOffered) return;
    updateOffered = true;
    const bar = el('div', 'update-toast');
    bar.appendChild(el('span', 'update-msg', 'New version available'));
    const go = el('button', 'update-btn', 'Reload');
    go.addEventListener('click', () => {
      go.disabled = true;
      go.textContent = 'Updating…';
      accept();          // → SKIP_WAITING → controllerchange → reload
    });
    bar.appendChild(go);
    const later = el('button', 'update-dismiss', '✕');
    later.setAttribute('aria-label', 'Dismiss');
    later.addEventListener('click', () => bar.remove());
    bar.appendChild(later);
    document.body.appendChild(bar);
  }

  return { init, showScreen, renderHome, offerUpdate };
})();
