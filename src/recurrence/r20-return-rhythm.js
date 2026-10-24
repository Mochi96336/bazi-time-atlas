/** 
 * A diagram of intervals BETWEEN actual closure events, not a simulated phase.
 *
 * Δ=0 is only an identity/reference anchor. Every subsequent event must be
 * supplied by the exact, base-dependent recurrenceState-backed R18 model.
 * Arches join consecutive exact event years: they encode elapsed span only.
 */
export function buildReturnRhythm(journey){
 const source=[
  {key:"gregorianYear",label:"公曆＋年序",tone:"year"},
  {key:"yearDay",label:"年序＋日序",tone:"day"},
  {key:"gregorianDay",label:"公曆＋日序",tone:"day"},
  {key:"all",label:"三項共同",tone:"all"}
 ];
 const tracks=source.map(spec=>{
  const events=journey.overview[spec.key];
  if(!Array.isArray(events)||events.length===0)
   throw new RangeError("missing full-horizon events for "+spec.key);
  let previous=0;
  const spans=events.map(delta=>{
   if(!Number.isInteger(delta)||delta<=previous||delta>journey.maxYears)
    throw new RangeError("events must strictly increase on the same Δ-year axis");
   const span=Object.freeze({from:previous,to:delta,years:delta-previous});
   previous=delta;
   return span;
  });
  return Object.freeze({...spec,first:events[0],
   events:Object.freeze([...events]),spans:Object.freeze(spans)});
 });
 return Object.freeze({maxYears:journey.maxYears,
   firstLocal:journey.firstLocal,firstGlobal:journey.firstGlobal,
   tracks:Object.freeze(tracks)});
}
/**
 * The control point is only an editorial span envelope. It is deliberately
 * independent of calendar phases, seasonal astronomy or intermediate truth.
 */
export function returnArcPath(fromPx,toPx,baselineY){
 if(![fromPx,toPx,baselineY].every(Number.isFinite)||toPx<=fromPx)
  throw new RangeError("return arc requires increasing finite coordinates");
 const width=toPx-fromPx;
 const height=Math.min(38,Math.max(4,width*.48));
 const mid=(fromPx+toPx)/2;
 return "M "+fromPx.toFixed(2)+" "+baselineY.toFixed(2)+
  " Q "+mid.toFixed(2)+" "+(baselineY-2*height).toFixed(2)+
  " "+toPx.toFixed(2)+" "+baselineY.toFixed(2);
}
