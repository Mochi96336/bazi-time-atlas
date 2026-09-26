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
  // The long strip always measures the real civil year. Only when the selected
  // date is within 12 days of a sourced Li Chun event do we additionally draw
  // a *separately labeled* ±14-day local zoom. The selected CIVIL DAY occupies
  // a full 24-hour band; it is not silently treated as a chosen time of day.
  const offsetFromLiChunDays = hasEvent
    ? (position - event.position) * (length - 1) / 100
    : null;
  const boundaryZoom = offsetFromLiChunDays !== null &&
    Math.abs(offsetFromLiChunDays) <= 12
    ? Object.freeze({
        selectedDayStartPercent:50 + offsetFromLiChunDays * 100 / 28,
        selectedDayWidthPercent:100 / 28,
        eventPercent:50,
        selectedDayContainsEvent:
          offsetFromLiChunDays <= 0 && offsetFromLiChunDays + 1 >= 0
      })
    : null;
  return Object.freeze({
    selectedDate:Object.freeze({...date}),
    yearLength:length,
    dayPhaseAcrossCivilYear:length%60,
    selectedDayOrdinal:selected+1,
    selectedPosition:position,
    boundaryZoom,
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
