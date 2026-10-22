import { recurrenceState, validateGregorianDate } from "./gregorian-cycle.js";

/**
 * Event evidence over one *actual* Δ-years axis. No phase-distance drawing
 * masquerades as shared years: events are exact closure predicates computed
 * from the canonical day-count, including Gregorian leap rules.
 */
export function buildClosureJourney(baseDate,{maxYears=24000,detailYears=2400}={}){
  if(!validateGregorianDate(baseDate))throw new RangeError("invalid base date");
  if(maxYears!==24000)throw new RangeError("use the established 24,000-year comparison");
  if(!Number.isInteger(detailYears)||detailYears<600||detailYears>maxYears)throw new RangeError("invalid local detail window");
  if(baseDate.year+maxYears>10000000)throw new RangeError("target year exceeds Gregorian model");

  // Search the FULL horizon first. An earliest local recurrence is a property
  // of this base date, not a property of a fixed 0–2,400 year inset.
  const allEvents={gregorian:[],year:[],day:[],yearDay:[],gregorianYear:[],gregorianDay:[],all:[]};
  for(let delta=1;delta<=maxYears;delta++){
    const {closed}=recurrenceState(baseDate,delta);
    const {gregorian:g,yearSequence:y,day:d}=closed;
    if(g)allEvents.gregorian.push(delta);
    if(y)allEvents.year.push(delta);
    if(d)allEvents.day.push(delta);
    if(y&&d)allEvents.yearDay.push(delta);
    if(g&&y)allEvents.gregorianYear.push(delta);
    if(g&&d)allEvents.gregorianDay.push(delta);
    if(g&&y&&d)allEvents.all.push(delta);
  }
  const firstLocal=allEvents.yearDay[0]??null;
  const firstGlobal=allEvents.all[0]??null;
  const detailStart=firstLocal===null||firstLocal<=detailYears?0
    :Math.min(maxYears-detailYears,
      Math.max(0,Math.floor((firstLocal-detailYears*0.65)/60)*60));
  const detailEnd=detailStart+detailYears;
  const detail=Object.freeze(Object.fromEntries(Object.entries(allEvents)
    .map(([key,years])=>[key,Object.freeze(years.filter(d=>d>=detailStart&&d<=detailEnd))])));
  const overview=Object.freeze(Object.fromEntries(
    ["gregorian","gregorianYear","gregorianDay","all"].map(key=>[key,Object.freeze(allEvents[key])])
  ));
  const markers=[400,1200,firstLocal,8000,24000].filter((d,i,a)=>d!==null&&a.indexOf(d)===i)
    .sort((a,b)=>a-b).map(delta=>{
      const state=recurrenceState(baseDate,delta);
      return Object.freeze({
        delta,closed:Object.freeze({...state.closed}),
        dayAvailable:state.targetValid,dayDelta:state.dayDelta
      });
    });
  return Object.freeze({
    baseDate:Object.freeze({...baseDate}),maxYears,detailYears,detailStart,detailEnd,
    detail,overview,firstLocal,firstGlobal,markers:Object.freeze(markers)
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
