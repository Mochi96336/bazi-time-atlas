export const DAY_BOUNDARY = Object.freeze({
  ZI_INITIAL_NEXT_DAY:"zi-initial-next-day",
  CIVIL_MIDNIGHT:"civil-midnight"
});

export const DAY_BOUNDARY_VALUES = Object.freeze(Object.values(DAY_BOUNDARY));

export function isDayBoundary(value) {
  return DAY_BOUNDARY_VALUES.includes(value);
}
