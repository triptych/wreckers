/* ---------- the shoal ---------- */
export const CX = 80, CY = 104;             // island centre, in pixels
export const LX = 80, LY = CY - 13;         // the lamp itself
export const BEAM_LEN = 118;                // screen units
export const BEAM_HALF = 0.20;              // radians
export const TURN_RATE = 2.05;              // radians / sec
export const CRASH_R = 15;                  // screen units

// 25 x 15 island, hand-set like a playfield graphic
export const ISLAND = [
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

/* ---------- state ---------- */
export const MAX_LANTERNS = 3;
export const SUPPLY_NEEDED = 4;

export const G = {
  mode:'title', t:0, beam:-Math.PI/2, ships:[], spawnT:1.2,
  score:0, best:0, lanterns:3, wave:1, cleared:0, streak:0,
  flash:0, shake:0, msg:'', msgT:0, lock:0, lureT:0, drift:0,
  sharks:[], sharkT:2.4, mermaids:[], mermaidT:6, sharkWarnT:0,
  supply:0, supplies:[], lightWaveT:0, lightWaveR:0,
  mermaidsSaved:0, boss:null, bossIntroT:0
};

export function reset(){
  G.mode='play'; G.ships.length=0; G.score=0; G.lanterns=MAX_LANTERNS; G.wave=1;
  G.cleared=0; G.streak=0; G.spawnT=1.4; G.beam=-Math.PI/2;
  G.flash=0; G.shake=0; G.msg='WAVE 1'; G.msgT=1.4;
  G.sharks.length=0; G.sharkT=2.4; G.mermaids.length=0; G.mermaidT=6; G.sharkWarnT=0;
  G.supply=0; G.supplies.length=0; G.lightWaveT=0; G.lightWaveR=0;
  G.mermaidsSaved=0; G.boss=null; G.bossIntroT=0;
}
