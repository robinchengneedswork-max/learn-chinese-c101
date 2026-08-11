// theme.js — which palette the app wears. The palettes themselves live in
// style.css as three token blocks (:root = light, a prefers-color-scheme block,
// and a [data-theme="dark"] block); this module only decides which one wins and
// remembers the choice. Same shape as lang.js, and data-driven for the same
// reason: adding a theme later shouldn't need a change in ui.js.
'use strict';

const Theme = (function () {
  const KEY = 'c101.theme.v1';

  // 'system' deliberately writes NO attribute — an absent data-theme is exactly
  // what lets the media query decide. The other two stamp the root, which beats
  // the media query in both directions (that's why the dark tokens are declared
  // twice in the stylesheet).
  const THEMES = [
    { id: 'system', label: '◐', name: 'System' },
    { id: 'light',  label: '☀', name: 'Light' },
    { id: 'dark',   label: '☾', name: 'Dark' }
  ];

  let current = pick(read());

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function pick(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }

  function systemDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // What the reader is actually looking at, 'light' or 'dark' — 'system' asks the
  // browser. Used for anything that has to match the palette but isn't styled by
  // CSS (see paintChrome).
  function resolved() {
    return current.id === 'system' ? (systemDark() ? 'dark' : 'light') : current.id;
  }

  function apply() {
    const root = document.documentElement;
    if (current.id === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', current.id);
    paintChrome();
  }

  // The browser's address bar and an installed PWA's title bar are not styled by
  // the stylesheet, so they have to be told. Read the resolved --bg back out of
  // the cascade instead of repeating the palette here: the tokens stay the one
  // source of truth, and this can never drift from them.
  function paintChrome() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }

  function set(id) {
    const t = THEMES.find((x) => x.id === id);
    if (!t) return false;
    current = t;
    try { localStorage.setItem(KEY, id); } catch (e) { /* best-effort */ }
    apply();
    return true;
  }

  // Following the system means following it while the app is open too — the CSS
  // re-evaluates itself, but the chrome colour has to be repainted by hand.
  function watch() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (current.id === 'system') paintChrome(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);   // older WebKit
  }

  return { themes: () => THEMES, current: () => current, resolved, set, apply, watch };
})();

window.Theme = Theme;
