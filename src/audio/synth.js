export function createAudio() {
  let ctx = null;
  const state = { music: 0.72, sfx: 0.8, muted: false };
  let bed = null;
  let timer = 0;
  let step = 0;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function envGain(duration, peak) {
    const audio = ac();
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    g.connect(audio.destination);
    return { audio, g };
  }

  function beep(freq, duration, type, vol) {
    if (state.muted || state.sfx <= 0) return;
    const { audio, g } = envGain(duration, vol * state.sfx);
    const o = audio.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    o.start();
    o.stop(audio.currentTime + duration);
  }

  function pluck(freq, duration, vol) {
    if (!bed || state.muted || state.music <= 0) return;
    const audio = ac();
    const now = audio.currentTime;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + duration);
    filter.Q.value = 0.7;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * state.music), now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const o = audio.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(filter);
    filter.connect(g);
    g.connect(bed.master);
    o.start(now);
    o.stop(now + duration + 0.05);
  }

  function startMusic() {
    const audio = ac();
    if (bed) return;
    const master = audio.createGain();
    master.gain.value = state.muted ? 0 : 1;
    master.connect(audio.destination);

    const pad = audio.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = 98;
    const padFilter = audio.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 280;
    const padGain = audio.createGain();
    padGain.gain.value = state.muted ? 0 : state.music * 0.035;
    pad.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(master);
    pad.start();

    bed = { master, pad, padGain, chapter: 1 };
    step = 0;
    timer = 0;
  }

  const motif = [196, 262, 220, 294, 196, 330, 262, 175];

  return {
    start: () => { ac(); startMusic(); },
    setMusic(v) {
      state.music = v;
      if (bed) bed.padGain.gain.value = state.muted ? 0 : v * 0.035;
    },
    setSfx(v) { state.sfx = v; },
    muteAll(on) {
      state.muted = on;
      if (bed) {
        bed.master.gain.value = on ? 0 : 1;
        bed.padGain.gain.value = on ? 0 : state.music * 0.035;
      }
    },
    tick(dt) {
      if (!bed || state.muted || state.music <= 0) return;
      timer += dt;
      const gap = bed.chapter >= 3 ? 1.05 : 1.35;
      if (timer < gap) return;
      timer = 0;
      const freq = motif[step % motif.length];
      step += 1;
      pluck(freq, 1.6, 0.055);
      if (step % 4 === 0) pluck(freq / 2, 2.1, 0.03);
    },
    step: () => beep(392, 0.06, 'sine', 0.08),
    page: () => beep(523, 0.1, 'sine', 0.07),
    voidFall: () => beep(82, 0.4, 'sine', 0.16),
    whiteFall: () => beep(988, 0.22, 'triangle', 0.08),
    stamp: () => beep(262, 0.16, 'sine', 0.08),
    reveal: () => { beep(330, 0.5, 'sine', 0.07); setTimeout(() => beep(494, 0.62, 'sine', 0.055), 110); },
    win: () => { beep(392, 0.18, 'sine', 0.1); setTimeout(() => beep(523, 0.28, 'sine', 0.09), 140); },
    finale: () => beep(196, 1.6, 'sine', 0.12),
    layer(chapter) {
      if (!bed) return;
      bed.chapter = chapter || 1;
    }
  };
}
