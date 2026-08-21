(() => {
"use strict";

/* ---------------------------------------------------------------
   WRECKERS!  —  160x192, the 2600's real playfield resolution.
   Pixels are stretched 1.6:1 like NTSC, so all geometry is done in
   "screen units" (x scaled by PA) while drawing stays in pixels.
----------------------------------------------------------------*/
const W = 160, H = 192, PA = 1.6;

const cv  = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

// A small, flat palette in the spirit of the TIA.
const C = {
  sea:'#0b2140', seaDeep:'#071733', wave:'#17406e',
  rock:'#6c6c6c', rockLo:'#3f3f3f', sand:'#8a7a52',
  tower:'#dcdcdc', towerRed:'#c8442c', lamp:'#fcfc54',
  beam:'#fcd84c', hull:'#8a9bab', sail:'#5c7d99', sail2:'#9cdcfc', salt:'#cfd8dd',
  safe:'#54c05a', raider:'#d84c2c', raiderLo:'#8c2414',
  hud:'#fcd84c', dark:'#000000', white:'#ffffff'
};

/* ---------- 3x5 pixel font (drawn, not typeset) ---------- */
const FONT = {
 'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110',
 'E':'111100110100111','F':'111100110100100','G':'011100101101011','H':'101101111101101',
 'I':'111010010010111','J':'001001001101010','K':'101101110101101','L':'100100100100111',
 'M':'101111111101101','N':'101111111111101','O':'010101101101010','P':'110101110100100',
 'Q':'010101101110011','R':'110101110101101','S':'011100010001110','T':'111010010010010',
 'U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101',
 'Y':'101101010010010','Z':'111001010100111',
 '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111',
 '4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001',
 '8':'111101111101111','9':'111101111001111',
 '!':'010010010000010','.':'000000000000010','-':'000000111000000',' ':'000000000000000',
 ':':'000010000010000',"'":'010010000000000'
};
function textW(s,sc){ return (s.length*4-1)*sc; }
function drawText(s, x, y, col, sc=1){
  ctx.fillStyle = col;
  for(let i=0;i<s.length;i++){
    const g = FONT[s[i]] || FONT[' '];
    const ox = x + i*4*sc;
    for(let r=0;r<5;r++) for(let c2=0;c2<3;c2++)
      if(g[r*3+c2]==='1') ctx.fillRect(ox+c2*sc, y+r*sc, sc, sc);
  }
}
function drawTextC(s,y,col,sc=1){ drawText(s, Math.round((W-textW(s,sc))/2), y, col, sc); }

/* ---------- dithered "transparency", the era-correct way ---------- */
function checker(col, density){
  const p = document.createElement('canvas'); p.width = p.height = 2;
  const g = p.getContext('2d'); g.fillStyle = col;
  g.fillRect(0,0,1,1); g.fillRect(1,1,1,1);
  if(density > 0.5){ g.fillRect(1,0,1,1); }
  return ctx.createPattern(p,'repeat');
}
const BEAM_FAR  = checker(C.beam, 0.5);
const BEAM_NEAR = checker(C.beam, 0.75);

/* ---------- the shoal ---------- */
const CX = 80, CY = 104;             // island centre, in pixels
const LX = 80, LY = CY - 13;         // the lamp itself
const BEAM_LEN = 118;                // screen units
const BEAM_HALF = 0.20;              // radians
const TURN_RATE = 2.05;              // radians / sec
const CRASH_R = 15;                  // screen units

// 25 x 15 island, hand-set like a playfield graphic
const ISLAND = [
 '.........rrrrrr..........',
 '......rrrrrrrrrrr........',
 '....rrrrrrrrrrrrrrr......',
 '...rrrrrrrrrrrrrrrrr.....',
 '..rrrrrrrrrrrrrrrrrrr....',
 '..rrrrrrrrrrrrrrrrrrrr...',
 '.rrrrrrrrrrrrrrrrrrrrr...',
 '.rrrrrrrrrrrrrrrrrrrrrr..',
 '..dddrrrrrrrrrrrrrrrrr...',
 '..ddddddrrrrrrrrrrrrd....',
 '...dddddddddrrrrrdddd....',
 '....ssdddddddddddddd.....',
 '.....ssssddddddddss......',
 '.......sssssssss.........',
 '..........sss............'
];

/* ---------- geometry in stretched space ---------- */
const sdist = (x1,y1,x2,y2) => Math.hypot((x2-x1)*PA, y2-y1);
const sang  = (x1,y1,x2,y2) => Math.atan2(y2-y1, (x2-x1)*PA);
function angDiff(a,b){ let d=(a-b)%(Math.PI*2); if(d> Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return d; }
function turnToward(cur, tgt, step){
  const d = angDiff(tgt, cur);
  return cur + Math.max(-step, Math.min(step, d));
}

/* ---------- sound: one oscillator at a time, like the TIA ---------- */
let AC = null;
function audio(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function tone(freq, dur, type='square', vol=.14, delay=0){
  const a = audio(); if(!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
function noise(dur=.35, vol=.25){
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
const sfx = {
  save(){ tone(660,.07); tone(990,.10,'square',.13,.07); },
  flee(){ tone(300,.09,'triangle',.12); tone(200,.12,'triangle',.10,.09); },
  lure(){ tone(96,.09,'sawtooth',.10); },
  crash(){ noise(.45,.3); tone(70,.5,'sawtooth',.16); },
  wave(){ [523,659,784].forEach((f,i)=>tone(f,.10,'square',.12,i*.09)); },
  over(){ [392,330,262,196].forEach((f,i)=>tone(f,.24,'square',.14,i*.16)); }
};

/* ---------- state ---------- */
const G = {
  mode:'title', t:0, beam:-Math.PI/2, ships:[], spawnT:1.2,
  score:0, best:0, lanterns:3, wave:1, cleared:0, streak:0,
  flash:0, shake:0, msg:'', msgT:0, lock:0, lureT:0, drift:0
};

function reset(){
  G.mode='play'; G.ships.length=0; G.score=0; G.lanterns=3; G.wave=1;
  G.cleared=0; G.streak=0; G.spawnT=1.4; G.beam=-Math.PI/2;
  G.flash=0; G.shake=0; G.msg='WAVE 1'; G.msgT=1.4;
}

const waveSpeed  = () => 11 + (G.wave-1)*1.5;
const waveGap    = () => Math.max(1.05, 3.1 - (G.wave-1)*0.19);
const raiderOdds = () => Math.min(0.52, 0.14 + (G.wave-1)*0.055);

function spawn(){
  if(G.ships.length >= 6) return;
  const edge = (Math.random()*4)|0;
  let x,y;
  if(edge===0){ x = Math.random()*W; y = -8; }
  else if(edge===1){ x = Math.random()*W; y = H+8; }
  else if(edge===2){ x = -8; y = 20 + Math.random()*(H-30); }
  else { x = W+8; y = 20 + Math.random()*(H-30); }
  const raider = Math.random() < raiderOdds();
  G.ships.push({
    x, y, a: sang(x,y,CX,CY) + (Math.random()-.5)*0.5,
    type: raider ? 1 : 0, lit: 0, patience: 7.2, wob: Math.random()*6,
    state:'in', spd: waveSpeed() * (raider ? 0.95 : 1) * (0.9+Math.random()*0.25),
    ft: 0
  });
}

function litBy(s){
  const d = sdist(LX,LY,s.x,s.y);
  if(d > BEAM_LEN || d < 6) return false;
  return Math.abs(angDiff(sang(LX,LY,s.x,s.y), G.beam)) < BEAM_HALF;
}

function loseLantern(){
  G.lanterns--; G.streak = 0; G.flash = .32; G.shake = .5; sfx.crash();
  if(G.lanterns <= 0){
    G.mode='over'; G.lock = .9; G.best = Math.max(G.best, G.score); sfx.over();
  }
}

function cleared(){
  G.cleared++;
  if(G.cleared >= 8){
    G.cleared = 0; G.wave++; G.msg = 'WAVE ' + G.wave; G.msgT = 1.4; sfx.wave();
  }
}

function step(dt){
  G.t += dt; G.drift += dt*6;
  if(G.flash>0) G.flash -= dt;
  if(G.shake>0) G.shake -= dt;
  if(G.msgT>0) G.msgT -= dt;
  if(G.lock>0)  G.lock  -= dt;

  const dir = input();
  if(G.mode==='play') G.beam += dir * TURN_RATE * dt;
  else G.beam += TURN_RATE * 0.45 * dt;          // attract-mode sweep

  if(G.mode!=='play') return;

  G.spawnT -= dt;
  if(G.spawnT <= 0){ spawn(); G.spawnT = waveGap() * (0.8 + Math.random()*0.5); }

  let luring = false;

  for(let i=G.ships.length-1;i>=0;i--){
    const s = G.ships[i];
    if(s.ft>0) s.ft -= dt;
    let spd = s.spd;

    if(s.state === 'in'){
      const lit = litBy(s);
      s.lit = lit ? Math.min(1, s.lit + dt*2.2) : Math.max(0, s.lit - dt*0.8);
      const toRock = sang(s.x, s.y, CX, CY);

      if(s.type === 0){
        // trader: drifts in blind, turns for open water once it reads the light
        s.a = turnToward(s.a, toRock, dt*0.45);
        if(s.lit >= 1){
          s.state='out'; s.a = toRock + Math.PI + (Math.random()-.5)*0.7; s.ft = .5;
          G.streak++; G.score += 100 + Math.min(150, (G.streak-1)*25);
          sfx.save(); cleared();
        }
      }else{
        // raider: the light is what it steers by
        if(s.lit > 0.12){
          luring = true;
          s.a = turnToward(s.a, toRock, dt*2.2);
          spd = s.spd * (1.15 + s.lit*0.75);
        }else{
          s.wob += dt;
          s.a += Math.sin(s.wob*2.1)*dt*1.6;
          spd = s.spd * 0.42;
          s.patience -= dt;
          if(s.patience <= 0){
            s.state='out'; s.a = toRock + Math.PI + (Math.random()-.5)*0.9;
            G.score += 50; sfx.flee(); cleared();
          }
        }
      }
      if(sdist(s.x,s.y,CX,CY) < CRASH_R){ G.ships.splice(i,1); loseLantern(); continue; }
    }else{
      spd = s.spd * 1.7;
      s.lit = Math.max(0, s.lit - dt);
    }

    s.x += Math.cos(s.a)*spd*dt / PA;
    s.y += Math.sin(s.a)*spd*dt;
    if(s.x < -14 || s.x > W+14 || s.y < -14 || s.y > H+14) G.ships.splice(i,1);
  }

  if(luring){
    G.lureT -= dt;
    if(G.lureT <= 0){ sfx.lure(); G.lureT = .19; }
  } else G.lureT = 0;
}

/* ---------- drawing ---------- */
function drawSea(){
  ctx.fillStyle = C.sea; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = C.seaDeep;
  for(let y=0;y<H;y+=2) ctx.fillRect(0,y,W,1);
  ctx.fillStyle = C.wave;
  const off = Math.floor(G.drift) % 24;
  for(let y=14;y<H;y+=13){
    for(let x=((y*7)%24) - off; x<W; x+=24){
      const d = sdist(x+1,y,CX,CY);
      if(d > 26) ctx.fillRect(x, y + ((x>>3)&1), 3, 1);
    }
  }
}

function drawBeam(){
  const a0 = G.beam - BEAM_HALF, a1 = G.beam + BEAM_HALF;
  const wedge = (len, style) => {
    ctx.beginPath(); ctx.moveTo(LX, LY);
    for(let a=a0; a<=a1+0.001; a+=0.02) ctx.lineTo(LX + Math.cos(a)*len/PA, LY + Math.sin(a)*len);
    ctx.closePath(); ctx.fillStyle = style; ctx.fill();
  };
  wedge(BEAM_LEN, BEAM_FAR);
  wedge(BEAM_LEN*0.45, BEAM_NEAR);
}

function drawShip(s){
  const lit = s.lit > 0.25;
  const px = Math.round(s.x), py = Math.round(s.y);
  // wake
  ctx.fillStyle = C.wave;
  ctx.fillRect(px - Math.round(Math.cos(s.a)*3), py - Math.round(Math.sin(s.a)*3), 1, 1);

  let body = s.type ? C.raider : C.hull;
  if(s.state === 'out') body = s.ft>0 && (G.t*20|0)%2 ? C.white : C.safe;
  else if(lit) body = s.type ? C.raider : C.white;

  ctx.fillStyle = s.type ? C.raiderLo : C.wave;
  ctx.fillRect(px-2, py+1, 4, 1);           // shadowed hull line
  ctx.fillStyle = body;
  ctx.fillRect(px-2, py-1, 4, 2);           // hull
  ctx.fillRect(px + (Math.cos(s.a)>0?2:-3), py-1, 1, 1); // prow
  ctx.fillStyle = s.type ? C.raiderLo : (lit ? C.sail2 : C.sail);
  ctx.fillRect(px, py-3, 1, 2);             // mast/sail

  if(lit){                                   // caught in the light
    ctx.fillStyle = C.lamp;
    ctx.fillRect(px-3, py-2, 1, 1); ctx.fillRect(px+2, py-2, 1, 1);
  }
}

function drawIsland(){
  const ox = CX - 12, oy = CY - 7, hit = G.flash > 0;
  for(let r=0;r<ISLAND.length;r++){
    const row = ISLAND[r];
    for(let c2=0;c2<row.length;c2++){
      const ch = row[c2]; if(ch==='.') continue;
      ctx.fillStyle = hit ? C.towerRed : (ch==='r'?C.rock : ch==='d'?C.rockLo : C.sand);
      ctx.fillRect(ox+c2, oy+r, 1, 1);
    }
  }
  // lighthouse
  const tx = CX-1, ty = CY-12;
  for(let i=0;i<8;i++){
    ctx.fillStyle = (i%2) ? C.towerRed : C.tower;
    ctx.fillRect(tx, ty+i, 3, 1);
  }
  ctx.fillStyle = C.tower; ctx.fillRect(tx-1, ty-1, 5, 1);
  ctx.fillStyle = ((G.t*8|0)%2 && G.mode==='play') ? C.white : C.lamp;
  ctx.fillRect(tx, ty-3, 3, 2);
}

function drawHUD(){
  drawText(String(G.score).padStart(5,'0'), 4, 5, C.hud, 2);
  for(let i=0;i<G.lanterns;i++){
    const x = W-6-i*7;
    ctx.fillStyle = C.rockLo; ctx.fillRect(x, 5, 3, 5);
    ctx.fillStyle = C.lamp;   ctx.fillRect(x, 6, 3, 3);
  }
  drawText('WAVE '+G.wave, 4, 17, '#7f95a5', 1);
}

function render(){
  ctx.save();
  if(G.shake > 0){
    ctx.translate(Math.round((Math.random()-.5)*3), Math.round((Math.random()-.5)*3));
  }
  drawSea();
  drawBeam();
  for(const s of G.ships) drawShip(s);
  drawIsland();

  if(G.mode === 'play'){
    drawHUD();
    if(G.msgT > 0 && (G.t*6|0)%2) drawTextC(G.msg, 150, C.lamp, 2);
  }

  if(G.mode === 'title'){
    drawTextC('WRECKERS!', 22, C.lamp, 3);
    drawTextC('KEEP THE LIGHT', 44, C.salt, 1);
    drawTextC('WHITE SHIPS - SHOW THEM THE WAY', 158, C.salt, 1);
    drawTextC('RED SHIPS - KEEP THEM IN THE DARK', 166, C.raider, 1);
    if((G.t*2|0)%2) drawTextC('PRESS START', 178, C.lamp, 1);
  }

  if(G.mode === 'over'){
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 60, W, 76);
    drawTextC('THE LIGHT', 68, C.raider, 2);
    drawTextC('WENT OUT', 82, C.raider, 2);
    drawTextC('SCORE '+String(G.score).padStart(5,'0'), 100, C.lamp, 1);
    drawTextC('BEST  '+String(G.best).padStart(5,'0'), 110, C.hull, 1);
    if(G.lock <= 0 && (G.t*2|0)%2) drawTextC('PRESS START', 124, C.salt, 1);
  }

  ctx.restore();
  if(G.flash > 0){
    ctx.fillStyle = G.flash > .22 ? C.white : 'rgba(255,255,255,.35)';
    ctx.fillRect(0,0,W,H);
  }
}

/* ---------- input: two directions, and nothing else ---------- */
const held = { l:false, r:false };
const ptr  = new Map();
function input(){
  let d = 0;
  if(held.l || [...ptr.values()].includes(-1)) d -= 1;
  if(held.r || [...ptr.values()].includes( 1)) d += 1;
  return d;
}
function fire(){
  audio();
  if(G.mode === 'title'){ reset(); }
  else if(G.mode === 'over' && G.lock <= 0){ reset(); }
}

const kl = document.getElementById('kl'), kr = document.getElementById('kr'), kf = document.getElementById('kf');
function bind(el, dir){
  const down = e => { e.preventDefault(); ptr.set(e.pointerId, dir); el.classList.add('on'); audio();
                      if(G.mode!=='play') fire(); };
  const up   = e => { ptr.delete(e.pointerId); el.classList.remove('on'); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bind(kl, -1); bind(kr, 1);
kf.addEventListener('pointerdown', e => { e.preventDefault(); kf.classList.add('on'); fire(); });
['pointerup','pointercancel','pointerleave'].forEach(t => kf.addEventListener(t, () => kf.classList.remove('on')));

// the screen itself is a two-zone control, the way a paddle was
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audio();
  if(G.mode !== 'play'){ fire(); return; }
  const r = cv.getBoundingClientRect();
  ptr.set(e.pointerId, (e.clientX - r.left) < r.width/2 ? -1 : 1);
});
['pointerup','pointercancel'].forEach(t =>
  cv.addEventListener(t, e => ptr.delete(e.pointerId)));

addEventListener('keydown', e => {
  if(e.repeat) return;
  const k = e.key.toLowerCase();
  if(k==='arrowleft'  || k==='a'){ held.l = true; kl.classList.add('on'); e.preventDefault(); }
  if(k==='arrowright' || k==='d'){ held.r = true; kr.classList.add('on'); e.preventDefault(); }
  if(k===' ' || k==='enter'){ fire(); e.preventDefault(); }
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if(k==='arrowleft'  || k==='a'){ held.l = false; kl.classList.remove('on'); }
  if(k==='arrowright' || k==='d'){ held.r = false; kr.classList.remove('on'); }
});
addEventListener('blur', () => { held.l = held.r = false; ptr.clear();
  kl.classList.remove('on'); kr.classList.remove('on'); });

/* ---------- loop ---------- */
const housing = document.getElementById('housing');
let last = performance.now(), glowT = 0;
function frame(now){
  let dt = (now - last)/1000; last = now;
  if(dt > 0.05) dt = 0.05;
  step(dt);
  render();
  // the housing breathes with the lamp — one glow, tied to the game
  glowT += dt;
  if(glowT > .1){
    glowT = 0;
    const lit = G.mode==='play' ? 26 + G.streak*2 : 20;
    housing.style.setProperty('--glow', (G.flash>0 ? 70 : lit) + 'px');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// keep the whole thing on one screen, no page scroll
document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
function fit(){
  const cab = document.getElementById('cab');
  const pad = document.getElementById('pad').offsetHeight;
  const lab = document.getElementById('label').offsetHeight;
  const avail = window.innerHeight - pad - lab - 60;
  const maxW = Math.min(520, avail * 4/3);
  if(maxW > 200 && getComputedStyle(cab).flexDirection === 'column') cab.style.maxWidth = maxW + 'px';
}
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit,150)); fit();

})();
