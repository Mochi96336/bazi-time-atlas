import { recurrenceState, validateGregorianDate } from "./gregorian-cycle.js";

/**
 * Event evidence over one *actual* Δ-years axis. No phase-distance drawing
 * masquerades as shared years: events are exact closure predicates computed
 * from the canonical day-count, including Gregorian leap rules.
 */
export function buildClosureJourney(baseDate,{maxYears=24000,detailYears=2400}={}){
  if(!validateGregorianDate(baseDate))throw new RangeError("invalid base date");
  if(!Number.isInteger(maxYears)||maxYears<24000||maxYears>24000)throw new RangeError("use the established 24,000-year comparison");
  if(!Number.isInteger(detailYears)||detailYears<1980||detailYears>maxYears)throw new RangeError("detail must include local recurrence");
  const events={gregorian:[],year:[],day:[],yearDay:[],gregorianYear:[],gregorianDay:[],all:[]};
  const overview={gregorian:[],gregorianYear:[],gregorianDay:[],all:[]};
  for(let delta=1;delta<=maxYears;delta++){
    const {closed,targetValid}=recurrenceState(baseDate,delta);
    const {gregorian:g,yearSequence:y,day:d}=closed;
    if(g)overview.gregorian.push(delta);
    if(g&&y)overview.gregorianYear.push(delta);
    if(g&&d)overview.gregorianDay.push(delta);
    if(g&&y&&d)overview.all.push(delta);
    if(delta<=detailYears){
      if(g)events.gregorian.push(delta);
      if(y)events.year.push(delta);
      if(d)events.day.push(delta);
      if(y&&d)events.yearDay.push(delta);
      if(g&&y)events.gregorianYear.push(delta);
      if(g&&d)events.gregorianDay.push(delta);
      if(g&&y&&d)events.all.push(delta);
    }
  }
  const firstLocal=events.yearDay[0]??null;
  const firstGlobal=overview.all[0]??null;
  const markers=[400,1200,1980,8000,24000].map(delta=>{
    const state=recurrenceState(baseDate,delta);
    return Object.freeze({
      delta,closed:Object.freeze({...state.closed}),
      dayAvailable:state.targetValid,
      dayDelta:state.dayDelta
    });
  });
  return Object.freeze({
    baseDate:Object.freeze({...baseDate}),
    maxYears,detailYears,
    detail:Object.freeze(Object.fromEntries(Object.entries(events).map(([key,v])=>[key,Object.freeze(v)]))),
    overview:Object.freeze(Object.fromEntries(Object.entries(overview).map(([key,v])=>[key,Object.freeze(v)]))),
    firstLocal,firstGlobal,markers:Object.freeze(markers)
  });
}

export function classifyJourneyPoint(journey,delta){
  if(!Number.isInteger(delta)||delta<0||delta>journey.maxYears)throw new RangeError("outside journey");
  const state=recurrenceState(journey.baseDate,delta);
  if(delta===0)return Object.freeze({kind:"identity",headline:"基準點 · 同一日期",detail:"Δ=0 是恆等比較，不是非零重遇。",state});
  if(!state.targetValid)return Object.freeze({kind:"unavailable",headline:"目標日期不存在",detail:"日序不能視為 0。",state});
  if(Object.values(state.closed).every(Boolean))
    return Object.freeze({kind:"all",headline:"三項離散條件同時歸零",detail:"這是離散重遇候選，節界仍需在 02 驗真。",state});
  if(state.closed.yearSequence&&state.closed.day)
    return Object.freeze({kind:"local",headline:"年序、日序重遇",detail:"但公曆結構尚未歸零；不是完整離散重遇。",state});
  if(state.closed.gregorian)
    return Object.freeze({kind:"gregorian",headline:"公曆結構已重遇",detail:"其他週期未必同時重遇。",state});
  return Object.freeze({kind:"partial",headline:"尚未三項同時重遇",detail:"沿時間軸觀察各條件何時重合。",state});
}
