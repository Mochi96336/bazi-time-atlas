const MIN_LONGITUDE_DEGREES = -180;
const MAX_LONGITUDE_DEGREES = 180;

function base(fields = {}) {
  return Object.freeze({
    bound:false,
    longitudeDegrees:null,
    signConvention:"east-positive",
    ...fields
  });
}

export const UNBOUND_GEOGRAPHIC_LONGITUDE = base();

/**
 * Normalize one explicitly supplied geographic longitude for Day/Hour solar
 * clock calculations. East longitude is positive and west is negative,
 * matching the existing local mean/apparent solar-time engine.
 */
export function geographicLongitudeBinding(value = null) {
  if (value === null || value === undefined) return UNBOUND_GEOGRAPHIC_LONGITUDE;
  if (!Number.isFinite(value)) {
    throw new RangeError("longitudeDegrees must be finite");
  }
  if (value < MIN_LONGITUDE_DEGREES || value > MAX_LONGITUDE_DEGREES) {
    throw new RangeError(
      `longitudeDegrees must be between ${MIN_LONGITUDE_DEGREES} and +${MAX_LONGITUDE_DEGREES}`
    );
  }
  return base({
    bound:true,
    longitudeDegrees:Object.is(value, -0) ? 0 : value
  });
}

export const GEOGRAPHIC_LONGITUDE_CONTRACT = Object.freeze({
  id:"recurrence-geographic-longitude-v1",
  unit:"degree",
  signConvention:"east-positive",
  minDegrees:MIN_LONGITUDE_DEGREES,
  maxDegrees:MAX_LONGITUDE_DEGREES,
  zeroLongitudeValid:true
});
