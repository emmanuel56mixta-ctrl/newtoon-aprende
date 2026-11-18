/* Recreo Newtoon · audio
   Música de piano generativa (canción de cuna original), ambiente por tipo de isla y efectos.
   Todo se sintetiza con Web Audio: no hay archivos de audio ni peticiones externas. */
/* ================= AUDIO: música de piano generativa + ambiente por mundo + efectos =================
   Todo se sintetiza con Web Audio (sin archivos). Buses: música → filtro cálido → master; ambiente y efectos → master;
   los tres envían a una reverberación de sala generada por código. */
let soundOn = true, musicOn = true, actx = null, onStateChange = () => {};
const A = { started: false, zoneW: [1, 0, 0], scenes: ['laguna', 'bosque', 'patio'], vel: 0 };
function ac(){
  if (!actx){
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const c = actx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .3;
    A.master = c.createGain(); A.master.gain.value = .9; A.master.connect(comp).connect(c.destination);
    // reverberación: ruido estéreo con caída exponencial
    const len = c.sampleRate * 3.4, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for (let i = 0; i < len; i++){ const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (i < 400 ? i / 400 : 1); } }
    A.rev = c.createConvolver(); A.rev.buffer = ir;
    const revLP = c.createBiquadFilter(); revLP.type = 'lowpass'; revLP.frequency.value = 4200;
    const revOut = c.createGain(); revOut.gain.value = .6; A.rev.connect(revLP).connect(revOut).connect(A.master);
    const bus = (vol, send) => { const g = c.createGain(); g.gain.value = vol; g.connect(A.master); const s = c.createGain(); s.gain.value = send; g.connect(s).connect(A.rev); return g; };
    A.amb = bus(0, .25);
    A.sfx = bus(.85, .32);
    // música: ganancia (fade) → ducking (baja cuando un personaje habla) → filtro cálido → master + reverb
    A.music = c.createGain(); A.music.gain.value = 0; A.duck = c.createGain(); A.duck.gain.value = 1;
    const mlp = c.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 3400; mlp.Q.value = .4;
    A.music.connect(A.duck).connect(mlp); mlp.connect(A.master); const ms = c.createGain(); ms.gain.value = .55; mlp.connect(ms).connect(A.rev);
    // ruido compartido
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    A.noise = nb;
    // timbre de piano: armónicos con caída (forma de onda periódica) + segundo oscilador ligeramente desafinado
    const H = [0, 1, .42, .2, .13, .06, .04, .02, .012];
    A.pianoWave = c.createPeriodicWave(new Float32Array(H.length), Float32Array.from(H));
    const B = [0, 1, 0, .08, 0, .03];          // caja de música / celesta: más pura
    A.bellWave = c.createPeriodicWave(new Float32Array(B.length), Float32Array.from(B));
    document.addEventListener('visibilitychange', () => { if (!actx) return; document.hidden ? actx.suspend() : actx.resume(); });
  }
  if (actx.state === 'suspended' && !document.hidden) actx.resume();
  return actx;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function noiseSrc(t, dur){ const s = actx.createBufferSource(); s.buffer = A.noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + .05); return s; }

/* voz de piano suave (fieltro): ataque rápido, caída en dos etapas, brillo que se apaga */
function piano(midi, t, vel = .4, dest = A.music, { len, wave = A.pianoWave, bright = 1 } = {}){
  const c = actx, f = mtof(midi);
  const L = len ?? Math.max(1.2, 3.6 - (midi - 48) * .045);
  const out = c.createGain();
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vel, t + .006);
  out.gain.exponentialRampToValueAtTime(vel * .38, t + .28); out.gain.exponentialRampToValueAtTime(.0001, t + L);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .5;
  lp.frequency.setValueAtTime(Math.min(f * 7 * bright, 7000), t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 300), t + L);
  for (const det of [0, 4]){ const o = c.createOscillator(); o.setPeriodicWave(wave); o.frequency.value = f; o.detune.value = det + (Math.random() - .5) * 2;
    const g = c.createGain(); g.gain.value = det ? .45 : 1; o.connect(g).connect(lp); o.start(t); o.stop(t + L + .1); }
  // golpe del martillo (muy sutil)
  const n = noiseSrc(t, .03), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 4, 5000); bp.Q.value = 1.2;
  const ng = c.createGain(); ng.gain.setValueAtTime(vel * .06, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .03);
  n.connect(bp).connect(ng).connect(out);
  lp.connect(out).connect(dest);
}
/* pad cálido bajo cada acorde */
function pad(notes, t, dur, vol = .022){
  const c = actx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = .3;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .35); g.gain.setValueAtTime(vol, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur + .8);
  notes.forEach(m => [-6, 6].forEach(d => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 1); }));
  lp.connect(g).connect(A.music);
}

/* ---- composición: canción de cuna en Do mayor, 68 bpm, 16 compases que se repiten con variaciones ---- */
const BPM = 68, BEAT = 60 / BPM;
const CH = { C: [48, 55, 64, 67], Am: [45, 52, 60, 64], F: [41, 48, 57, 60], G: [43, 50, 59, 62], Em: [40, 47, 55, 59], Dm: [38, 45, 53, 57], Fm: [41, 48, 56, 60] };
const PROG = ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Am', 'F', 'C', 'G', 'Dm', 'G', 'C', 'C'];
// [beat, nota, duración en tiempos]
const MEL = [
  [[0, 76, 1.5], [1.5, 74, .5], [2, 72, 1], [3, 67, 1]],
  [[0, 69, 1], [1, 72, 1], [2, 76, 2]],
  [[0, 74, 1], [1, 72, .5], [1.5, 69, .5], [2, 72, 2]],
  [[0, 74, 1.5], [1.5, 76, .5], [2, 74, 2]],
  [[0, 76, 1.5], [1.5, 79, .5], [2, 76, 1], [3, 74, 1]],
  [[0, 79, 1], [1, 76, 1], [2, 71, 2]],
  [[0, 69, 1], [1, 72, 1], [2, 77, 1], [3, 76, 1]],
  [[0, 74, 3]],
  [[0, 72, 1], [1, 76, 1], [2, 81, 2]],
  [[0, 79, 1], [1, 77, .5], [1.5, 76, .5], [2, 72, 2]],
  [[0, 76, 1], [1, 79, 1], [2, 84, 1.5], [3.5, 83, .5]],
  [[0, 81, 1], [1, 79, 1], [2, 74, 2]],
  [[0, 77, 1.5], [1.5, 76, .5], [2, 74, 1], [3, 69, 1]],
  [[0, 71, 1], [1, 74, 1], [2, 79, 2]],
  [[0, 76, 1], [1, 74, .5], [1.5, 72, .5], [2, 76, 1], [3, 74, 1]],
  [[0, 72, 4]],
];
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
let barN = 0, nextBar = 0, schedTimer = null;
const hum = () => (Math.random() - .5) * .018;
function scheduleBar(i, t){
  const k = i % 16, loop = Math.floor(i / 16) % 3, chord = CH[PROG[k]];
  const [r, fifth, third, fifth2] = chord;
  // mano izquierda: arpegio ondulante en corcheas
  const arp = [r, fifth, third, fifth2, r + 12, fifth2, third, fifth];
  arp.forEach((m, j) => piano(m, t + j * BEAT / 2 + hum(), (j === 0 ? .15 : .1) * (loop === 2 ? .85 : 1)));
  pad([third, fifth2, r + 24], t, BEAT * 4);
  // mano derecha
  if (loop === 0) MEL[k].forEach(([b, m, d]) => piano(m, t + b * BEAT + hum(), .26 + Math.random() * .05, A.music, { len: Math.max(1.4, d * BEAT * 1.6) }));
  if (loop === 1) MEL[k].forEach(([b, m]) => { if (Math.random() < .72) piano(m + 12, t + b * BEAT + hum(), .12, A.music, { wave: A.bellWave, len: 2.4, bright: 1.4 }); });
  if (loop === 2 && Math.random() < .55){ const m = PENTA[Math.floor(Math.random() * PENTA.length)]; piano(m, t + (2 + Math.floor(Math.random() * 4) * .5) * BEAT, .1, A.music, { wave: A.bellWave, len: 2.6 }); }
  // destellos al final de frase
  if (k % 4 === 3 && Math.random() < .6){ const m = PENTA[5 + Math.floor(Math.random() * 4)]; piano(m, t + 3.5 * BEAT, .07, A.music, { wave: A.bellWave, len: 2.2 }); }
}
function musicTick(){
  if (!actx || !musicOn) return;
  const now = actx.currentTime;
  if (nextBar < now) nextBar = now + .15;
  while (nextBar < now + 1.6){ scheduleBar(barN++, nextBar); nextBar += BEAT * 4; }
  ambienceTick(now);
}
function setMusic(on){
  musicOn = on; onStateChange(); if (!actx) return; const t = actx.currentTime;
  A.music.gain.cancelScheduledValues(t); A.music.gain.setValueAtTime(A.music.gain.value, t);
  A.music.gain.linearRampToValueAtTime(on ? .3 : 0, t + (on ? 3 : .6));
  A.amb.gain.cancelScheduledValues(t); A.amb.gain.setValueAtTime(A.amb.gain.value, t);
  A.amb.gain.linearRampToValueAtTime(on ? 1 : 0, t + (on ? 3 : .6));
}
function duckMusic(sec = 1.8){ if (!actx) return; const t = actx.currentTime, g = A.duck.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(.35, t + .15); g.setValueAtTime(.35, t + sec); g.linearRampToValueAtTime(1, t + sec + 1); }

/* ---- ambiente por mundo: capas continuas + eventos aleatorios, mezcladas según hacia dónde mira la cámara ---- */
function ambienceSetup(){
  const c = actx; A.zg = [];
  const bed = (zone, type, freq, q, vol, lfoHz) => {
    const s = c.createBufferSource(); s.buffer = A.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = lfoHz; lg.gain.value = vol * .7; lfo.connect(lg).connect(g.gain); lfo.start();
    s.connect(f).connect(g).connect(A.zg[zone]); s.start();
  };
  A.scenes.forEach((scene, i) => {
    const g = c.createGain(); g.gain.value = 0; g.connect(A.amb); A.zg.push(g);
    if (scene === 'bosque'){ bed(i, 'bandpass', 650, .5, .018, .07); }
    if (scene === 'laguna'){ bed(i, 'lowpass', 420, .7, .07, .16); bed(i, 'bandpass', 1400, .8, .012, .23); }
    if (scene === 'patio'){ bed(i, 'lowpass', 300, .5, .028, .06); bed(i, 'bandpass', 900, .5, .01, .11); }
    if (!['bosque', 'laguna', 'patio'].includes(scene)){ bed(i, 'lowpass', 280, .5, .022, .05); }   // 'calma': fondo cálido y discreto
  });
  A.nextEv = A.scenes.map(() => 0);
}
function chirp(t, v, z){ const c = actx; const n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1400;
  for (let i = 0; i < n; i++){ const o = c.createOscillator(), g = c.createGain(), tt = t + i * (.09 + Math.random() * .05);
    o.type = 'sine'; o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * .3), tt + .05); o.frequency.exponentialRampToValueAtTime(base * .9, tt + .09);
    g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.05 * v, tt + .01); g.gain.exponentialRampToValueAtTime(.0001, tt + .11);
    o.connect(g).connect(A.zg[z]); o.start(tt); o.stop(tt + .14); } }
function bubbleSfx(t, v, z){ const c = actx, o = c.createOscillator(), g = c.createGain(), f = 300 + Math.random() * 500;
  o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.6, t + .07);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09 * v, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + .09);
  o.connect(g).connect(A.zg[z]); o.start(t); o.stop(t + .12); }
function windChime(t, v, z){ const m = PENTA[4 + Math.floor(Math.random() * 6)] + 12; piano(m, t, .03 * v, A.zg[z], { wave: A.bellWave, len: 2.4 }); }
function ambienceTick(now){
  if (!A.zg) ambienceSetup();
  const w = A.zoneW;
  A.zg.forEach((g, i) => g.gain.setTargetAtTime(w[i] || 0, now, .25));
  const EV = { bosque: [1.8, 5, (t, v, z) => chirp(t, v, z)], laguna: [.5, 2.2, (t, v, z) => bubbleSfx(t, v, z)], patio: [3, 8, windChime], calma: [6, 14, windChime] };
  A.scenes.forEach((scene, z) => { const e = EV[scene]; if (!e) return; const [lo, hi, fn] = e;
    if ((w[z] || 0) < .04){ A.nextEv[z] = Math.max(A.nextEv[z], now); return; }
    while (A.nextEv[z] < now + 1.6){ if (A.nextEv[z] >= now) fn(A.nextEv[z], w[z], z); A.nextEv[z] = Math.max(A.nextEv[z], now) + lo + Math.random() * (hi - lo); } });
}

/* ---- efectos ---- */
function tone(f, dur = .3, type = 'triangle', vol = .16, delay = 0){
  if (!soundOn) return; const a = ac(), t0 = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
  o.connect(lp).connect(g).connect(A.sfx); o.start(t0); o.stop(t0 + dur + .05);
}
const pop = () => { if (!soundOn) return; const a = ac(), t = a.currentTime; piano(84, t, .16, A.sfx, { wave: A.bellWave, len: .9 }); piano(91, t + .06, .1, A.sfx, { wave: A.bellWave, len: 1 }); };
function keyNote(midi, vel = .32){ if (!soundOn) return; const a = ac(); piano(midi, a.currentTime, vel, A.sfx, { len: 2.4 }); }
function swish(dur = .45, vol = .07, f0 = 500, f1 = 2600){
  if (!soundOn) return; const a = ac(), t = a.currentTime, n = noiseSrc(t, dur), bp = a.createBiquadFilter(), g = a.createGain();
  bp.type = 'bandpass'; bp.Q.value = .9; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .35); g.gain.linearRampToValueAtTime(0, t + dur);
  n.connect(bp).connect(g).connect(A.sfx);
}
function paperFlip(){ swish(.18, .09, 1800, 4200); setTimeout(() => swish(.12, .05, 2600, 1400), 90); }
function hoverTick(){ if (!soundOn || !actx) return; const t = actx.currentTime; piano(96, t, .035, A.sfx, { wave: A.bellWave, len: .35 }); }
const ZONE_CHIME = [[74, 79, 83, 86], [72, 76, 79, 84], [77, 81, 84, 89]];
function zoneChime(i){ if (!soundOn || !actx) return; const t = actx.currentTime + .05;
  swish(.6, .05, 400, 1800);
  ZONE_CHIME[i % ZONE_CHIME.length].forEach((m, j) => piano(m, t + .12 + j * .11, .13 - j * .015, A.sfx, { wave: A.bellWave, len: 2.6 })); }
function zoomSwell(on){ if (!soundOn || !actx) return; on ? swish(1.1, .025, 300, 1100) : swish(.8, .018, 1000, 350);
  if (on){ const m = PENTA[3 + Math.floor(Math.random() * 5)]; piano(m + 12, actx.currentTime + .25, .045, A.sfx, { wave: A.bellWave, len: 2 }); } }
function enterWorld(withSound){
  soundOn = withSound; musicOn = withSound; onStateChange();
  if (!withSound) return;
  const a = ac(), t = a.currentTime + .05;
  swish(1.4, .09, 250, 3200);
  [60, 64, 67, 72, 76, 79, 84, 88, 91, 96].forEach((m, j) => piano(m, t + j * .07, .16 - j * .009, A.sfx, { wave: j > 5 ? A.bellWave : A.pianoWave, len: 3 }));
  nextBar = a.currentTime + 1.4; setMusic(true);
  if (!schedTimer) schedTimer = setInterval(musicTick, 180);
  A.started = true;
}
/* giro de la sala: un soplo de aire proporcional a la velocidad */
function rotationAir(degPerSec){
  if (!actx || !A.started) return;
  if (!A.air){ const c = actx, s = c.createBufferSource(); s.buffer = A.noise; s.loop = true; A.airF = c.createBiquadFilter(); A.airF.type = 'bandpass'; A.airF.Q.value = .7; A.airF.frequency.value = 500;
    A.air = c.createGain(); A.air.gain.value = 0; s.connect(A.airF).connect(A.air).connect(A.sfx); s.start(); }
  const v = Math.min(1, Math.abs(degPerSec) / 140), t = actx.currentTime;
  A.air.gain.setTargetAtTime(soundOn ? v * .06 : 0, t, .12); A.airF.frequency.setTargetAtTime(400 + v * 1300, t, .15);
}
function speak(text){
  if (!soundOn || !('speechSynthesis' in window)) return false;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-419'; u.rate = .85; u.pitch = 1.05;   // voz neutral de narración: no es la voz canónica de ningún personaje
    const vs = speechSynthesis.getVoices(); const v = vs.find(v => /^es[-_](419|MX|US|CO|AR)/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u); duckMusic(1.2 + text.length * .06); return true; } catch { return false; }
}


export const audio = {
  ac, enterWorld, setMusic, duckMusic, tone, pop, keyNote, swish, paperFlip, hoverTick, zoneChime, zoomSwell, rotationAir, speak,
  get music(){ return musicOn; }, get sound(){ return soundOn; }, get started(){ return A.started; },
  setSound(on){ soundOn = on; if (!on && 'speechSynthesis' in window) speechSynthesis.cancel(); onStateChange(); if (on){ ac(); A.started = true; } },
  startMusicLoop(){ ac(); A.started = true; if (!schedTimer) schedTimer = setInterval(musicTick, 180); },
  setScenes(scenes){ A.scenes = scenes.slice(); A.zoneW = scenes.map(() => 0); },
  setZoneWeights(w){ A.zoneW = w; },
  onChange(fn){ onStateChange = fn; },
};
