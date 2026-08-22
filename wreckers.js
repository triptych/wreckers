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
  shark:'#5c6b74', sharkLo:'#38424a', fin:'#1f262b',
  mermaid:'#e89cc4', mermaidLit:'#ffe1f0', tail:'#4cc0b8',
  hud:'#fcd84c', dark:'#000000', white:'#ffffff',
  supply:'#8cf0ff', supplyLo:'#3c9cb0', lightWave:'#eaffff',
  kraken:'#2c5c4c', krakenLo:'#173a2e', krakenHi:'#4c9c78', eye:'#e8fc4c',
  aggroLo:'#54c05a', aggroMid:'#e8c832', aggroHi:'#d84c2c'
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

/* ---------- state ---------- */
const MAX_LANTERNS = 3;
const SUPPLY_NEEDED = 4;

const G = {
  mode:'title', t:0, beam:-Math.PI/2, ships:[], spawnT:1.2,
  score:0, best:0, lanterns:3, wave:1, cleared:0, streak:0,
  flash:0, shake:0, msg:'', msgT:0, lock:0, lureT:0, drift:0,
  sharks:[], sharkT:2.4, mermaids:[], mermaidT:6, sharkWarnT:0,
  supply:0, supplies:[], lightWaveT:0, lightWaveR:0,
  mermaidsSaved:0, boss:null, bossIntroT:0
};

function reset(){
  G.mode='play'; G.ships.length=0; G.score=0; G.lanterns=MAX_LANTERNS; G.wave=1;
  G.cleared=0; G.streak=0; G.spawnT=1.4; G.beam=-Math.PI/2;
  G.flash=0; G.shake=0; G.msg='WAVE 1'; G.msgT=1.4;
  G.sharks.length=0; G.sharkT=2.4; G.mermaids.length=0; G.mermaidT=6; G.sharkWarnT=0;
  G.supply=0; G.supplies.length=0; G.lightWaveT=0; G.lightWaveR=0;
  G.mermaidsSaved=0; G.boss=null; G.bossIntroT=0;
}

/* sharks show up once the waters get busy; mermaids once the player has proven they can juggle them */
const SHARK_WAVE   = 3;
const MERMAID_WAVE = 4;
const sharkSpeed = () => 15 + (G.wave-SHARK_WAVE)*1.2;
const mermaidSpeed = () => 7 + (G.wave-MERMAID_WAVE)*0.6;

const waveSpeed  = () => 11 + (G.wave-1)*1.5;
const waveGap    = () => Math.max(1.05, 3.1 - (G.wave-1)*0.19);
const raiderOdds = () => Math.min(0.52, 0.14 + (G.wave-1)*0.055);

/* ---------- the boss wave: every 5th wave, a Kraken looms in from the side.
   No ships or sharks spawn while it's up. A single aggression meter (0-100)
   is the whole fight: dark and it creeps in, lit and it backs off. Reach 100
   and its arm reaches the lighthouse — instant game over. Survive the clock
   and it flees. Every mermaid saved (lifetime, capped) fights alongside you,
   swimming out to shove its aggression down when it lands a hit. ---------- */
const BOSS_EVERY   = 5;
const BOSS_MAX_ALLIES = 5;
const isBossWave  = w => w % BOSS_EVERY === 0;
const bossCycle   = () => Math.max(1, Math.floor(G.wave / BOSS_EVERY));
const bossAggroRate  = () => 6.5 + (bossCycle()-1)*0.9;   // %/sec, unlit
const bossCalmRate   = () => 15 + (bossCycle()-1)*0.6;    // %/sec, lit
const bossFightLen   = () => 42 + (bossCycle()-1)*6;      // seconds to survive

function spawnBoss(){
  const side = Math.random()<0.5 ? -1 : 1;   // -1 left, 1 right
  const edgeX = side<0 ? -20 : W+20;
  G.boss = {
    side, homeX: edgeX, x: edgeX, y: CY - 20,
    aggro: 30, timer: bossFightLen(), fleeT: 0, hitT: 0, tentT: 0,
    lit: 0, wob: 0,
    allies: []   // ally mermaids currently swimming out to help
  };
  for(const s of G.ships) s.state='out';
  G.ships.length = 0; G.sharks.length = 0; G.mermaids.length = 0; G.supplies.length = 0;
}

// bring in up to BOSS_MAX_ALLIES mermaids (from the lifetime save count) to
// take turns swimming out from the lighthouse and shoving the Kraken back.
function spawnAlly(){
  const b = G.boss; if(!b) return;
  const cap = Math.min(BOSS_MAX_ALLIES, G.mermaidsSaved);
  if(b.allies.length >= cap) return;
  b.allies.push({ x: LX, y: LY, phase:'out', t:0 });
}

function bossHit(amount){
  const b = G.boss; if(!b) return;
  b.aggro = Math.max(0, b.aggro - amount);
  b.hitT = 0.25;
}

function endBossWave(won){
  const b = G.boss; if(!b) return;
  G.boss = null;
  if(won){
    G.score += 1000 + (bossCycle()-1)*250;
    sfx.wave(); tone(1568,.22,'triangle',.14,.12);
    G.msg = 'THE KRAKEN FLEES'; G.msgT = 2.2;
  }
  G.wave++;
  const healed = G.lanterns < MAX_LANTERNS;
  if(healed) G.lanterns++;
  G.cleared = 0;
  if(healed) tone(1046, .18, 'triangle', .12, .18);
}

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
    id: ++idSeq, x, y, a: sang(x,y,CX,CY) + (Math.random()-.5)*0.5,
    type: raider ? 1 : 0, lit: 0, patience: 7.2, wob: Math.random()*6,
    state:'in', spd: waveSpeed() * (raider ? 0.95 : 1) * (0.9+Math.random()*0.25),
    ft: 0
  });
}
let idSeq = 0;

function spawnShark(){
  if(G.sharks.length >= 3) return;
  const edge = (Math.random()*4)|0;
  let x,y;
  if(edge===0){ x = Math.random()*W; y = -10; }
  else if(edge===1){ x = Math.random()*W; y = H+10; }
  else if(edge===2){ x = -10; y = 20 + Math.random()*(H-30); }
  else { x = W+10; y = 20 + Math.random()*(H-30); }
  G.sharks.push({
    x, y, a: sang(x,y,CX,CY), lit:0, spd: sharkSpeed(), preyId:null, scared:0
  });
}

function spawnMermaid(){
  if(G.mermaids.length >= 1) return;
  const edge = (Math.random()*4)|0;
  let x,y;
  if(edge===0){ x = Math.random()*W; y = -8; }
  else if(edge===1){ x = Math.random()*W; y = H+8; }
  else if(edge===2){ x = -8; y = 20 + Math.random()*(H-30); }
  else { x = W+8; y = 20 + Math.random()*(H-30); }
  G.mermaids.push({
    id: ++idSeq, x, y, a: sang(x,y,CX,CY), lit:0, spd: mermaidSpeed(),
    wob: Math.random()*6, safeT:0
  });
}

// a supply point drifts free until caught in the beam, then it's drawn in
// like a tractor beam and fills one slot of the Light Wave.
function spawnSupply(x, y){
  if(G.supply >= SUPPLY_NEEDED) return;
  G.supplies.push({ x, y, a: Math.random()*Math.PI*2, drift: 4 + Math.random()*3 });
}

function litBy(s){
  const d = sdist(LX,LY,s.x,s.y);
  if(d > BEAM_LEN || d < 6) return false;
  return Math.abs(angDiff(sang(LX,LY,s.x,s.y), G.beam)) < BEAM_HALF;
}

function loseLantern(msg){
  G.lanterns--; G.streak = 0; G.flash = .32; G.shake = .5;
  if(msg){ G.msg = msg; G.msgT = 1.3; } else sfx.crash();
  if(G.lanterns <= 0){
    G.mode='over'; G.lock = .9; G.best = Math.max(G.best, G.score); sfx.over();
  }
}

function cleared(){
  if(G.boss) return; // boss waves end on their own clock, not a ship count
  G.cleared++;
  if(G.cleared >= 8){
    G.cleared = 0; G.wave++;
    if(isBossWave(G.wave)){
      G.bossIntroT = 1.6; G.msg = 'THE KRAKEN RISES'; G.msgT = 1.6;
      G.ships.length = 0; G.sharks.length = 0; G.mermaids.length = 0;
      sfx.crash();
      return;
    }
    const healed = G.lanterns < MAX_LANTERNS;
    if(healed) G.lanterns++;
    if(G.wave === SHARK_WAVE)        { G.msg = 'SHARKS! USE THE LIGHT'; G.msgT = 2.4; }
    else if(G.wave === MERMAID_WAVE) { G.msg = 'GUIDE THE MERMAIDS IN'; G.msgT = 2.4; }
    else                              { G.msg = 'WAVE ' + G.wave; G.msgT = 1.4; }
    sfx.wave();
    if(healed) tone(1046, .18, 'triangle', .12, .18);
  }
}

// the Light Wave: a pulse from the lamp that shoves every ship off, scares
// every shark, and reels in every mermaid at once. Costs a full supply meter.
// During a boss fight it instead slams the Kraken's aggression down by half.
function triggerLightWave(){
  if(G.mode !== 'play' || G.supply < SUPPLY_NEEDED || G.lightWaveT > 0) return;
  G.supply = 0;
  G.lightWaveT = 0.6; G.lightWaveR = 0;
  G.shake = .45; sfx.lightWave();

  if(G.boss){
    G.boss.aggro *= 0.5; G.boss.hitT = 0.35;
    return;
  }

  for(const s of G.ships){
    if(s.state !== 'in') continue;
    const away = sang(CX, CY, s.x, s.y);
    s.state = 'out'; s.a = away; s.ft = .5; s.lit = 0;
    if(s.type === 0){ G.streak++; G.score += 100 + Math.min(150, (G.streak-1)*25); }
    else{ G.score += 50; }
    cleared();
  }
  for(const sh of G.sharks){ sh.scared = 2.2; sh.preyId = null; }
  for(let i=G.mermaids.length-1;i>=0;i--){
    G.mermaids.splice(i,1);
    G.mermaidsSaved++;
    G.score += 400 + G.wave*25; cleared();
  }
}

// the Kraken fight: aggression rises while dark, falls while lit. Mermaid
// allies swim out from the lighthouse and shove it back on contact. Reach
// zero on the clock and it flees; reach 100 and its arm takes the lighthouse.
const BOSS_TENT_X = () => G.boss.x + (G.boss.side<0 ? 26 : -26);
function stepBoss(dt){
  const b = G.boss;
  b.wob += dt; b.timer -= dt;
  if(b.hitT>0) b.hitT -= dt;

  // it looms further in from its edge the higher its aggression climbs
  const reach = Math.min(1, b.aggro/100);
  b.x = b.homeX + (CX - b.homeX) * reach * 0.82;
  b.y = CY - 20 + Math.sin(b.wob*0.7)*4;

  const tx = b.x + (b.side<0 ? 14 : -14), ty = b.y + 6;
  const lit = sdist(LX,LY,tx,ty) < BEAM_LEN && Math.abs(angDiff(sang(LX,LY,tx,ty), G.beam)) < BEAM_HALF;
  b.lit = lit ? Math.min(1, b.lit + dt*2) : Math.max(0, b.lit - dt*1.5);

  b.aggro += (lit ? -bossCalmRate() : bossAggroRate()) * dt;
  b.aggro = Math.max(0, Math.min(100, b.aggro));

  if(b.aggro >= 100){
    G.boss = null; G.lanterns = 0; G.flash = .4; G.shake = .7;
    G.mode = 'over'; G.lock = .9; G.best = Math.max(G.best, G.score);
    sfx.crash(); sfx.over();
    return;
  }

  // bring in another ally as long as there's lifetime mermaids to spare
  b.allyT = (b.allyT ?? 0) - dt;
  if(b.allyT <= 0){ spawnAlly(); b.allyT = 3.2; }

  for(let i=b.allies.length-1;i>=0;i--){
    const al = b.allies[i];
    al.t += dt;
    if(al.phase === 'out'){
      const toB = sang(al.x, al.y, tx, ty);
      al.a = toB;
      al.x += Math.cos(al.a)*34*dt / PA;
      al.y += Math.sin(al.a)*34*dt;
      if(sdist(al.x,al.y,tx,ty) < 7){
        bossHit(9); sfx.supply(); al.phase='back'; al.t = 0;
      }
    }else{
      const toHome = sang(al.x, al.y, LX, LY);
      al.a = toHome;
      al.x += Math.cos(al.a)*34*dt / PA;
      al.y += Math.sin(al.a)*34*dt;
      if(sdist(al.x,al.y,LX,LY) < 6){ b.allies.splice(i,1); }
    }
  }

  if(b.timer <= 0){ endBossWave(true); return; }
}

function step(dt){
  G.t += dt; G.drift += dt*6;
  if(G.flash>0) G.flash -= dt;
  if(G.shake>0) G.shake -= dt;
  if(G.msgT>0) G.msgT -= dt;
  if(G.lock>0)  G.lock  -= dt;
  if(G.lightWaveT>0){ G.lightWaveT -= dt; G.lightWaveR += dt * 260; }

  const dir = input();
  if(G.mode==='play') G.beam += dir * TURN_RATE * dt;
  else G.beam += TURN_RATE * 0.45 * dt;          // attract-mode sweep

  if(G.mode!=='play') return;

  // the boss intro holds the shoal empty and quiet for a beat before the
  // Kraken surfaces; no ships, sharks, or mermaids spawn during it or the fight.
  if(G.bossIntroT > 0){
    G.bossIntroT -= dt;
    if(G.bossIntroT <= 0){ spawnBoss(); sfx.crash(); tone(55,.6,'sawtooth',.2); }
    return;
  }

  if(!G.boss){
    G.spawnT -= dt;
    if(G.spawnT <= 0){ spawn(); G.spawnT = waveGap() * (0.8 + Math.random()*0.5); }

    if(G.wave >= SHARK_WAVE){
      G.sharkT -= dt;
      if(G.sharkT <= 0){ spawnShark(); G.sharkT = Math.max(2.6, 6.5 - (G.wave-SHARK_WAVE)*0.4) * (0.8+Math.random()*0.4); }
    }
    if(G.wave >= MERMAID_WAVE){
      G.mermaidT -= dt;
      if(G.mermaidT <= 0){ spawnMermaid(); G.mermaidT = Math.max(9, 18 - (G.wave-MERMAID_WAVE)*1.2) * (0.8+Math.random()*0.4); }
    }
  }

  if(G.boss){ stepBoss(dt); return; }

  let luring = false;

  // clear last frame's "being stalked" marks; the shark pass below re-marks live targets
  for(const s of G.ships) s.stalkD = Infinity;
  for(const m of G.mermaids) m.stalkD = Infinity;
  for(const sh of G.sharks){
    if(sh.scared > 0 || sh.preyId == null) continue;
    const prey = G.mermaids.find(m=>m.id===sh.preyId) || G.ships.find(s2=>s2.id===sh.preyId);
    if(prey) prey.stalkD = Math.min(prey.stalkD ?? Infinity, sdist(sh.x,sh.y,prey.x,prey.y));
  }

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
          // a grateful trader sometimes tosses back a supply as it sails off
          if(Math.random() < 0.35) spawnSupply(s.x, s.y);
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

  // supply points: bob in place until the beam catches them, then the light
  // pulls them in like a tractor beam — reach the lamp and they power up the Light Wave.
  for(let i=G.supplies.length-1;i>=0;i--){
    const sp = G.supplies[i];
    const lit = litBy(sp);
    if(lit){
      const toLamp = sang(sp.x, sp.y, LX, LY);
      sp.a = turnToward(sp.a, toLamp, dt*4);
      const d = sdist(sp.x,sp.y,LX,LY);
      const pull = 26 + (1 - Math.min(1,d/BEAM_LEN))*40;
      sp.x += Math.cos(sp.a)*pull*dt / PA;
      sp.y += Math.sin(sp.a)*pull*dt;
      if(d < 8){
        G.supplies.splice(i,1); G.supply = Math.min(SUPPLY_NEEDED, G.supply+1);
        if(G.supply >= SUPPLY_NEEDED) sfx.supplyFull(); else sfx.supply();
        continue;
      }
    }else{
      sp.a += Math.sin(G.t*1.3 + sp.drift)*dt*0.8;
      sp.x += Math.cos(sp.a)*3*dt / PA;
      sp.y += Math.sin(sp.a)*3*dt;
    }
    if(sp.x < -14 || sp.x > W+14 || sp.y < -14 || sp.y > H+14) G.supplies.splice(i,1);
  }

  // mermaids: drawn in only while lit, otherwise they stall and drift; snatched if left
  // undefended near a shark or a raider.
  for(let i=G.mermaids.length-1;i>=0;i--){
    const m = G.mermaids[i];
    const lit = litBy(m);
    m.lit = lit ? Math.min(1, m.lit + dt*1.6) : Math.max(0, m.lit - dt*1.1);
    const toRock = sang(m.x, m.y, CX, CY);
    m.a = turnToward(m.a, toRock, dt*0.7);

    let spd;
    if(m.lit > 0.15){
      spd = m.spd * (0.6 + m.lit*0.9);
    }else{
      m.wob += dt;
      m.a += Math.sin(m.wob*1.7)*dt*1.2;
      spd = m.spd * 0.15;
    }

    if(m.safeT > 0) m.safeT -= dt;
    let taken = false;
    // a mermaid can only be snatched where the light could actually have reached her —
    // otherwise the player never had a chance to save her.
    if(m.lit < 0.3 && m.safeT <= 0 && sdist(LX,LY,m.x,m.y) < BEAM_LEN){
      for(const sh of G.sharks){
        if(sdist(m.x,m.y,sh.x,sh.y) < 9){ taken = true; break; }
      }
      if(!taken) for(const s2 of G.ships){
        if(s2.type===1 && s2.state==='in' && sdist(m.x,m.y,s2.x,s2.y) < 8){ taken = true; break; }
      }
    }
    if(taken){
      G.mermaids.splice(i,1); G.streak = 0; G.flash = .22; sfx.bite(); continue;
    }

    if(sdist(m.x,m.y,CX,CY) < CRASH_R){
      G.mermaids.splice(i,1);
      G.mermaidsSaved++;
      G.score += 400 + G.wave*25; sfx.mermaid(); cleared();
      continue;
    }

    m.x += Math.cos(m.a)*spd*dt / PA;
    m.y += Math.sin(m.a)*spd*dt;
    if(m.x < -14 || m.x > W+14 || m.y < -14 || m.y > H+14) G.mermaids.splice(i,1);
  }

  // sharks: hunt the nearest ship or mermaid, break off and flee when caught in the light.
  for(let i=G.sharks.length-1;i>=0;i--){
    const sh = G.sharks[i];
    const lit = litBy(sh);
    sh.lit = lit ? Math.min(1, sh.lit + dt*2.4) : Math.max(0, sh.lit - dt*1.2);

    if(sh.lit >= 0.6 && sh.scared <= 0){
      sh.scared = 1.6; sh.preyId = null; sfx.sharkAway();
    }

    if(sh.scared > 0){
      sh.scared -= dt;
      const away = sang(CX,CY,sh.x,sh.y);
      sh.a = turnToward(sh.a, away, dt*3);
      const spd = sh.spd * 1.6;
      sh.x += Math.cos(sh.a)*spd*dt / PA;
      sh.y += Math.sin(sh.a)*spd*dt;
      if(sh.x < -16 || sh.x > W+16 || sh.y < -16 || sh.y > H+16) G.sharks.splice(i,1);
      continue;
    }

    // pick (or keep) a target: the nearest mermaid, else the nearest inbound ship
    let prey = null;
    if(sh.preyId != null){
      prey = G.mermaids.find(m=>m.id===sh.preyId) || G.ships.find(s2=>s2.id===sh.preyId && s2.state==='in');
    }
    if(!prey){
      let best = null, bestD = Infinity;
      for(const m of G.mermaids){ const d = sdist(sh.x,sh.y,m.x,m.y); if(d<bestD){bestD=d; best=m;} }
      for(const s2 of G.ships){ if(s2.state!=='in') continue; const d = sdist(sh.x,sh.y,s2.x,s2.y); if(d<bestD){bestD=d; best=s2;} }
      prey = best; if(prey) sh.preyId = prey.id;
    }

    if(prey){
      sh.a = turnToward(sh.a, sang(sh.x,sh.y,prey.x,prey.y), dt*2.4);
    }else{
      sh.a = turnToward(sh.a, sang(sh.x,sh.y,CX,CY), dt*1);
    }
    const spd = sh.spd;
    sh.x += Math.cos(sh.a)*spd*dt / PA;
    sh.y += Math.sin(sh.a)*spd*dt;

    // a shark can only make its kill within the lamp's reach — outside BEAM_LEN
    // the player never had a shot at driving it off, so let it keep closing instead.
    if(prey && sdist(sh.x,sh.y,prey.x,prey.y) < 6 && sdist(LX,LY,prey.x,prey.y) < BEAM_LEN){
      const isMermaid = G.mermaids.includes(prey);
      if(isMermaid){
        G.mermaids.splice(G.mermaids.indexOf(prey),1);
      }else{
        const idx = G.ships.indexOf(prey);
        if(idx>=0) G.ships.splice(idx,1);
      }
      G.sharks.splice(i,1);
      if(isMermaid){ G.streak = 0; G.flash = .26; sfx.bite(); }
      else if(prey.type===0){ sfx.bite(); loseLantern('SHARK TOOK A SHIP'); }
      else { G.score += 30; sfx.bite(); spawnSupply(prey.x, prey.y); }
      continue;
    }
    if(sh.x < -16 || sh.x > W+16 || sh.y < -16 || sh.y > H+16) G.sharks.splice(i,1);
  }

  if(luring){
    G.lureT -= dt;
    if(G.lureT <= 0){ sfx.lure(); G.lureT = .19; }
  } else G.lureT = 0;

  // a shark closing on a trader or mermaid gets a ticking warning — the target
  // it's chasing is worth protecting, unlike a raider left to the sharks.
  let closest = Infinity;
  for(const s of G.ships) if(s.type===0 && s.stalkD < closest) closest = s.stalkD;
  for(const m of G.mermaids) if(m.stalkD < closest) closest = m.stalkD;
  if(closest < 40){
    G.sharkWarnT -= dt;
    if(G.sharkWarnT <= 0){ sfx.sharkNear(); G.sharkWarnT = Math.max(.14, closest/40 * .5); }
  } else G.sharkWarnT = 0;
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
  drawStalkMark(s, px, py);
}

// a shark closing in shows as a small fin over its target — blink rate
// quickens as the shark gets nearer, so the threat reads before the bite.
function drawStalkMark(entity, px, py){
  const d = entity.stalkD;
  if(!(d < 40)) return;
  const rate = 4 + (1 - d/40)*10;
  if((G.t*rate|0)%2){
    ctx.fillStyle = C.fin;
    ctx.fillRect(px-1, py-6, 3, 1); ctx.fillRect(px, py-7, 1, 1);
  }
}

function drawShark(sh){
  const px = Math.round(sh.x), py = Math.round(sh.y);
  const facingR = Math.cos(sh.a) > 0;
  const lit = sh.lit > 0.25;
  ctx.fillStyle = C.wave;
  ctx.fillRect(px - Math.round(Math.cos(sh.a)*3), py - Math.round(Math.sin(sh.a)*3), 1, 1);
  ctx.fillStyle = lit ? '#8a99a2' : C.shark;
  ctx.fillRect(px-3, py, 6, 1);                          // body
  ctx.fillStyle = C.sharkLo;
  ctx.fillRect(px-3, py+1, 6, 1);                        // belly shadow
  ctx.fillStyle = C.fin;
  ctx.fillRect(px, py-2, 1, 2);                          // dorsal fin
  ctx.fillStyle = lit ? '#8a99a2' : C.shark;
  ctx.fillRect(px + (facingR? 3:-4), py, 1, 1);          // nose
  if(sh.scared > 0 && (G.t*16|0)%2){
    ctx.fillStyle = C.white; ctx.fillRect(px-1, py-4, 1,1); ctx.fillRect(px+1, py-4, 1,1);
  }
}

function drawSupply(sp){
  const px = Math.round(sp.x), py = Math.round(sp.y);
  const pulse = (G.t*6|0)%2;
  ctx.fillStyle = pulse ? C.supply : C.supplyLo;
  ctx.fillRect(px-1, py-1, 3, 3);
  ctx.fillStyle = C.supply;
  ctx.fillRect(px, py, 1, 1);
}

function drawMermaid(m){
  const px = Math.round(m.x), py = Math.round(m.y);
  const lit = m.lit > 0.2;
  ctx.fillStyle = C.wave;
  ctx.fillRect(px - Math.round(Math.cos(m.a)*2), py - Math.round(Math.sin(m.a)*2), 1, 1);
  ctx.fillStyle = C.tail;
  ctx.fillRect(px + (Math.cos(m.a)>0?-3:2), py, 2, 1);   // tail fin
  ctx.fillStyle = lit ? C.mermaidLit : C.mermaid;
  ctx.fillRect(px-1, py-1, 3, 2);                        // body
  ctx.fillStyle = lit ? C.mermaidLit : C.mermaid;
  ctx.fillRect(px + (Math.cos(m.a)>0?1:-1), py-2, 1, 1); // head
  if(lit){
    ctx.fillStyle = C.lamp;
    ctx.fillRect(px-2, py-3, 1, 1); ctx.fillRect(px+2, py-3, 1, 1);
  }
  drawStalkMark(m, px, py);
}

// a small pixel ally, distinct from the wild mermaids: she swims out from the
// lighthouse to shove the Kraken back, then heads home for another lap.
function drawAlly(al){
  const px = Math.round(al.x), py = Math.round(al.y);
  ctx.fillStyle = C.wave;
  ctx.fillRect(px - Math.round(Math.cos(al.a)*2), py - Math.round(Math.sin(al.a)*2), 1, 1);
  ctx.fillStyle = C.tail;
  ctx.fillRect(px + (Math.cos(al.a)>0?-3:2), py, 2, 1);
  ctx.fillStyle = C.mermaidLit;
  ctx.fillRect(px-1, py-1, 3, 2);
  ctx.fillRect(px + (Math.cos(al.a)>0?1:-1), py-2, 1, 1);
}

// the Kraken: a big, looming pixel body docked at one edge, tentacles reaching
// further in as its aggression climbs. Flashes white when hit by a mermaid
// push or the Light Wave; darkens and calms while caught in the beam.
function drawKraken(b){
  const px = Math.round(b.x), py = Math.round(b.y);
  const faceR = b.side < 0;
  const hit = b.hitT > 0;
  const bob = Math.sin(b.wob*1.4)*2;
  const bodyCol = hit ? C.white : (b.lit>0.3 ? C.krakenHi : C.kraken);
  const loCol   = hit ? C.salt  : C.krakenLo;

  // reaching tentacle — grows toward the lighthouse with aggression
  const reach = Math.min(1, b.aggro/100);
  const tlen = 10 + reach*30;
  const tx = px + (faceR? 1:-1)*tlen, ty = py + 8 + bob*0.4;
  ctx.fillStyle = loCol;
  for(let i=0;i<tlen;i+=2){
    const yy = py + 8 + Math.sin(i*0.5 + b.wob*3)*2;
    ctx.fillRect(px + (faceR?1:-1)*i, Math.round(yy), 2, 2);
  }
  ctx.fillStyle = bodyCol;
  ctx.fillRect(Math.round(tx)-1, Math.round(ty)-1, 3, 3); // tentacle tip / suckers

  // head + mantle, big and looming off the edge
  ctx.fillStyle = loCol;
  ctx.fillRect(px-9, py-10+bob, 18, 22);
  ctx.fillStyle = bodyCol;
  ctx.fillRect(px-8, py-9+bob, 16, 18);
  ctx.fillRect(px-6, py-13+bob, 12, 5);      // domed head

  // a fan of shorter fringe tentacles under the mantle
  ctx.fillStyle = loCol;
  for(let i=-2;i<=2;i++){
    const sway = Math.sin(b.wob*2 + i)*2;
    ctx.fillRect(px-7+ (i+2)*3, Math.round(py+9+bob+sway), 3, 6);
  }

  // eyes — glare toward the lighthouse
  ctx.fillStyle = C.eye;
  ctx.fillRect(px + (faceR? -3: 0), py-6+bob, 2, 2);
  ctx.fillRect(px + (faceR?  1:-3), py-6+bob, 2, 2);
  if(b.lit > 0.3){
    ctx.fillStyle = C.dark;
    ctx.fillRect(px + (faceR? -3: 0), py-6+bob, 1, 1);
    ctx.fillRect(px + (faceR?  1:-3), py-6+bob, 1, 1);
  }
}

// the boss HUD: a big aggression bar across the top, filling toward red —
// a full bar means its arm is about to reach the lighthouse.
function drawBossHUD(b){
  const x0 = 20, y0 = 22, bw = W-40, bh = 6;
  drawTextC('KRAKEN AGGRESSION', y0-7, C.salt, 1);
  ctx.fillStyle = C.rockLo; ctx.fillRect(x0-1, y0-1, bw+2, bh+2);
  ctx.fillStyle = C.dark;   ctx.fillRect(x0, y0, bw, bh);
  const pct = b.aggro/100;
  const col = pct < 0.5 ? C.aggroLo : pct < 0.8 ? C.aggroMid : C.aggroHi;
  ctx.fillStyle = col;
  ctx.fillRect(x0, y0, Math.round(bw*pct), bh);
  const secs = Math.max(0, Math.ceil(b.timer));
  drawTextC('HOLD '+secs, H-14, C.hud, 1);
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

  // supply meter: 4 slots, bottom-right, fill up toward a Light Wave
  const full = G.supply >= SUPPLY_NEEDED;
  for(let i=0;i<SUPPLY_NEEDED;i++){
    const x = W-6-i*7, y = H-9;
    ctx.fillStyle = C.supplyLo; ctx.fillRect(x, y, 4, 4);
    if(i < G.supply){
      ctx.fillStyle = (full && (G.t*6|0)%2) ? C.lightWave : C.supply;
      ctx.fillRect(x+1, y+1, 2, 2);
    }
  }
}

// the Light Wave itself: an expanding, fading ring from the lamp.
function drawLightWaveRing(){
  if(G.lightWaveT <= 0) return;
  const r = G.lightWaveR, a = Math.max(0, G.lightWaveT/0.6);
  ctx.strokeStyle = C.lightWave;
  ctx.globalAlpha = a;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(LX, LY, r/PA, r, 0, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function render(){
  ctx.save();
  if(G.shake > 0){
    ctx.translate(Math.round((Math.random()-.5)*3), Math.round((Math.random()-.5)*3));
  }
  drawSea();
  if(G.boss) drawKraken(G.boss);
  drawIsland();
  drawBeam();
  for(const sh of G.sharks) drawShark(sh);
  for(const s of G.ships) drawShip(s);
  for(const sp of G.supplies) drawSupply(sp);
  for(const m of G.mermaids) drawMermaid(m);
  if(G.boss) for(const al of G.boss.allies) drawAlly(al);
  drawLightWaveRing();

  if(G.mode === 'play'){
    drawHUD();
    if(G.boss) drawBossHUD(G.boss);
    if(G.msgT > 0 && (G.t*6|0)%2) drawTextC(G.msg, 150, C.lamp, 2);
  }

  if(G.mode === 'title'){
    drawTextC('WRECKERS!', 22, C.lamp, 3);
    drawTextC('KEEP THE LIGHT', 44, C.salt, 1);
    drawTextC('WHITE SHIPS - SHOW THEM THE WAY', 150, C.salt, 1);
    drawTextC('RED SHIPS - KEEP THEM IN THE DARK', 158, C.raider, 1);
    drawTextC('SHARKS - DRIVE THEM OFF WITH LIGHT', 163, C.shark, 1);
    drawTextC('MERMAIDS - LIGHT THEIR WAY HOME', 170, C.mermaid, 1);
    drawTextC('WAVE 5 - HOLD THE LIGHT ON THE KRAKEN', 177, C.krakenHi, 1);
    if((G.t*2|0)%2) drawTextC('PRESS START', 186, C.lamp, 1);
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
  else if(G.mode === 'play'){ triggerLightWave(); }
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
    if(G.mode === 'play'){
      const ready = G.supply >= SUPPLY_NEEDED;
      kf.textContent = ready ? 'WAVE!' : 'LIGHT';
      kf.classList.toggle('ready', ready);
    }else{
      kf.textContent = 'START';
      kf.classList.remove('ready');
    }
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
