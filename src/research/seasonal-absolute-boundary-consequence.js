import { solveSolarLongitude } from "../astronomy/direct-seasonal-event-provider.js";
import { FIVE_TIGERS_MONTH_BRANCHES } from "../calendar/five-tigers.js";
import {
  SEASONAL_DRIFT_26026_RESEARCH as DATA,
  indexForLongitude
} from "./seasonal-drift-26026-research-data.js";

export const ABSOLUTE_BOUNDARY_CYCLE_DAYS = 365.2425;
const LI_CHUN_LONGITUDE = 315;
const JIE_LONGITUDES = Object.freeze([315,345,15,45,75,105,135,165,195,225,255,285]);

function mod(value,divisor){
  return ((value%divisor)+divisor)%divisor;
}

function transitionAtLongitude(longitude){
  const offset=mod(longitude-LI_CHUN_LONGITUDE,360);
  const raw=offset/30;
  const index=Math.round(raw);
  if(Math.abs(raw-index)>1e-9) throw new RangeError("longitude is not a BaZi Jie boundary");
  const afterBranch=FIVE_TIGERS_MONTH_BRANCHES[index];
  const beforeBranch=FIVE_TIGERS_MONTH_BRANCHES[mod(index-1,FIVE_TIGERS_MONTH_BRANCHES.length)];
  return Object.freeze({beforeBranch,afterBranch,monthTransition:`${beforeBranch}→${afterBranch}`});
}

function baselineCatalogueYear(longitude){
  return longitude===285 ? DATA.baseYear+1 : DATA.baseYear;
}

function splitCircularInterval(start,width,cycle){
  const normalizedStart=mod(start,cycle);
  const normalizedEnd=normalizedStart+width;
  if(normalizedEnd<=cycle) return [{start:normalizedStart,end:normalizedEnd}];
  return [
    {start:normalizedStart,end:cycle},
    {start:0,end:normalizedEnd-cycle}
  ];
}

function mergeIntervals(intervals){
  const sorted=intervals
    .map(item=>({...item}))
    .sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged=[];
  for(const item of sorted){
    const prev=merged.at(-1);
    if(!prev||item.start>prev.end+1e-12){
      merged.push(item);
    }else{
      prev.end=Math.max(prev.end,item.end);
    }
  }
  return merged;
}

export function absoluteBoundaryConsequence24000(){
  const liChun=solveSolarLongitude({
    year:DATA.baseYear,
    longitudeDegrees:LI_CHUN_LONGITUDE
  });

  const boundaries=JIE_LONGITUDES.map(longitude=>{
    const base=solveSolarLongitude({
      year:baselineCatalogueYear(longitude),
      longitudeDegrees:longitude
    });
    const driftDays=DATA.driftDays[indexForLongitude(longitude)];
    const widthDays=Math.abs(driftDays);
    const basePhaseDay=mod(base.ttJulianDay-liChun.ttJulianDay,ABSOLUTE_BOUNDARY_CYCLE_DAYS);
    const targetPhaseUnwrapped=basePhaseDay+driftDays;
    const targetPhaseDay=mod(targetPhaseUnwrapped,ABSOLUTE_BOUNDARY_CYCLE_DAYS);
    const direction=driftDays<0?"target-earlier":driftDays>0?"target-later":"aligned";
    const intervalStart=direction==="target-earlier"
      ? basePhaseDay-widthDays
      : basePhaseDay;
    const pieces=splitCircularInterval(intervalStart,widthDays,ABSOLUTE_BOUNDARY_CYCLE_DAYS);
    const transition=transitionAtLongitude(longitude);
    const isYearBoundary=longitude===LI_CHUN_LONGITUDE;

    return Object.freeze({
      name:DATA.termNames[String(longitude)]??`λ ${longitude}°`,
      longitude,
      baselineProviderId:base.providerId,
      baselineTimeScale:base.timeScale,
      baselineTtJulianDay:base.ttJulianDay,
      basePhaseDay,
      targetPhaseDay,
      driftDays,
      widthDays,
      widthHours:widthDays*24,
      direction,
      ...transition,
      isYearBoundary,
      affectedPillars:Object.freeze(isYearBoundary?["year","month"]:["month"]),
      pieces:Object.freeze(pieces.map(piece=>Object.freeze(piece)))
    });
  });

  const pieces=boundaries.flatMap(boundary=>boundary.pieces);
  const merged=mergeIntervals(pieces);
  const rawWindowDays=boundaries.reduce((sum,boundary)=>sum+boundary.widthDays,0);
  const unionWindowDays=merged.reduce((sum,item)=>sum+(item.end-item.start),0);
  const overlapDays=Math.max(0,rawWindowDays-unionWindowDays);
  const largestBoundary=boundaries.reduce(
    (best,boundary)=>!best||boundary.widthDays>best.widthDays?boundary:best,
    null
  );
  const liChunBoundary=boundaries.find(boundary=>boundary.isYearBoundary)??null;
  const monthOnlyWindowDays=Math.max(0,unionWindowDays-(liChunBoundary?.widthDays??0));

  return Object.freeze({
    id:"year-26026-absolute-bazi-boundary-consequence",
    baseYear:DATA.baseYear,
    targetYear:DATA.targetYear,
    deltaYears:DATA.targetYear-DATA.baseYear,
    cycleDays:ABSOLUTE_BOUNDARY_CYCLE_DAYS,
    boundaries:Object.freeze(boundaries),
    mergedIntervals:Object.freeze(merged.map(item=>Object.freeze(item))),
    rawWindowDays,
    unionWindowDays,
    overlapDays,
    unionWindowPercent:unionWindowDays/ABSOLUTE_BOUNDARY_CYCLE_DAYS*100,
    monthOnlyWindowDays,
    monthOnlyWindowPercent:monthOnlyWindowDays/ABSOLUTE_BOUNDARY_CYCLE_DAYS*100,
    yearMonthWindowDays:liChunBoundary?.widthDays??0,
    yearMonthWindowPercent:(liChunBoundary?.widthDays??0)/ABSOLUTE_BOUNDARY_CYCLE_DAYS*100,
    minBoundaryDays:Math.min(...boundaries.map(boundary=>boundary.widthDays)),
    maxBoundaryDays:Math.max(...boundaries.map(boundary=>boundary.widthDays)),
    largestBoundary,
    liChunBoundary,
    allTargetEarlier:boundaries.every(boundary=>boundary.direction==="target-earlier"),
    claimBoundary:Object.freeze({
      researchOnly:true,
      geometry:"same-solar-longitude boundary displacement in uniform-TT/Gregorian-cycle comparison",
      populationProbability:false,
      civilTimeResolved:false,
      dayPillarResolved:false,
      hourPillarResolved:false,
      targetYearFrameIndependentlyValidated:false,
      productionAuthorityGranted:false
    })
  });
}

export const ABSOLUTE_BOUNDARY_CONSEQUENCE_24000=absoluteBoundaryConsequence24000();
