import { sdist, sang, angDiff, turnToward, W, H, PA } from './geometry.js';
import { sfx, tone } from './audio.js';
import {
  G, CX, CY, LX, LY, BEAM_LEN, BEAM_HALF, TURN_RATE, CRASH_R,
  MAX_LANTERNS, SUPPLY_NEEDED
} from './state.js';
import { input } from './input.js';

/* sharks show up once the waters get busy; mermaids once the player has proven they can juggle them */
export const SHARK_WAVE   = 3;
export const MERMAID_WAVE = 4;
export const sharkSpeed = () => 15 + (G.wave-SHARK_WAVE)*1.2;
export const mermaidSpeed = () => 7 + (G.wave-MERMAID_WAVE)*0.6;

export const waveSpeed  = () => 11 + (G.wave-1)*1.5;
export const waveGap    = () => Math.max(1.05, 3.1 - (G.wave-1)*0.19);
export const raiderOdds = () => Math.min(0.52, 0.14 + (G.wave-1)*0.055);

/* ---------- the boss wave: every 5th wave, a Kraken looms in from the side.
   No ships or sharks spawn while it's up. A single aggression meter (0-100)
   is the whole fight: dark and it creeps in, lit and it backs off. Reach 100
   and its arm reaches the lighthouse — instant game over. Survive the clock
   and it flees. Every mermaid saved (lifetime, capped) fights alongside you,
   swimming out to shove its aggression down when it lands a hit. ---------- */
export const BOSS_EVERY   = 5;
export const BOSS_MAX_ALLIES = 5;
export const isBossWave  = w => w % BOSS_EVERY === 0;
export const bossCycle   = () => Math.max(1, Math.floor(G.wave / BOSS_EVERY));
export const bossAggroRate  = () => 6.5 + (bossCycle()-1)*0.9;   // %/sec, unlit
export const bossCalmRate   = () => 15 + (bossCycle()-1)*0.6;    // %/sec, lit
export const bossFightLen   = () => 42 + (bossCycle()-1)*6;      // seconds to survive

// kamikaze sharks: they don't hunt ships, they ram the lighthouse itself.
// Chasing one off means pulling the beam off the Kraken, so its aggression
// keeps climbing while you defend — the fight can't be won by parking the
// beam on the Kraken and ignoring everything else.
export const bossJawGap   = () => Math.max(3.2, 7.5 - (bossCycle()-1)*0.6);   // sec between spawns
export const bossJawSpeed = () => 24 + (bossCycle()-1)*2.5;

export function spawnBoss(){
  const side = Math.random()<0.5 ? -1 : 1;   // -1 left, 1 right
  const edgeX = side<0 ? -20 : W+20;
  G.boss = {
    side, homeX: edgeX, x: edgeX, y: CY - 20,
    aggro: 30, timer: bossFightLen(), fleeT: 0, hitT: 0, tentT: 0,
    lit: 0, wob: 0,
    allies: [],  // ally mermaids currently swimming out to help
    jaws: [], jawT: bossJawGap()   // kamikaze sharks gunning for the lighthouse
  };
  for(const s of G.ships) s.state='out';
  G.ships.length = 0; G.sharks.length = 0; G.mermaids.length = 0; G.supplies.length = 0;
}

// bring in up to BOSS_MAX_ALLIES mermaids (from the lifetime save count) to
// take turns swimming out from the lighthouse and shoving the Kraken back.
export function spawnAlly(){
  const b = G.boss; if(!b) return;
  const cap = Math.min(BOSS_MAX_ALLIES, G.mermaidsSaved);
  if(b.allies.length >= cap) return;
  b.allies.push({ x: LX, y: LY, phase:'out', t:0 });
}

export function bossHit(amount){
  const b = G.boss; if(!b) return;
  b.aggro = Math.max(0, b.aggro - amount);
  b.hitT = 0.25;
}

// a kamikaze shark: spawns at the edge and beelines straight for the
// lighthouse, ignoring ships and mermaids entirely (there are none during
// the fight). Catch it in the beam to drive it off; let it land and it
// rams the light, spiking the Kraken's aggression as the lamp reels.
export function spawnJawShark(){
  const edge = (Math.random()*4)|0;
  let x,y;
  if(edge===0){ x = Math.random()*W; y = -10; }
  else if(edge===1){ x = Math.random()*W; y = H+10; }
  else if(edge===2){ x = -10; y = 20 + Math.random()*(H-30); }
  else { x = W+10; y = 20 + Math.random()*(H-30); }
  G.boss.jaws.push({ x, y, a: sang(x,y,LX,LY), lit:0, spd: bossJawSpeed(), scared:0 });
  sfx.sharkNear();
}

export function endBossWave(won){
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

let idSeq = 0;

export function spawn(){
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

export function spawnShark(){
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

export function spawnMermaid(){
  if(G.mermaids.length >= 1) return;
  const edge = (Math.random()*4)|0;
  let x,y;
  if(edge===0){ x = Math.random()*W; y = -8; }
  else if(edge===1){ x = Math.random()*W; y = H+8; }
  else if(edge===2){ x = -8; y = 20 + Math.random()*(H-30); }
  else { x = W+8; y = 20 + Math.random()*(H-30); }
  G.mermaids.push({
    id: ++idSeq, x, y, a: sang(x,y,CX,CY), lit:0, spd: mermaidSpeed(),
    wob: Math.random()*6, safeT:0, wasInRange:false
  });
}

// a supply point drifts free until caught in the beam, then it's drawn in
// like a tractor beam and fills one slot of the Light Wave.
export function spawnSupply(x, y){
  if(G.supply >= SUPPLY_NEEDED) return;
  // pull the spawn point in to just inside the beam's reach so it can
  // never appear stranded beyond the lighthouse's range, unreachable forever.
  const d = sdist(LX,LY,x,y);
  const maxD = BEAM_LEN - 6;
  if(d > maxD){
    const a = sang(LX,LY,x,y);
    x = LX + Math.cos(a)*maxD / PA; y = LY + Math.sin(a)*maxD;
  }
  G.supplies.push({ x, y, a: Math.random()*Math.PI*2, drift: 4 + Math.random()*3 });
}

export function litBy(s){
  const d = sdist(LX,LY,s.x,s.y);
  if(d > BEAM_LEN || d < 6) return false;
  return Math.abs(angDiff(sang(LX,LY,s.x,s.y), G.beam)) < BEAM_HALF;
}

export function loseLantern(msg){
  G.lanterns--; G.streak = 0; G.flash = .32; G.shake = .5;
  if(msg){ G.msg = msg; G.msgT = 1.3; } else sfx.crash();
  if(G.lanterns <= 0){
    G.mode='over'; G.lock = .9; G.best = Math.max(G.best, G.score); sfx.over();
  }
}

export function cleared(){
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
export function triggerLightWave(){
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
function stepBoss(dt){
  const b = G.boss;
  b.wob += dt; b.timer -= dt;
  if(b.hitT>0) b.hitT -= dt;

  // it looms further in from its edge the higher its aggression climbs.
  // reach is floored so it never drags itself out past the beam's own
  // range — otherwise driving its aggression down also drags it out of
  // reach, and it just drifts back and forth at the edge of BEAM_LEN
  // instead of the fight ever resolving.
  const reach = Math.max(0.32, Math.min(1, b.aggro/100));
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

  // kamikaze sharks: they ignore the Kraken and go straight for the
  // lighthouse. Holding the beam on the Kraken forever means letting every
  // one of these through — the player has to break off and light them up,
  // which costs Kraken calming time and forces the fight to keep moving.
  b.jawT -= dt;
  if(b.jawT <= 0){ spawnJawShark(); b.jawT = bossJawGap() * (0.85 + Math.random()*0.3); }

  for(let i=b.jaws.length-1;i>=0;i--){
    const j = b.jaws[i];
    const lit = litBy(j);
    j.lit = lit ? Math.min(1, j.lit + dt*2.4) : Math.max(0, j.lit - dt*1.2);
    if(j.lit >= 0.6 && j.scared <= 0){ j.scared = 1.6; sfx.sharkAway(); }

    if(j.scared > 0){
      j.scared -= dt;
      const away = sang(LX,LY,j.x,j.y);
      j.a = turnToward(j.a, away, dt*3);
      const spd = j.spd * 1.6;
      j.x += Math.cos(j.a)*spd*dt / PA;
      j.y += Math.sin(j.a)*spd*dt;
      if(j.x < -16 || j.x > W+16 || j.y < -16 || j.y > H+16) b.jaws.splice(i,1);
      continue;
    }

    j.a = turnToward(j.a, sang(j.x,j.y,LX,LY), dt*2.4);
    j.x += Math.cos(j.a)*j.spd*dt / PA;
    j.y += Math.sin(j.a)*j.spd*dt;

    if(sdist(j.x,j.y,LX,LY) < 8){
      b.jaws.splice(i,1);
      b.aggro = Math.min(100, b.aggro + 14);
      G.flash = .3; G.shake = .5; sfx.bite();
      G.msg = 'SHARK HIT THE LIGHT'; G.msgT = 1.1;
      continue;
    }
  }

  if(b.timer <= 0){ endBossWave(true); return; }
}

export function step(dt){
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
          // cleared() may have just wiped G.ships to start a boss wave —
          // bail out of this loop immediately rather than read past its new end.
          if(G.bossIntroT > 0) break;
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
            // same as above: a boss-wave transition truncates G.ships mid-loop.
            if(G.bossIntroT > 0) break;
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
    // the instant she drifts into the lighthouse's reach, give the player a
    // beat to notice and react before a lurking shark can snatch her on the spot.
    const inRange = sdist(LX,LY,m.x,m.y) < BEAM_LEN;
    if(inRange && !m.wasInRange) m.safeT = Math.max(m.safeT, 0.5);
    m.wasInRange = inRange;
    let taken = false;
    // a mermaid can only be snatched where the light could actually have reached her —
    // otherwise the player never had a chance to save her.
    if(m.lit < 0.3 && m.safeT <= 0 && inRange){
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
    // a ship that has already turned to flee this frame is safe — the kill can't
    // land on a ship that's no longer inbound, even if the shark was already adjacent.
    const preyEscaped = prey && G.ships.includes(prey) && prey.state !== 'in';
    if(prey && !preyEscaped && sdist(sh.x,sh.y,prey.x,prey.y) < 6 && sdist(LX,LY,prey.x,prey.y) < BEAM_LEN){
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
