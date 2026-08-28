import { ctx } from './dom.js';
import { C } from './palette.js';
import { drawText, drawTextC } from './font.js';
import { W, H, PA, sdist } from './geometry.js';
import { G, CX, CY, LX, LY, BEAM_LEN, BEAM_HALF, ISLAND, SUPPLY_NEEDED } from './state.js';

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

// a kamikaze shark: red-finned and faster-looking than the regular hunters,
// so it reads as a threat to the lighthouse rather than to a ship.
function drawJawShark(j){
  const px = Math.round(j.x), py = Math.round(j.y);
  const facingR = Math.cos(j.a) > 0;
  const lit = j.lit > 0.25;
  ctx.fillStyle = C.wave;
  ctx.fillRect(px - Math.round(Math.cos(j.a)*4), py - Math.round(Math.sin(j.a)*4), 1, 1);
  ctx.fillRect(px - Math.round(Math.cos(j.a)*2), py - Math.round(Math.sin(j.a)*2), 1, 1);
  ctx.fillStyle = lit ? '#8a99a2' : C.raiderLo;
  ctx.fillRect(px-3, py, 6, 1);                          // body
  ctx.fillStyle = lit ? C.sharkLo : C.raider;
  ctx.fillRect(px-3, py+1, 6, 1);                        // belly
  ctx.fillStyle = lit ? C.fin : C.raider;
  ctx.fillRect(px, py-2, 1, 2);                          // dorsal fin
  ctx.fillStyle = lit ? '#8a99a2' : C.raiderLo;
  ctx.fillRect(px + (facingR? 3:-4), py, 1, 1);          // nose
  if(j.scared > 0 && (G.t*16|0)%2){
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

export function render(){
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
  if(G.boss) for(const j of G.boss.jaws) drawJawShark(j);
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
    drawTextC('WAVE 5 - HOLD THE LIGHT, DODGE SHARKS', 177, C.krakenHi, 1);
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
