import { MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS } from "./absolute-state-seasonal-solver.js";
import { FRAME_KNOT_DATA_0 } from "./horizons-ecliptic-frame-catalogue-data-0.js";
import { FRAME_KNOT_DATA_1 } from "./horizons-ecliptic-frame-catalogue-data-1.js";
import { FRAME_KNOT_DATA_2 } from "./horizons-ecliptic-frame-catalogue-data-2.js";
import { FRAME_KNOT_DATA_3 } from "./horizons-ecliptic-frame-catalogue-data-3.js";
import { FRAME_KNOT_DATA_4 } from "./horizons-ecliptic-frame-catalogue-data-4.js";

const START_TT_JD = 3184190.5;
const END_TT_JD = 3184586.5;
const STEP_DAYS = 1;
const COMPONENTS_PER_QUATERNION = 4;
const KNOT_COUNT = 397;
const KNOT_BYTES_BASE64 = FRAME_KNOT_DATA_0 + FRAME_KNOT_DATA_1 + FRAME_KNOT_DATA_2 + FRAME_KNOT_DATA_3 + FRAME_KNOT_DATA_4;

function decodeFloat64LittleEndian(base64) {
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  if (bytes.byteLength !== KNOT_COUNT * COMPONENTS_PER_QUATERNION * 8) {
    throw new RangeError(`unexpected catalogue frame byte length ${bytes.byteLength}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Object.freeze(Array.from(
    { length:KNOT_COUNT * COMPONENTS_PER_QUATERNION },
    (_, index) => view.getFloat64(index * 8, true)
  ));
}

const KNOT_QUATERNIONS = decodeFloat64LittleEndian(KNOT_BYTES_BASE64);

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function assertVector(name, value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some(item => !Number.isFinite(item))) {
    throw new TypeError(`${name} must be a finite 3-vector`);
  }
}

function knotQuaternion(index) {
  const offset = index * COMPONENTS_PER_QUATERNION;
  return [
    KNOT_QUATERNIONS[offset],
    KNOT_QUATERNIONS[offset + 1],
    KNOT_QUATERNIONS[offset + 2],
    KNOT_QUATERNIONS[offset + 3]
  ];
}

function normalizeQuaternion(quaternion) {
  const magnitude = Math.hypot(...quaternion);
  if (!(magnitude > 0) || !Number.isFinite(magnitude)) {
    throw new RangeError("quaternion must have finite non-zero magnitude");
  }
  return quaternion.map(value => value / magnitude);
}

function slerpQuaternion(start, end, fraction) {
  let target = end.slice();
  let cosine = start[0] * target[0] + start[1] * target[1]
    + start[2] * target[2] + start[3] * target[3];
  if (cosine < 0) {
    target = target.map(value => -value);
    cosine = -cosine;
  }
  cosine = Math.min(1, Math.max(-1, cosine));
  if (cosine > 0.9999995) {
    return normalizeQuaternion(start.map((value, index) =>
      value + fraction * (target[index] - value)
    ));
  }
  const angle = Math.acos(cosine);
  const sinAngle = Math.sin(angle);
  const startWeight = Math.sin((1 - fraction) * angle) / sinAngle;
  const endWeight = Math.sin(fraction * angle) / sinAngle;
  return normalizeQuaternion(start.map((value, index) =>
    startWeight * value + endWeight * target[index]
  ));
}

export function quaternionToRotationMatrix(quaternion) {
  const [w, x, y, z] = normalizeQuaternion(quaternion);
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)]
  ];
}

function applyRotation(matrix, vector) {
  return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
}

export const HORIZONS_4006_CATALOGUE_FRAME_WINDOW = Object.freeze({
  id:"horizons-q31-q45-catalogue-frame-window-4006-proof",
  authority:"NASA/JPL Horizons API",
  catalogueYear:4006,
  frameSemantics:MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  inputFrame:"ICRF apparent direction",
  outputFrame:"Earth mean ecliptic-of-date direction",
  interpolation:"daily quaternion SLERP",
  startTtJulianDay:START_TT_JD,
  endTtJulianDay:END_TT_JD,
  stepDays:STEP_DAYS,
  knotCount:KNOT_COUNT,
  proofOnly:true,
  productionIntegrated:false,
  note:"The evidence window starts 4005-12-01 so the Tyme-style year=4006 catalogue includes its previous-December 270° winter-solstice crossing and the solver's bounded root bracket."
});

export function createHorizons4006CatalogueFrameProofTransform() {
  function matrixAtTtJulianDay(ttJulianDay) {
    assertFinite("ttJulianDay", ttJulianDay);
    if (ttJulianDay < START_TT_JD || ttJulianDay > END_TT_JD) {
      throw new RangeError(`no catalogue frame proof covers TT JD ${ttJulianDay}`);
    }
    if (ttJulianDay === END_TT_JD) {
      return quaternionToRotationMatrix(knotQuaternion(KNOT_COUNT - 1));
    }
    const position = (ttJulianDay - START_TT_JD) / STEP_DAYS;
    const index = Math.floor(position);
    const fraction = position - index;
    return quaternionToRotationMatrix(slerpQuaternion(
      knotQuaternion(index),
      knotQuaternion(index + 1),
      fraction
    ));
  }

  return Object.freeze({
    id:HORIZONS_4006_CATALOGUE_FRAME_WINDOW.id,
    frameSemantics:HORIZONS_4006_CATALOGUE_FRAME_WINDOW.frameSemantics,
    proofOnly:true,
    productionIntegrated:false,
    coverageTtJulianDay:Object.freeze([START_TT_JD, END_TT_JD]),
    matrixAtTtJulianDay,
    icrfDirectionToMeanEclipticOfDate({ ttJulianDay, directionIcrf }) {
      assertVector("directionIcrf", directionIcrf);
      return Object.freeze(applyRotation(matrixAtTtJulianDay(ttJulianDay), directionIcrf));
    }
  });
}

export const HORIZONS_4006_CATALOGUE_FRAME_KNOT_QUATERNIONS = KNOT_QUATERNIONS;
