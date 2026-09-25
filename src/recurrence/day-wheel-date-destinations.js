import { sexagenaryDayForGregorianDate } from "./ganzhi-cycle-comparison.js";
import { shiftGregorianDate } from "./gregorian-date-navigation.js";
import { cycleItem } from "../sexagenary-data.js";

// A Ganzhi name identifies infinitely many dates. Never invent one "selected"
// date: resolve the strictly previous and strictly next occurrence RELATIVE to
// the current committed comparison date. Same-name selection means +/-60 days,
// not the current day, because these actions are explicitly prior/next.
function mod60(value) {
  return ((value % 60) + 60) % 60;
}

function existingDestination(date, offset) {
  try {
    return shiftGregorianDate(date,offset);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return null;
  }
}

export function dayWheelDateDestinations(date, selectionIndex) {
  if (!Number.isInteger(selectionIndex) || selectionIndex < 0 || selectionIndex >= 60) {
    throw new RangeError("Day wheel selection must be one canonical 0..59 index");
  }
  const current = sexagenaryDayForGregorianDate(date);
  const selected = cycleItem(selectionIndex);
  const forward = mod60(selected.index - current.index);
  const nextDays = forward === 0 ? 60 : forward;
  const previousDays = nextDays - 60;
  const before = Object.freeze({
    offsetDays:previousDays,
    date:existingDestination(date,previousDays)
  });
  const after = Object.freeze({
    offsetDays:nextDays,
    date:existingDestination(date,nextDays)
  });
  return Object.freeze({
    selectedIndex:selected.index,
    selectedName:selected.name,
    currentIndex:current.index,
    currentName:current.name,
    sameAsCurrent:selected.index === current.index,
    previous:before,
    next:after
  });
}
