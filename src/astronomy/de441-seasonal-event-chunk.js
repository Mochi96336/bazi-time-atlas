const MAGIC = Object.freeze([0x42,0x54,0x41,0x44,0x45,0x34,0x34,0x31]); // BTADE441
const HEADER_BYTES = 32;
const SCHEMA_VERSION = 1;
const EVENTS_PER_YEAR = 24;
const LONGITUDE_STEP_DEGREES = 15;
const FLOAT64_BYTES = 8;
const ANGLE_EPSILON = 1e-12;
const ENCODING_ID = "bta-de441-seasonal-f64le-v1";

function assertInteger(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function asUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  throw new TypeError("bytes must be a Uint8Array or ArrayBuffer");
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

export function de441SeasonalCanonicalLongitudeIndex(longitudeDegrees) {
  if (!Number.isFinite(longitudeDegrees)) {
    throw new RangeError("longitudeDegrees must be finite");
  }
  const normalized = normalizeDegrees(longitudeDegrees);
  const index = Math.round(normalized / LONGITUDE_STEP_DEGREES) % EVENTS_PER_YEAR;
  const canonical = index * LONGITUDE_STEP_DEGREES;
  const wrappedError = Math.min(
    Math.abs(normalized - canonical),
    360 - Math.abs(normalized - canonical)
  );
  if (wrappedError > ANGLE_EPSILON) {
    throw new RangeError("longitudeDegrees must be one of the 24 canonical 15° crossings");
  }
  return index;
}

export function de441SeasonalChunkPayloadBytes(yearCount) {
  assertInteger(yearCount, "yearCount");
  if (yearCount < 1) throw new RangeError("yearCount must be positive");
  return yearCount * EVENTS_PER_YEAR * FLOAT64_BYTES;
}

export function de441SeasonalChunkByteLength(yearCount) {
  return HEADER_BYTES + de441SeasonalChunkPayloadBytes(yearCount);
}

export function canonicalEpochsFromSeasonalEvents(events) {
  if (!Array.isArray(events) || events.length !== EVENTS_PER_YEAR) {
    throw new RangeError(`expected ${EVENTS_PER_YEAR} seasonal events`);
  }
  const epochs = Array(EVENTS_PER_YEAR).fill(null);
  for (const event of events) {
    const index = de441SeasonalCanonicalLongitudeIndex(event?.longitudeDegrees);
    if (!Number.isFinite(event?.ttJulianDay)) {
      throw new TypeError(`missing finite TT epoch for longitude index ${index}`);
    }
    if (epochs[index] !== null) {
      throw new RangeError(`duplicate canonical longitude index ${index}`);
    }
    epochs[index] = event.ttJulianDay;
  }
  if (epochs.some(value => !Number.isFinite(value))) {
    throw new RangeError("seasonal-event set must contain every canonical longitude exactly once");
  }
  return Object.freeze(epochs);
}

function assertYearRows(minYear, years) {
  assertInteger(minYear, "minYear");
  if (!Array.isArray(years) || years.length < 1) {
    throw new RangeError("years must contain at least one catalogue-year row");
  }
  years.forEach((row, offset) => {
    const expectedYear = minYear + offset;
    if (!row || row.year !== expectedYear) {
      throw new RangeError(`year row ${offset} must be catalogue year ${expectedYear}`);
    }
    if (!Array.isArray(row.epochs) || row.epochs.length !== EVENTS_PER_YEAR) {
      throw new RangeError(`catalogue year ${expectedYear} must contain ${EVENTS_PER_YEAR} epochs`);
    }
    row.epochs.forEach((epoch, index) => {
      if (!Number.isFinite(epoch)) {
        throw new TypeError(`catalogue year ${expectedYear} longitude index ${index} lacks a finite TT epoch`);
      }
    });
  });
}

export function encodeDe441SeasonalEpochChunk({ minYear, years }) {
  assertYearRows(minYear, years);
  const yearCount = years.length;
  const payloadBytes = de441SeasonalChunkPayloadBytes(yearCount);
  const bytes = new Uint8Array(HEADER_BYTES + payloadBytes);
  const view = new DataView(bytes.buffer);

  MAGIC.forEach((value, index) => { bytes[index] = value; });
  view.setUint16(8, SCHEMA_VERSION, true);
  view.setUint16(10, EVENTS_PER_YEAR, true);
  view.setInt32(12, minYear, true);
  view.setUint32(16, yearCount, true);
  view.setUint16(20, LONGITUDE_STEP_DEGREES, true);
  view.setUint16(22, FLOAT64_BYTES, true);
  view.setUint32(24, HEADER_BYTES, true);
  view.setUint32(28, payloadBytes, true);

  let byteOffset = HEADER_BYTES;
  for (const row of years) {
    for (const epoch of row.epochs) {
      view.setFloat64(byteOffset, epoch, true);
      byteOffset += FLOAT64_BYTES;
    }
  }
  return bytes;
}

function validateHeader(bytes) {
  if (bytes.byteLength < HEADER_BYTES) throw new RangeError("seasonal chunk is shorter than its header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  MAGIC.forEach((value, index) => {
    if (bytes[index] !== value) throw new RangeError("seasonal chunk magic mismatch");
  });

  const schemaVersion = view.getUint16(8, true);
  const eventsPerYear = view.getUint16(10, true);
  const minYear = view.getInt32(12, true);
  const yearCount = view.getUint32(16, true);
  const longitudeStepDegrees = view.getUint16(20, true);
  const epochBytes = view.getUint16(22, true);
  const headerBytes = view.getUint32(24, true);
  const payloadBytes = view.getUint32(28, true);

  if (schemaVersion !== SCHEMA_VERSION) throw new RangeError("unsupported seasonal chunk schema version");
  if (eventsPerYear !== EVENTS_PER_YEAR) throw new RangeError("seasonal chunk events-per-year mismatch");
  if (longitudeStepDegrees !== LONGITUDE_STEP_DEGREES) throw new RangeError("seasonal chunk longitude-step mismatch");
  if (epochBytes !== FLOAT64_BYTES) throw new RangeError("seasonal chunk epoch width mismatch");
  if (headerBytes !== HEADER_BYTES) throw new RangeError("seasonal chunk header width mismatch");
  if (yearCount < 1) throw new RangeError("seasonal chunk must contain at least one year");
  if (payloadBytes !== de441SeasonalChunkPayloadBytes(yearCount)) {
    throw new RangeError("seasonal chunk payload length mismatch");
  }
  if (bytes.byteLength !== HEADER_BYTES + payloadBytes) {
    throw new RangeError("seasonal chunk total byte length mismatch");
  }

  return Object.freeze({
    schemaVersion,
    encoding:ENCODING_ID,
    eventsPerYear,
    minYear,
    maxYear:minYear + yearCount - 1,
    yearCount,
    longitudeStepDegrees,
    epochBytes,
    headerBytes,
    payloadBytes,
    byteLength:bytes.byteLength
  });
}

export function decodeDe441SeasonalEpochChunk(input) {
  const bytes = asUint8Array(input);
  const header = validateHeader(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  function ttJulianDayFor({ year, longitudeDegrees }) {
    assertInteger(year, "year");
    if (year < header.minYear || year > header.maxYear) {
      throw new RangeError(`year must be within chunk coverage ${header.minYear}..${header.maxYear}`);
    }
    const longitudeIndex = de441SeasonalCanonicalLongitudeIndex(longitudeDegrees);
    const yearOffset = year - header.minYear;
    const valueOffset = yearOffset * EVENTS_PER_YEAR + longitudeIndex;
    return view.getFloat64(HEADER_BYTES + valueOffset * FLOAT64_BYTES, true);
  }

  return Object.freeze({
    ...header,
    ttJulianDayFor
  });
}

export const DE441_SEASONAL_CHUNK_FORMAT = Object.freeze({
  id:ENCODING_ID,
  schemaVersion:SCHEMA_VERSION,
  headerBytes:HEADER_BYTES,
  eventsPerYear:EVENTS_PER_YEAR,
  longitudeStepDegrees:LONGITUDE_STEP_DEGREES,
  epochEncoding:"IEEE-754 Float64 little-endian",
  epochBytes:FLOAT64_BYTES,
  ordering:"catalogue-year-major then canonical longitude 0°,15°,...,345°",
  timeScale:"TT",
  yearBasis:"atlas-solar-term-catalogue"
});
