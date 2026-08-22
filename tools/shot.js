// tools/shot.js — screenshot the app in a phone-sized headless Chrome, over the
// DevTools protocol, with real touch gestures. A dev aid; nothing ships with it.
//
//   npm start                                    # the page must be served
//   node tools/shot.js http://localhost:5173/ out.png
//   node tools/shot.js http://localhost:5173/ out.png drag:0.05:0.62
//
// Why CDP and not `chrome --headless --screenshot`: that flag mis-sizes the
// layout viewport on this machine (--window-size=430 gives innerWidth 526), so
// the bitmap always crops the right edge — exactly where the chapter rail
// lives. CDP sets an exact viewport, and Input.dispatchTouchEvent drives real
// pointer events, so a drag is tested rather than simulated in page script.
//
// To start on a particular book (or any seeded state), copy index.html to a
// driver page with a <script> setting localStorage right after <body> — it MUST
// come before the app's script tags, or main.js boots and State.load() reads the
// empty store first — and point this at the copy.
//
// It prints what the rail measured, and after a gesture, where it landed.
//
// usage: node tools/shot.js <url> <out.png> [gesture]
//   gesture: "drag:<fromFrac>:<toFrac>"    drag down the rail, shoot mid-drag
//            "tap:<frac>"                  tap the rail at that fraction
//            "cancel:<frac>"               browser takes the gesture away mid-slide
//            "shrink:<fromFrac>:<toFrac>"  drag while the viewport grows under it
//            "multi:<fromFrac>:<toFrac>"   drag, with a stray second touch in the strip
const fs = require('fs');
const http = require('http');

const [url, out, gesture] = process.argv.slice(2);
const PORT = 9333;
const W = 390, H = 844;

const get = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { spawn } = require('child_process');
  const chrome = spawn('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    // Fresh profile every run: a stale service worker from a previous run will
    // happily serve the old app shell and hide the change you're checking.
    '--user-data-dir=' + fs.mkdtempSync(require('os').tmpdir() + '\\c101-cdp-'), 'about:blank'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = (await get('/json/list')).find((t) => t.type === 'page'); } catch (e) { await sleep(250); }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params) => new Promise((res) => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  });
  await new Promise((r) => ws.addEventListener('open', r));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  await sleep(2500);

  // Report what the rail actually measured, whatever the gesture.
  const probe = await send('Runtime.evaluate', {
    expression: `(() => {
      const r = document.getElementById('path-rail');
      const b = r.getBoundingClientRect();
      return JSON.stringify({
        iw: innerWidth, docH: document.documentElement.scrollHeight,
        hidden: r.hidden, rail: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
        ticks: r.querySelectorAll('.rail-tick').length,
        dots: r.querySelectorAll('.rail-tick.dot').length,
        here: r.querySelectorAll('.rail-here').length,
        tops: [...r.querySelectorAll('.rail-tick')].map(t => t.style.top.slice(0, 5)),
        thumb: (r.querySelector('.rail-thumb') || {}).style ? r.querySelector('.rail-thumb').style.height.slice(0,5) : null,
        bodyClass: document.body.className,
        mainPadRight: getComputedStyle(document.querySelector('.home-main')).paddingRight,
        errors: window.__errs || 0
      });
    })()`, returnByValue: true
  });
  console.log(probe.result.value);

  if (gesture) {
    const rect = JSON.parse(probe.result.value).rail;
    const x = rect[0] + rect[2] / 2;
    const yAt = (f) => rect[1] + rect[3] * f;
    const touch = (type, y) => send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
    });
    const [kind, a, b] = gesture.split(':');
    if (kind === 'drag') {
      await touch('touchStart', yAt(+a));
      for (let s = 1; s <= 6; s++) {
        await touch('touchMove', yAt(+a + (+b - +a) * s / 6));
        await sleep(60);
      }
      // shoot mid-drag: label + thumb should be live, finger still down
    } else if (kind === 'tap') {
      await touch('touchStart', yAt(+a));
      await sleep(60);
      await touch('touchEnd', yAt(+a));
      await sleep(700); // let the smooth scroll land
    } else if (kind === 'shrink') {
      // The URL bar collapsing mid-scrub, which is what scrubbing *causes* on a
      // phone. The finger does not move during the change; only the viewport does.
      // The rail is pinned top-and-bottom, so an unpinned strip grows with it and
      // the gesture ends up measured against a different rail than it started on.
      // What must hold: the strip's height is the same before and after.
      const railH = () => send('Runtime.evaluate', { expression:
        `Math.round(document.getElementById('path-rail').getBoundingClientRect().height)`,
        returnByValue: true }).then(r => r.result.value);
      await touch('touchStart', yAt(+a));
      await touch('touchMove', yAt(+a + (+b - +a) / 3));
      await sleep(60);
      const hBefore = await railH();
      await send('Emulation.setDeviceMetricsOverride',
        { width: W, height: H + 90, deviceScaleFactor: 2, mobile: true });
      await sleep(120);
      const hAfter = await railH();
      await touch('touchMove', yAt(+b));
      await sleep(60);
      console.log('rail height during drag:', hBefore, '->', hAfter,
                  hBefore === hAfter ? 'OK (pinned)' : 'DRIFTED');
    } else if (kind === 'multi') {
      // A second finger resting in the strip — steadying the phone against the
      // edge. It must be ignored outright: before the pointerId guard it replaced
      // the live drag, and its release was then read as a tap that snapped the
      // page to wherever that finger sat. (CDP multi-touch end semantics are
      // fiddly, so the stray pointer is synthesized in the page, as with cancel.)
      const scroll = () => send('Runtime.evaluate',
        { expression: 'Math.round(scrollY)', returnByValue: true }).then(r => r.result.value);
      await touch('touchStart', yAt(+a));
      for (let s = 1; s <= 3; s++) { await touch('touchMove', yAt(+a + (+b - +a) * s / 3)); await sleep(60); }
      const before = await scroll();
      await send('Runtime.evaluate', { expression:
        `(() => { const r = document.getElementById('path-rail');
           const b = r.getBoundingClientRect();
           const at = (t, y) => r.dispatchEvent(new PointerEvent(t,
             { pointerId: 99, clientY: y, bubbles: true, cancelable: true }));
           at('pointerdown', b.top + b.height * 0.04);
           at('pointerup', b.top + b.height * 0.04); })()` });
      await sleep(200);
      const after = await scroll();
      console.log('scrollY across a stray second touch:', before, '->', after,
                  before === after ? 'OK (ignored)' : 'HIJACKED');
    } else if (kind === 'cancel') {
      // The browser deciding mid-gesture that the touch was a page scroll: a
      // couple of pixels of movement, then it takes the gesture away. The rail
      // must let go without acting — acting here is a tap-jump that then fights
      // the native scroll, which is the bug this reproduces.
      // (CDP's touchCancel dispatches no DOM event at all, so the pointercancel
      // a real browser sends is synthesized in the page instead. It has to carry
      // the *live* gesture's pointerId — the rail ignores end events belonging to
      // any pointer but the one that owns it, and a hardcoded id here would be
      // testing that guard rather than the cancel path.)
      await send('Runtime.evaluate', { expression:
        `document.getElementById('path-rail').addEventListener(
           'pointerdown', (e) => { window.__pid = e.pointerId; }, true)` });
      await touch('touchStart', yAt(+a));
      await touch('touchMove', yAt(+a) + 2);
      await sleep(60);
      await send('Runtime.evaluate', { expression:
        `document.getElementById('path-rail').dispatchEvent(
           new PointerEvent('pointercancel', { pointerId: window.__pid, bubbles: true }))` });
      await sleep(700);
    }
    const after = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ scrollY: Math.round(scrollY),
        label: (document.querySelector('.rail-label')||{}).textContent,
        labelShown: !(document.querySelector('.rail-label')||{hidden:true}).hidden,
        onTick: (document.querySelector('.rail-tick.on')||{}).textContent })`, returnByValue: true
    });
    console.log('after gesture:', after.result.value);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('wrote', out);
  ws.close();
  chrome.kill();
  process.exit(0);
})();
