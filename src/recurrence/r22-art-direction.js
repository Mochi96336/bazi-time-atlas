// R22 P10 — large-form art study. Each band is adjacent to its neighbour,
// with ZERO radial air gap; only material and seam separate the three periods.
// Phase, date, Δ and zero-angle geometry are deliberately unchanged.
export const R22_ART_BANDS=Object.freeze({
 // The first P10 screenshot used full 270..560 and became a bulky arch.
 // Keep three touching bands but reduce the entire body to 150 radial units.
 day:Object.freeze({inner:410,outer:460}),
 year:Object.freeze({inner:460,outer:510}),
 gregorian:Object.freeze({inner:510,outer:560})
});
export const R22_ART_MATERIALS=Object.freeze({
 graphite:Object.freeze({
  day:Object.freeze(["#77848d","#56636d","#35434c"]),
  year:Object.freeze(["#919a9e","#6a777e","#414e57"]),
  gregorian:Object.freeze(["#a6a9ab","#7e868c","#505b64"]),
  seam:"#172029",marker:"#e6ce9c"
 }),
 warm:Object.freeze({
  day:Object.freeze(["#8b8680","#6b6863","#464644"]),
  year:Object.freeze(["#a59a8e","#807970","#585450"]),
  gregorian:Object.freeze(["#b5a79a","#948a7f","#665f59"]),
  seam:"#25211f",marker:"#f0d3a5"
 })
});
// P10.1: both finishes SHARE a single world-space light field across all
// three touching bands. No new temporal state and no palette per layer.
export const R22_ART_FINISHES=Object.freeze({
 bevel:Object.freeze({
  axis:Object.freeze([245,505,1035,720]),
  colors:Object.freeze(["#354751","#687883","#a3aeb2","#657680","#303f4a"])
 }),
 satin:Object.freeze({
  axis:Object.freeze([165,545,1050,710]),
  colors:Object.freeze(["#44515a","#6a7983","#869398","#68757e","#424c54"])
 })
});
export function r22ArtFinish(value,art){
 return art==="graphite"&&Object.hasOwn(R22_ART_FINISHES,value)?value:"";
}
export function r22ArtMode(value){
 return Object.hasOwn(R22_ART_MATERIALS,value)?value:"";
}
export function r22ArtGeometry(){
 const bands=Object.entries(R22_ART_BANDS).map(([key,dimensions])=>
  Object.freeze({key,...dimensions}));
 for(let i=1;i<bands.length;i++){
  if(bands[i-1].outer!==bands[i].inner){
   throw new Error("P10 must be a contiguous layered semicircle, not three detached rails");
  }
 }
 return Object.freeze(bands);
}
