import {gregorianOrdinal,isGregorianLeapYear} from "./gregorian-cycle.js";
import {gregorianDateFromOrdinal} from "./gregorian-date-navigation.js";
import {sexagenaryDayForGregorianDate} from "./ganzhi-cycle-comparison.js";
import {cycleItem} from "../sexagenary-data.js";

/** Pure date-only graphic geometry: NEVER silently re-anchor a Ganzhi Day
 * cycle on 1/1. The short head/tail fragments are intentional: only two
 * consecutive Jiazi ticks bound a complete 60-day turn.
 * The separate 365/366 full-year advance remains six turns +5/+6 days;
 * do not label the number of visible IN-YEAR complete spans as six.
 */
export function jiaziAnchoredCivilYear(year) {
  if (!Number.isSafeInteger(year)||year<1||year>10_000_000)
    throw new RangeError("invalid supported civil year");
  const days=isGregorianLeapYear(year)?366:365;
  const jan1={year,month:1,day:1};
  const jan1Ordinal=gregorianOrdinal(jan1);
  const jan1Pillar=sexagenaryDayForGregorianDate(jan1);
  const firstJiaziOffset=(60-jan1Pillar.index)%60;
  const ticks=[];
  for(let offset=firstJiaziOffset;offset<days;offset+=60){
    const date=gregorianDateFromOrdinal(jan1Ordinal+offset);
    const at=sexagenaryDayForGregorianDate(date);
    if(at.index!==0)throw Error("Jiazi tick drifted off canonical Day anchor");
    ticks.push(Object.freeze({
      offset, date,
      percent:(offset/(days-1))*100,
      pillar:at.name,
      ordinal:at.ordinal
    }));
  }
  const nextJan1=cycleItem(jan1Pillar.index+days);
  return Object.freeze({
    year,days,jan1Pillar,
    firstJiaziOffset,
    ticks:Object.freeze(ticks),
    completeInYearSpans:Math.max(0,ticks.length-1),
    headDays:firstJiaziOffset,
    tailDays:days-ticks.at(-1).offset,
    driftDays:days%60,
    nextJan1Pillar:Object.freeze({
      name:nextJan1.name,index:nextJan1.index,ordinal:nextJan1.ordinal
    })
  });
}
