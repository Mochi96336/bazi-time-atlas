import { cycleItem } from "../sexagenary-data.js";

export const SEXAGENARY_YEAR_ANCHOR = Object.freeze({
  gregorianYear: 1984,
  pillar: "甲子",
  convention: "year-label-after-li-chun"
});

function assertYearLabel(year) {
  if (!Number.isInteger(year)) throw new RangeError("year label must be an integer");
}

/**
 * Return the sexagenary year pillar attached to one Gregorian year label AFTER
 * that year's Li Chun boundary. 1984 Li Chun starts 甲子, so modular extension
 * is deterministic in either direction and can be used outside Tyme's finite
 * civil-calendar range.
 *
 * This helper does not decide whether an instant is before/after Li Chun; the
 * caller must supply the correct active year label for the side being modeled.
 */
export function sexagenaryYearPillarForLiChunYear(year) {
  assertYearLabel(year);
  const item = cycleItem(year - SEXAGENARY_YEAR_ANCHOR.gregorianYear);
  return Object.freeze({
    year,
    name: item.name,
    stem: item.stem.name,
    branch: item.branch.name,
    cycleIndex: item.index
  });
}
