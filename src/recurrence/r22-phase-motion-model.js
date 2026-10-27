import {recurrenceState,findFirstLocalYearSequenceDayRecurrence,validateGregorianDate} from "./gregorian-cycle.js";
import {phaseAngleOnFan,signedShortestPhase} from "./phase-fan-geometry.js";

// Research 01 R22: read-only view model. It never owns or advances Δ.
// The 160-degree fan displays shortest signed residue; unwrapped turns
// belong to the mathematical timeline, not the fan marker's animation.
const SERIES=Object.freeze([
 Object.freeze({key:"gregorian",phaseKey:"gregorian",period:400,unit:"years"}),
 Object.freeze({key:"yearSequence",phaseKey:"yearSequence",period:60,unit:"years"}),
 Object.freeze({key:"day",phaseKey:"day",period:60,unit:"days"})
]);
const FACTS=Object.freeze({gregorianYearCycle:400,nominalYearSequenceCycle:60,dayCycle:60,
 gregorian400YearDays:146097,yearDayPeriod:24000});

function layer(spec,model){
 const phase=model.phases[spec.phaseKey];
 const amount=spec.key==="day"?model.dayDelta:model.deltaYears;
 const available=phase!==null && amount!==null;
 if(!available){
  return Object.freeze({key:spec.key,period:spec.period,unit:spec.unit,available:false,
   residue:null,signed:null,fanAngle:null,completedTurns:null,totalTurns:null,closed:false});
 }
 const signed=signedShortestPhase(phase,spec.period);
 return Object.freeze({key:spec.key,period:spec.period,unit:spec.unit,available:true,
  residue:phase,signed,fanAngle:phaseAngleOnFan({phase,modulus:spec.period}),
  completedTurns:Math.floor(amount/spec.period),totalTurns:amount/spec.period,
  closed:model.closed[spec.phaseKey]});
}

export function r22PhaseSnapshot(baseDate,deltaYears){
 const state=recurrenceState(baseDate,deltaYears);
 const layers=Object.freeze(Object.fromEntries(SERIES.map(spec=>[spec.key,layer(spec,state)])));
 const closedKeys=Object.freeze(SERIES.filter(spec=>layers[spec.key].closed).map(spec=>spec.key));
 return Object.freeze({
  baseDate:state.baseDate,targetDate:state.targetDate,targetValid:state.targetValid,
  deltaYears,elapsedDays:state.dayDelta,layers,
  closedKeys,closedCount:closedKeys.length,
  commonClosed:deltaYears>0&&closedKeys.length===3,
  zeroDatumAngle:-90,fanStart:-170,fanEnd:-10,
  displaySemantics:"folded-shortest-signed-residue-not-rotation",
  samplingSemantics:"exact-integer-year-states-only"
 });
}

export function r22PhaseTransition(baseDate,fromDelta,toDelta){
 if(!Number.isInteger(fromDelta)||!Number.isInteger(toDelta)||toDelta<fromDelta){
  throw new RangeError("R22 transition needs ascending nonnegative integer-year endpoints");
 }
 const from=r22PhaseSnapshot(baseDate,fromDelta);
 const to=r22PhaseSnapshot(baseDate,toDelta);
 const layers=Object.freeze(Object.fromEntries(SERIES.map(({key})=>{
  const a=from.layers[key],b=to.layers[key];
  const turnDifference=a.available&&b.available?b.totalTurns-a.totalTurns:null;
  const cycleBoundaryCount=a.available&&b.available?b.completedTurns-a.completedTurns:null;
  return [key,Object.freeze({
   fromSigned:a.signed,toSigned:b.signed,
   accumulatedTurns:turnDifference,completeCycleBoundaries:cycleBoundaryCount,
   // A frame update cannot reconstruct the missed 360° turns from the fan endpoints.
   motionInterpolationSafe:false,
   aliasesFullTurns:cycleBoundaryCount!==null&&cycleBoundaryCount>0
  })];
 })));
 return Object.freeze({fromDelta,toDelta,layers,
  interpolation:"sample-and-snap; no fabricated continuous phase motion"});
}

export function r22TeachingStops(baseDate,maxDeltaYears=24000){
 if(!validateGregorianDate(baseDate))throw new RangeError("invalid baseDate");
 if(!Number.isInteger(maxDeltaYears)||maxDeltaYears<0)throw new RangeError("maxDeltaYears must be nonnegative integer");
 const availableLimit=Math.min(maxDeltaYears,10000000-baseDate.year,24000);
 const local=availableLimit>=60
  ?findFirstLocalYearSequenceDayRecurrence(baseDate,{maxYears:availableLimit})?.deltaYears??null
  :null;
 const years=[0,400,1200,local,8000,24000].filter(n=>Number.isInteger(n)&&n<=availableLimit);
 return Object.freeze([...new Set(years)].sort((a,b)=>a-b).map(year=>{
  const p=r22PhaseSnapshot(baseDate,year);
  return Object.freeze({year,role:year===0?"identity":year===local?"base-dependent-year-day":
   year===24000?"global-discrete":year===1200?"gregorian-year-multiple":
   year===8000?"gregorian-day-multiple":"gregorian-cycle",
   closedKeys:p.closedKeys,closedCount:p.closedCount,
   signedGaps:Object.freeze(Object.fromEntries(SERIES.map(({key})=>[key,p.layers[key].signed]))),
   isPositiveCommonClosure:p.commonClosed});
 }));
}

export const R22_CYCLE_FACTS=FACTS;
