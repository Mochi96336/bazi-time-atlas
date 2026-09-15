export const DAY_HOUR_TIME_BASIS = Object.freeze({
  CIVIL:"civil",
  LOCAL_MEAN_SOLAR:"local-mean-solar",
  LOCAL_APPARENT_SOLAR:"local-apparent-solar"
});

export const DAY_HOUR_TIME_BASIS_VALUES = Object.freeze(Object.values(DAY_HOUR_TIME_BASIS));

export function isDayHourTimeBasis(value) {
  return DAY_HOUR_TIME_BASIS_VALUES.includes(value);
}
