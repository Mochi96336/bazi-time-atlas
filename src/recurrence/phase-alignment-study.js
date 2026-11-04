import { recurrenceState } from "./gregorian-cycle.js";
import { signedShortestPhase } from "./phase-fan-geometry.js";

// This is a reading-comprehension experiment, NOT a new calendar model.
// The source fan and its dates always come from the production recurrence model.
export const READING_STUDY_BASE = Object.freeze({year:2026,month:9,day:13});
export const READING_STUDY_DELTAS = Object.freeze([400,1200,8000,24000]);
export const READING_STUDY_OPTIONS = Object.freeze([
  Object.freeze({id:"gregorian",label:"只有公曆結構"}),
  Object.freeze({id:"gregorian-year",label:"公曆結構＋60 年序"}),
  Object.freeze({id:"gregorian-day",label:"公曆結構＋60 日序"}),
  Object.freeze({id:"all",label:"三圈全部對齊"}),
  Object.freeze({id:"unsure",label:"無法從圖中判斷"})
]);

export function alignmentReadingState(deltaYears) {
  if(!READING_STUDY_DELTAS.includes(deltaYears)){
    throw new RangeError("unknown experimental phase case: "+deltaYears);
  }
  const state=recurrenceState(READING_STUDY_BASE,deltaYears);
  if(!state.targetValid)throw new Error("experimental target date unavailable");
  const closed=Object.freeze({
    gregorian:state.closed.gregorian,
    year:state.closed.yearSequence,
    day:state.closed.day
  });
  const signed=Object.freeze({
    gregorian:signedShortestPhase(state.phases.gregorian,400),
    year:signedShortestPhase(state.phases.yearSequence,60),
    day:signedShortestPhase(state.phases.day,60)
  });
  const key=["gregorian","year","day"].filter(k=>closed[k]).join("-");
  const answer=key==="gregorian-year-day"?"all":key;
  if(!READING_STUDY_OPTIONS.some(option=>option.id===answer&&answer!=="unsure")){
    throw new Error("study case has no single unambiguous option");
  }
  return Object.freeze({deltaYears,closed,signed,answer});
}

export function evaluateAlignmentReading(responses){
  if(!Array.isArray(responses))throw new TypeError("responses must be an array");
  const ids=new Set();
  return Object.freeze(responses.map(response=>{
    const deltaYears=response.deltaYears;
    if(ids.has(deltaYears))throw new Error("duplicate study case");
    ids.add(deltaYears);
    const state=alignmentReadingState(deltaYears);
    if(!READING_STUDY_OPTIONS.some(o=>o.id===response.choice))throw new Error("unknown choice");
    if(!["high","medium","low"].includes(response.confidence))throw new Error("invalid confidence");
    if(!Number.isFinite(response.elapsedMs)||response.elapsedMs<0)throw new Error("invalid response time");
    return Object.freeze({
      deltaYears,choice:response.choice,confidence:response.confidence,
      elapsedMs:Math.round(response.elapsedMs),answer:state.answer,
      correct:response.choice===state.answer,
      signed:state.signed,closed:state.closed
    });
  }));
}

export function shuffledStudyDeltas(rng=Math.random){
  const choices=[...READING_STUDY_DELTAS];
  for(let i=choices.length-1;i>0;i--){
    const n=rng();
    if(!Number.isFinite(n)||n<0||n>=1)throw new RangeError("rng must yield [0,1)");
    const j=Math.floor(n*(i+1));
    [choices[i],choices[j]]=[choices[j],choices[i]];
  }
  return choices;
}
