// audio.js — Chinese text-to-speech via SpeechSynthesis, plus tiny procedural
// SFX for correct/wrong feedback. Lazy AudioContext (browsers block autoplay
// until a user gesture).
'use strict';

const Audio101 = (function () {
  let ctx = null;
  let zhVoice = null;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  // Voices load asynchronously; grab the best Chinese one we can find.
  function pickVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    zhVoice =
      voices.find(v => v.lang === CONFIG.TTS_LANG) ||
      voices.find(v => /^zh/i.test(v.lang)) ||
      null;
  }

  function initVoices() {
    if (!window.speechSynthesis) return;
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    // Speak in the active script/lang (Mandarin pronunciation is identical, but
    // this suits Simplified-only voices). Falls back to config if Lang isn't up.
    const say = window.Lang ? Lang.zh(text) : text;
    const u = new SpeechSynthesisUtterance(say);
    u.lang = window.Lang ? Lang.tts() : CONFIG.TTS_LANG;
    u.rate = CONFIG.TTS_RATE;
    if (zhVoice) u.voice = zhVoice;
    speechSynthesis.speak(u);
  }

  function hasVoice() { return !!zhVoice || (window.speechSynthesis && speechSynthesis.getVoices().some(v => /^zh/i.test(v.lang))); }

  // ---- Sampled UI sounds ---------------------------------------------------
  // Kenney "Interface Sounds" (CC0). Fetched and decoded once on the first user
  // gesture, then played from an AudioBuffer so the correct-answer hit can be
  // re-pitched for the combo run. Anything that fails here falls back to the
  // procedural tones below — notably file://, where fetch is blocked, and the app
  // is meant to keep working.
  const FILES = {
    tap: 'assets/sfx/tap.wav',
    correct: 'assets/sfx/correct.wav',
    wrong: 'assets/sfx/wrong.wav',
    finish: 'assets/sfx/finish.wav',
    tick: 'assets/sfx/tick.wav'
  };
  const buffers = {};
  let loading = null;

  function loadSamples() {
    if (loading) return loading;
    const c = ac();
    loading = Promise.all(Object.keys(FILES).map(name =>
      fetch(FILES[name])
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then(b => c.decodeAudioData(b))
        .then(buf => { buffers[name] = buf; })
        .catch(() => { /* stays undefined → procedural fallback for this one */ })
    ));
    return loading;
  }

  // Play a sample if we have it. Returns false when we don't, so each SFX can
  // fall back to its synthesised version rather than going silent. `rate`
  // re-pitches it, `delay` schedules it that many seconds out.
  function sample(name, rate, delay) {
    const buf = buffers[name];
    if (!buf) { loadSamples(); return false; }
    const c = ac();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate || 1;
    const g = c.createGain();
    g.gain.value = CONFIG.SFX_VOLUME;
    src.connect(g); g.connect(c.destination);
    src.start(c.currentTime + (delay || 0));
    return true;
  }

  // Does this answer land on a combo milestone? Only then does a run make a
  // sound of its own; every other correct answer is the plain hit.
  function isMilestone(streak) {
    return !!streak && streak % CONFIG.COMBO_MILESTONE === 0;
  }

  function tone(freq, start, dur, type) {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const SFX = {
    // `streak` is the combo this answer just reached (1 = first of a run).
    // Same hit every time; on a milestone the same hit answers itself a fifth
    // higher, so the reward is a distinct little two-note lift you hear rarely.
    correct(streak) {
      const lift = isMilestone(streak);
      if (sample('correct')) {
        if (lift) sample('correct', CONFIG.COMBO_LIFT, CONFIG.COMBO_LIFT_GAP);
        return;
      }
      tone(660, 0, 0.12); tone(990, 0.1, 0.16);
      if (lift) {
        const g = CONFIG.COMBO_LIFT_GAP + 0.1;
        tone(660 * CONFIG.COMBO_LIFT, g, 0.12);
        tone(990 * CONFIG.COMBO_LIFT, g + 0.1, 0.16);
      }
    },
    wrong() {
      if (sample('wrong')) return;
      tone(200, 0, 0.22, 'sawtooth');
    },
    finish() {
      if (sample('finish')) return;
      tone(523, 0, 0.12); tone(659, 0.12, 0.12); tone(784, 0.24, 0.2);
    },
    // Tap has no fallback tone on purpose: a synthesised blip on every touch is
    // worse than silence, and this one is pure garnish.
    tap()  { sample('tap'); },
    tick() { sample('tick', 1.6); }
  };

  // A tick under the thumb. Android honours it; iOS has no Vibration API at all,
  // where the tick instead comes from the native switch overlaid on the button
  // (see UI.tappable) — so this silently does nothing there, by design.
  function buzz() {
    if (navigator.vibrate) navigator.vibrate(CONFIG.HAPTIC_TAP_MS);
  }

  return { initVoices, speak, hasVoice, SFX, buzz, loadSamples };
})();
