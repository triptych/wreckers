/* ---------- input: two directions, and nothing else ---------- */
export const held = { l:false, r:false };
export const ptr  = new Map();
export function input(){
  let d = 0;
  if(held.l || [...ptr.values()].includes(-1)) d -= 1;
  if(held.r || [...ptr.values()].includes( 1)) d += 1;
  return d;
}
