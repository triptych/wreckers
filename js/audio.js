/* ---------- sound: one oscillator at a time, like the TIA ---------- */
let AC = null;
export function audio(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
export function tone(freq, dur, type='square', vol=.14, delay=0){
  const a = audio(); if(!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
export function noise(dur=.35, vol=.25){
  const a = audio(); if(!a) return;
  const n = Math.floor(a.sampleRate*dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain(); g.gain.value = vol;
  const f = a.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 900;
  src.connect(f).connect(g).connect(a.destination); src.start();
}
export const sfx = {
  save(){ tone(660,.07); tone(990,.10,'square',.13,.07); },
  flee(){ tone(300,.09,'triangle',.12); tone(200,.12,'triangle',.10,.09); },
  lure(){ tone(96,.09,'sawtooth',.10); },
  crash(){ noise(.45,.3); tone(70,.5,'sawtooth',.16); },
  wave(){ [523,659,784].forEach((f,i)=>tone(f,.10,'square',.12,i*.09)); },
  over(){ [392,330,262,196].forEach((f,i)=>tone(f,.24,'square',.14,i*.16)); },
  sharkAway(){ tone(180,.08,'sawtooth',.13); tone(120,.14,'sawtooth',.11,.07); },
  sharkNear(){ tone(140,.05,'triangle',.10); },
  bite(){ noise(.22,.28); tone(90,.22,'sawtooth',.15); },
  mermaid(){ [784,988,1175,1568].forEach((f,i)=>tone(f,.16,'triangle',.13,i*.07)); },
  supply(){ tone(880,.05,'square',.11); tone(1320,.06,'square',.10,.05); },
  supplyFull(){ [660,880,1100,1320].forEach((f,i)=>tone(f,.09,'square',.13,i*.05)); },
  lightWave(){ noise(.5,.22); [220,440,660,880,1320].forEach((f,i)=>tone(f,.4,'sine',.12,i*.03)); },
  lifeUp(){ [523,659,784,1046].forEach((f,i)=>tone(f,.12,'triangle',.12,i*.06)); }
};
