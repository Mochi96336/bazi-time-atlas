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
 return value==="gap"||value==="closure"||value==="missing"?value:"";
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

// P9: author an explanation *at the original moving marker*, not a fourth
// clock, status-gauge or free-floating progress bar. All coordinates are
// derived from the exact original signed-residue position.
const MISSING_NAMES=Object.freeze({gregorian:"公曆",year:"年序",day:"日序"});
const MISSING_UNITS=Object.freeze({gregorian:"年",year:"年",day:"日"});
export function r22MissingStudyCallout(key,layer,phase,closedCount,deltaYears){
 if(!R22_STUDY_KEYS.includes(key))throw new RangeError("unknown phase rail");
 if(!Number.isInteger(deltaYears)||deltaYears<0)throw new RangeError("invalid deltaYears");
 if(!layer?.available||layer.closed||closedCount===0||closedCount===3||deltaYears===0)return null;
 if(!Number.isInteger(phase)||phase<0||phase>=SCALES[key].modulus)throw new RangeError("invalid residue");
 const modulus=SCALES[key].modulus;
 // Day/year exact half-period is equally far both ways; the original gauge
 // deliberately locates it at the right edge, while the signed value is +30.
 const signed=phase>modulus/2?phase-modulus:phase;
 const angle=layer.angle,point=r22EllipsePoint(layer.radius,angle);
 const right= signed >= 0;
 // Space the layer labels vertically at partial closures, particularly at
 // +400 where both year and day remain open. Keep the label near its marker.
 const vertical={gregorian:69,year:88,day:103}[key];
 const x=Math.max(right?290:150,Math.min(right?1040:905,point.x+(right?-23:23)));
 const y=Math.max(555,Math.min(802,point.y+vertical));
 const text=MISSING_NAMES[key]+" "+(signed>0?"+":"−")+Math.abs(signed)+MISSING_UNITS[key];
 return Object.freeze({
  key,signed,angle,text,point,
  labelX:Number(x.toFixed(2)),labelY:Number(y.toFixed(2)),
  anchor:right?"end":"start"
 });
}
