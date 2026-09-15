const MIN_LONGITUDE_DEGREES_EAST = -180;
const MAX_LONGITUDE_DEGREES_EAST = 180;

function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function normalizeDegreesEast(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError("longitudeDegreesEast must be finite");
  }
  if (value < MIN_LONGITUDE_DEGREES_EAST || value > MAX_LONGITUDE_DEGREES_EAST) {
    throw new RangeError(
      `longitudeDegreesEast must be between ${MIN_LONGITUDE_DEGREES_EAST} and +${MAX_LONGITUDE_DEGREES_EAST}`
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function binding(fields) {
  return Object.freeze({
    bound:false,
    longitudeDegreesEast:null,
    signConvention:"east-positive-degrees-from-greenwich",
    ...fields
  });
}

export const UNBOUND_LONGITUDE_BINDING = binding({});

/**
 * Normalize the geographic longitude required by local mean/apparent solar
 * clock conventions. Positive values are east of Greenwich; negative values
 * are west. A boolean cannot satisfy this contract because downstream solar
 * time needs the actual angle, not merely a claim that one exists.
 */
export function longitudeBinding(spec = null) {
  if (spec === null || spec === undefined) return UNBOUND_LONGITUDE_BINDING;
  assertObject(spec, "longitude");
  return binding({
    bound:true,
    longitudeDegreesEast:normalizeDegreesEast(spec.longitudeDegreesEast)
  });
}

export const LONGITUDE_BINDING_CONTRACT = Object.freeze({
  id:"recurrence-longitude-binding-v1",
  field:"longitudeDegreesEast",
  rangeDegrees:Object.freeze([MIN_LONGITUDE_DEGREES_EAST, MAX_LONGITUDE_DEGREES_EAST]),
  signConvention:"east-positive-degrees-from-greenwich",
  rejectsBooleanPresenceClaims:true
});
