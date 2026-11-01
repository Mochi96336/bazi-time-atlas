// Two competing read-only information encodings over the SAME R22 semicircle.
// A: remaining signed-phase distance. B: which prerequisites already close.
// Never owns Δ and never fabricates elapsed rotations.
import {phaseAngleOnFan} from "./phase-fan-geometry.js";
import {R22_SEMICIRCLE,r22EllipsePoint} from "./r22-semicircle-geometry.js";
const SCALES=Object.freeze({
 gregorian:Object.freeze({modulus:400,radius:505}),
 year:Object.freeze({modulus:60,radius:405}),
 day:Object.freeze({modulus:60,radius:315})
});
export const R22_STUDY_KEYS=Object.freeze(["gregorian","year","day"]);
export function r22StudyMode(value){
 return value==="gap"||value==="closure"?value:"";
}
export function r22StudyReading(state){
 const layers=Object.freeze(Object.fromEntries(R22_STUDY_KEYS.map(key=>{
  const phase=state.phases[key==="year"?"yearSequence":key],spec=SCALES[key];
  const available=phase!==null&&phase!==undefined;
  const angle=available?phaseAngleOnFan({
   phase,modulus:spec.modulus,
   fanStart:R22_SEMICIRCLE.fanStart,fanEnd:R22_SEMICIRCLE.fanEnd,
   referenceAngle:R22_SEMICIRCLE.centerAngle
  }):null;
  return [key,Object.freeze({available,closed:available&&phase===0,angle,radius:spec.radius})];
 })));
 const closedCount=R22_STUDY_KEYS.filter(key=>layers[key].closed).length;
 return Object.freeze({layers,closedCount,identity:state.deltaYears===0});
}
function fmt(value){return Number(value.toFixed(3));}
export function r22StudyGapArc(layer){
 if(!layer.available||layer.closed)return null;
 const start=Math.min(-90,layer.angle),end=Math.max(-90,layer.angle);
 const a=r22EllipsePoint(layer.radius,start),b=r22EllipsePoint(layer.radius,end);
 return "M "+fmt(a.x)+" "+fmt(a.y)+" A "+layer.radius+" "+
  fmt(layer.radius*R22_SEMICIRCLE.verticalScale)+" 0 0 1 "+fmt(b.x)+" "+fmt(b.y);
}
