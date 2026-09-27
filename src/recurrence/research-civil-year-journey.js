import { gregorianOrdinal, isGregorianLeapYear, validateGregorianDate } from "./gregorian-cycle.js";
import { shiftGregorianDate } from "./gregorian-date-navigation.js";
import { sexagenaryDayForGregorianDate } from "./ganzhi-cycle-comparison.js";
import { activeYearIdentityForDate } from "./research-date-pair.js";
import { researchOneYearStory } from "./research-one-year-story.js";

function freezeDate(date) {
  return Object.freeze({year:date.year,month:date.month,day:date.day});
}

/**
 * A guided journey uses exactly one committed civil date at a time. This pure
 * model lists the milestone dates; the existing free-date controller remains
 * the sole owner that can commit one of them and update the permalink.
 *
 * Every active YEAR at a milestone needs evidence for that specific date.
 * The Li Chun *date* must come from supported seasonal evidence for this year.
 * A date-only stop ON Li Chun may keep two candidates; it is NOT an instant.
 * No evidence => no guessed boundary stop/line or guessed actual Year.
 */
export function researchCivilYearJourney(date, {
  boundaryEvidence=null,
  yearEvidenceForDate=null
}={}) {
  if (!validateGregorianDate(date)) throw new RangeError("invalid civil year journey date");
  if (yearEvidenceForDate!==null && typeof yearEvidenceForDate!=="function") {
    throw new TypeError("yearEvidenceForDate must be a function or null");
  }
  const year=date.year;
  const days=isGregorianLeapYear(year)?366:365;
  const start=freezeDate({year,month:1,day:1});
  const next=year<10_000_000 ? freezeDate({year:year+1,month:1,day:1}) : null;
  const turns=Math.floor(days/60);
  const remainder=days%60;

  // The finite supported date domain must fail visibly BEFORE fetching next
  // year seasonal evidence or changing the user's committed date.
  if (!next) return Object.freeze({
    available:false,year,yearLength:days,turns,remainder,
    reason:"next-civil-year-out-of-range",milestones:Object.freeze([])
  });

  let boundary=null;
  if (boundaryEvidence!==null) {
    const sourceDate=boundaryEvidence?.selectedDate;
    if (!sourceDate || !validateGregorianDate(sourceDate) || sourceDate.year!==year) {
      throw new RangeError("Li Chun evidence must belong to selected civil year");
    }
    boundary=researchOneYearStory(sourceDate,boundaryEvidence).liChun;
  }

  const initialOrdinal=gregorianOrdinal(start);
  const stage=(id,chosen)=> {
    const elapsed=gregorianOrdinal(chosen)-initialOrdinal;
    const yearEvidence=yearEvidenceForDate?.(chosen) ?? null;
    const yearIdentity=activeYearIdentityForDate(chosen,yearEvidence);
    const dayIdentity=sexagenaryDayForGregorianDate(chosen);
    return Object.freeze({
      id,date:freezeDate(chosen),elapsedDays:elapsed,
      completedTurns:Math.floor(elapsed/60),
      partialDays:elapsed%60,
      day:dayIdentity,
      activeYear:yearIdentity
    });
  };
  const stages=[stage("start",start)];
  if (boundary) {
    const atBoundary=boundary.date;
    if (gregorianOrdinal(atBoundary)>initialOrdinal) {
      stages.push(stage("li-chun-date",atBoundary));
    }
    const following=shiftGregorianDate(atBoundary,1);
    if (following.year===year) stages.push(stage("after-li-chun",following));
  }
  // Exactly six meaningful checkpoints: one click may show one completed
  // Day circuit (60 days), not sixty clicks. Skipping to the end stays optional.
  for(let turn=1;turn<=turns;turn++){
    const finish=shiftGregorianDate(start,turn*60);
    const finishOrdinal=gregorianOrdinal(finish);
    if(stages.some(item=>gregorianOrdinal(item.date)===finishOrdinal))continue;
    stages.push(stage("turn-"+turn,finish));
  }
  stages.sort((a,b)=>a.elapsedDays-b.elapsedDays);
  stages.push(stage("next-jan-1",next));
  const startDay=stages[0].day, endDay=stages.at(-1).day;
  if (((endDay.index-startDay.index+60)%60)!==remainder) {
    throw new Error("canonical continuous Day identities do not match civil-year elapsed days");
  }
  return Object.freeze({
    available:true,year,yearLength:days,turns,remainder,
    boundary:boundary ? Object.freeze({
      date:freezeDate(boundary.date),
      status:boundary.status,
      position:boundary.position
    }) : null,
    startDay,endDay,
    milestones:Object.freeze(stages)
  });
}
