/* ---------------------------------------------------------------
   Shared DOM/canvas handles. Every other module imports the
   canvas 2d context from here rather than re-querying the DOM.
----------------------------------------------------------------*/
export const cv  = document.getElementById('c');
export const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

export const housing = document.getElementById('housing');
export const kl = document.getElementById('kl');
export const kr = document.getElementById('kr');
export const kf = document.getElementById('kf');
