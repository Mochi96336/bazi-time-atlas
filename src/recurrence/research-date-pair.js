import { validateGregorianDate } from "./gregorian-cycle.js";
import { differenceInGregorianDays } from "./gregorian-date-navigation.js";
import {
  nominalSexagenaryYearForGregorianDate,
  sexagenaryDayForGregorianDate
} from "./ganzhi-cycle-comparison.js";
import { sexagenaryYearPillarForLiChunYear } from "../calendar/sexagenary-year.js";

const mod60 = n => ((n % 60) + 60) % 60;

function frozenDate(date) {
  if (!validateGregorianDate(date)) throw new RangeError("invalid proleptic Gregorian date");
  return Object.freeze({ year:date.year, month:date.month, day:date.day });
}

function sameDate(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function candidateYearPillars(date) {
  return Object.freeze([
    sexagenaryYearPillarForLiChunYear(date.year - 1),
    sexagenaryYearPillarForLiChunYear(date.year)
  ]);
}

/**
 * Attach an independently evaluated Li Chun year result to a *specific* civil
 * date. No evidence means not-evaluated; unavailable evidence means unresolved.
 * Neither case is an inferred active year pillar. Nominal sequence is separate.
 *
 * Expects the existing researchYearStripState(date) contract. This pure adapter
 * does not import its runtime or claim that its seasonal source is authoritative.
 */
export function activeYearIdentityForDate(date, evidence = null) {
  const checked = frozenDate(date);
  if (evidence === null) {
    return Object.freeze({
      status:"not-evaluated",
      pillar:null,
      possiblePillars:null,
      side:null,
      reason:"seasonal-boundary-not-evaluated"
    });
  }
  if (!evidence || !evidence.selectedDate || !sameDate(checked,evidence.selectedDate)) {
    throw new RangeError("active-year evidence must belong to the selected Gregorian date");
  }
  const membership = evidence.selectedYearMembership;
  if (!membership || !["exact","model-estimated","unresolved"].includes(membership.status)) {
    throw new TypeError("invalid active-year membership contract");
  }

  const candidates = candidateYearPillars(checked);
  // Never treat an unknown seasonal event as a positive before/after decision.
  if (membership.status === "unresolved") {
    if (membership.pillar !== null || evidence.selectedYearPillar !== null) {
      throw new Error("unresolved year evidence must not contain an active pillar");
    }
    return Object.freeze({
      status:"unresolved",
      pillar:null,
      possiblePillars:candidates,
      side:null,
      reason:membership.reason ?? "seasonal-boundary-unresolved"
    });
  }

  if (!["before","after"].includes(membership.side)) {
    throw new Error("evaluated active year needs an explicit Li Chun side");
  }
  const candidate = membership.side === "before" ? candidates[0] : candidates[1];
  if (
    membership.pillar?.name !== candidate.name
    || membership.pillar?.cycleIndex !== candidate.cycleIndex
    || evidence.selectedYearPillar?.name !== candidate.name
    || evidence.selectedYearPillar?.cycleIndex !== candidate.cycleIndex
  ) {
    throw new Error("active year does not agree with the date's before/after Li Chun identity");
  }
  const transition = evidence.liChunTransition;
  if (transition && (
    transition.before?.name !== candidates[0].name ||
    transition.after?.name !== candidates[1].name
  )) throw new Error("seasonal transition identities conflict with the nominal year sequence");

  return Object.freeze({
    status:membership.status === "exact" ? "exact" : "model-estimated",
    pillar:candidate,
    possiblePillars:null,
    side:membership.side,
    reason:membership.reason ?? "upstream-year-membership"
  });
}

function datedIdentity(date, yearEvidence) {
  return Object.freeze({
    date,
    nominalYear:nominalSexagenaryYearForGregorianDate(date),
    activeYear:activeYearIdentityForDate(date, yearEvidence),
    day:sexagenaryDayForGregorianDate(date)
  });
}

/**
 * Compare any TWO existing civil dates in either chronological direction.
 * Day identities are anchored Gregorian date-only 60-day labels at local noon.
 * The year sequence is a nominal Gregorian-year-label progression, not the
 * actual year pillar across Li Chun. Active pillar requires per-date evidence.
 *
 * This comparison is always discrete only. Even if the pair coincidentally
 * shares month/day, astronomical shape and all-four-pillar recurrence MUST be
 * evaluated by their existing annual-recurrence authority, never inferred here.
 */
export function compareResearchDates(baseDate, targetDate, options = {}) {
  const base = frozenDate(baseDate);
  const target = frozenDate(targetDate);
  const elapsedDays = differenceInGregorianDays(base,target);
  const calendarYearDelta = target.year - base.year;
  const baseIdentity = datedIdentity(base,options.baseYearEvidence ?? null);
  const targetIdentity = datedIdentity(target,options.targetYearEvidence ?? null);
  const yearPhase = mod60(calendarYearDelta);
  const dayPhase = mod60(elapsedDays);
  if (
    mod60(targetIdentity.nominalYear.cycleIndex - baseIdentity.nominalYear.cycleIndex) !== yearPhase ||
    mod60(targetIdentity.day.index - baseIdentity.day.index) !== dayPhase
  ) throw new Error("absolute date identities diverge from the discrete year/day phases");

  const sameMonthDay = base.month === target.month && base.day === target.day;
  const annualRecurrenceEligible = sameMonthDay && calendarYearDelta >= 0;
  return Object.freeze({
    comparisonKind:"independent-civil-dates",
    base:baseIdentity,
    target:targetIdentity,
    yearSequence:Object.freeze({
      calendarYearDelta,
      phase:yearPhase,
      closed:yearPhase === 0,
      convention:"nominal-post-li-chun-gregorian-year-label"
    }),
    daySequence:Object.freeze({
      elapsedDays,
      direction:Math.sign(elapsedDays),
      phase:dayPhase,
      closed:dayPhase === 0,
      convention:"proleptic-gregorian-local-noon-discrete"
    }),
    closure:Object.freeze({
      nominalYearAndDay:yearPhase === 0 && dayPhase === 0,
      gregorianStructure:null,
      astronomicalShape:null,
      fourPillars:null
    }),
    applicability:Object.freeze({
      sameMonthDay,
      annualRecurrenceEligible,
      annualDeltaYears:annualRecurrenceEligible ? calendarYearDelta : null,
      astronomy:"not-evaluated",
      fourPillars:"not-evaluated"
    })
  });
}
