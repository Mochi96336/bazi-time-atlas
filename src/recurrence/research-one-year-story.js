import { gregorianOrdinal, isGregorianLeapYear, validateGregorianDate } from "./gregorian-cycle.js";

/**
 * One selected civil date, one Gregorian-year strip.
 * The Li Chun coordinate MUST be supplied by the existing seasonal evidence
 * source for exactly this year; no substitute "early February" positions.
 */
export function researchOneYearStory(date, evidence = null) {
  if (!validateGregorianDate(date)) throw new RangeError("invalid year-story selected date");
  if (evidence && (
    evidence.selectedDate?.year !== date.year ||
    evidence.selectedDate?.month !== date.month ||
    evidence.selectedDate?.day !== date.day
  )) throw new RangeError("year-story evidence belongs to another date");
  const leap = isGregorianLeapYear(date.year);
  const length = leap ? 366 : 365;
  const beginning = gregorianOrdinal({year:date.year,month:1,day:1});
  const selected = gregorianOrdinal(date) - beginning;
  const position = (selected / (length-1))*100;
  const event = evidence?.liChun ?? null;
  const hasEvent = event &&
    event.date?.year === date.year &&
    Number.isFinite(event.position) &&
    event.position >= 0 && event.position <= 100 &&
    ["estimated","resolved"].includes(event.positionStatus);
  const transition = evidence?.liChunTransition;
  const membership = evidence?.selectedYearMembership;
  return Object.freeze({
    selectedDate:Object.freeze({...date}),
    yearLength:length,
    dayPhaseAcrossCivilYear:length%60,
    selectedDayOrdinal:selected+1,
    selectedPosition:position,
    activeYear:Object.freeze({
      status:membership?.status ?? "not-evaluated",
      name:membership?.pillar?.name ?? null,
      side:membership?.side ?? null
    }),
    liChun: hasEvent ? Object.freeze({
      status:event.positionStatus,
      position:event.position,
      date:Object.freeze({...event.date}),
      label:event.label ?? null,
      before:transition?.before?.name ?? null,
      after:transition?.after?.name ?? null
    }) : null,
    liChunUnavailable: hasEvent ? null : (
      evidence?.liChunUnavailableMessage ?? "本年立春位置尚無可用天文證據"
    )
  });
}
