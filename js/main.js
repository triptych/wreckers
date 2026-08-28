import { cv, housing, kl, kr, kf } from './dom.js';
import { audio } from './audio.js';
import { G, reset, SUPPLY_NEEDED } from './state.js';
import { step, triggerLightWave } from './entities.js';
import { render } from './draw.js';
import { held, ptr } from './input.js';

function fire(){
  audio();
  if(G.mode === 'title'){ reset(); }
  else if(G.mode === 'over' && G.lock <= 0){ reset(); }
  else if(G.mode === 'play'){ triggerLightWave(); }
}

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
