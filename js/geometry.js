/* ---------------------------------------------------------------
   WRECKERS!  —  160x192, the 2600's real playfield resolution.
   Pixels are stretched 1.6:1 like NTSC, so all geometry is done in
   "screen units" (x scaled by PA) while drawing stays in pixels.
----------------------------------------------------------------*/
export const W = 160, H = 192, PA = 1.6;

/* ---------- geometry in stretched space ---------- */
export const sdist = (x1,y1,x2,y2) => Math.hypot((x2-x1)*PA, y2-y1);
export const sang  = (x1,y1,x2,y2) => Math.atan2(y2-y1, (x2-x1)*PA);
export function angDiff(a,b){ let d=(a-b)%(Math.PI*2); if(d> Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return d; }
export function turnToward(cur, tgt, step){
  const d = angDiff(tgt, cur);
  return cur + Math.max(-step, Math.min(step, d));
}
