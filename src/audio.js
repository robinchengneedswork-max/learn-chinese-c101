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
    const u = new SpeechSynthesisUtterance(text);
    u.lang = CONFIG.TTS_LANG;
    u.rate = CONFIG.TTS_RATE;
    if (zhVoice) u.voice = zhVoice;
    speechSynthesis.speak(u);
  }

  function hasVoice() { return !!zhVoice || (window.speechSynthesis && speechSynthesis.getVoices().some(v => /^zh/i.test(v.lang))); }

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
    correct() { tone(660, 0, 0.12); tone(990, 0.1, 0.16); },
    wrong()   { tone(200, 0, 0.22, 'sawtooth'); },
    finish()  { tone(523, 0, 0.12); tone(659, 0.12, 0.12); tone(784, 0.24, 0.2); }
  };

  return { initVoices, speak, hasVoice, SFX };
})();
