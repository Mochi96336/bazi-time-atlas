const ARCSEC_PER_RADIAN = 206264.80624709636;

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function norm(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector, name = "vector") {
  const magnitude = norm(vector);
  if (!(magnitude > 0) || !Number.isFinite(magnitude)) {
    throw new RangeError(`${name} must have finite non-zero magnitude`);
  }
  return vector.map(value => value / magnitude);
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, scalar) {
  return vector.map(value => value * scalar);
}

function transpose(matrix) {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]]
  ];
}

function multiplyMatrices(a, b) {
  return a.map((row, i) => b[0].map((_, j) => (
    row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]
  )));
}

export function applyRotationMatrix(matrix, vector) {
  return matrix.map(row => dot(row, vector));
}

export function sphericalDegreesToUnitVector([longitudeDegrees, latitudeDegrees]) {
  assertFinite("longitudeDegrees", longitudeDegrees);
  assertFinite("latitudeDegrees", latitudeDegrees);
  const longitude = longitudeDegrees * Math.PI / 180;
  const latitude = latitudeDegrees * Math.PI / 180;
  const cosLatitude = Math.cos(latitude);
  return [
    cosLatitude * Math.cos(longitude),
    cosLatitude * Math.sin(longitude),
    Math.sin(latitude)
  ];
}

function orthonormalTriad(primaryDirection, secondaryDirection) {
  const first = normalize(primaryDirection, "primaryDirection");
  const projected = scale(first, dot(secondaryDirection, first));
  const second = normalize(subtract(secondaryDirection, projected), "secondaryDirection residual");
  const third = normalize(cross(first, second), "triad cross product");
  return [
    [first[0], second[0], third[0]],
    [first[1], second[1], third[1]],
    [first[2], second[2], third[2]]
  ];
}

/**
 * Recover a proper 3-D rotation from two paired non-collinear directions.
 *
 * The proof capture uses Sun + Moon apparent directions in ICRF as the source
 * pair and the same apparent directions in Earth ecliptic-of-date coordinates
 * as the target pair. A withheld-target sweep verifies that the recovered
 * rotation is target-independent at sub-milliarcsecond precision in 2026.
 */
export function rotationFromDirectionPairs({ sourceA, targetA, sourceB, targetB }) {
  const sourceTriad = orthonormalTriad(sourceA, sourceB);
  const targetTriad = orthonormalTriad(targetA, targetB);
  return multiplyMatrices(targetTriad, transpose(sourceTriad));
}

function matrixToQuaternion(matrix) {
  const m00 = matrix[0][0];
  const m11 = matrix[1][1];
  const m22 = matrix[2][2];
  const trace = m00 + m11 + m22;
  let w;
  let x;
  let y;
  let z;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (matrix[2][1] - matrix[1][2]) / s;
    y = (matrix[0][2] - matrix[2][0]) / s;
    z = (matrix[1][0] - matrix[0][1]) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (matrix[2][1] - matrix[1][2]) / s;
    x = 0.25 * s;
    y = (matrix[0][1] + matrix[1][0]) / s;
    z = (matrix[0][2] + matrix[2][0]) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (matrix[0][2] - matrix[2][0]) / s;
    x = (matrix[0][1] + matrix[1][0]) / s;
    y = 0.25 * s;
    z = (matrix[1][2] + matrix[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (matrix[1][0] - matrix[0][1]) / s;
    x = (matrix[0][2] + matrix[2][0]) / s;
    y = (matrix[1][2] + matrix[2][1]) / s;
    z = 0.25 * s;
  }

  const magnitude = Math.hypot(w, x, y, z);
  return [w / magnitude, x / magnitude, y / magnitude, z / magnitude];
}

function quaternionToMatrix([w, x, y, z]) {
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

function slerpQuaternion(a, b, fraction) {
  let target = b.slice();
  let cosine = a[0] * target[0] + a[1] * target[1] + a[2] * target[2] + a[3] * target[3];
  if (cosine < 0) {
    target = target.map(value => -value);
    cosine = -cosine;
  }
  cosine = Math.min(1, Math.max(-1, cosine));
  if (cosine > 0.9999995) {
    const blended = a.map((value, index) => value + fraction * (target[index] - value));
    const magnitude = Math.hypot(...blended);
    return blended.map(value => value / magnitude);
  }
  const angle = Math.acos(cosine);
  const sinAngle = Math.sin(angle);
  const startWeight = Math.sin((1 - fraction) * angle) / sinAngle;
  const endWeight = Math.sin(fraction * angle) / sinAngle;
  return a.map((value, index) => startWeight * value + endWeight * target[index]);
}

export function interpolateRotationMatrices(startMatrix, endMatrix, fraction) {
  assertFinite("fraction", fraction);
  if (fraction < 0 || fraction > 1) throw new RangeError("fraction must be within [0, 1]");
  const startQuaternion = matrixToQuaternion(startMatrix);
  const endQuaternion = matrixToQuaternion(endMatrix);
  return quaternionToMatrix(slerpQuaternion(startQuaternion, endQuaternion, fraction));
}

export function rotationDistanceArcsec(a, b) {
  const relative = multiplyMatrices(transpose(a), b);
  const cosine = Math.min(1, Math.max(-1, (relative[0][0] + relative[1][1] + relative[2][2] - 1) / 2));
  return Math.acos(cosine) * ARCSEC_PER_RADIAN;
}

export function createHorizonsEclipticFrameWindowProofAdapter({ id, windows, provenance }) {
  if (!id) throw new TypeError("id is required");
  if (!Array.isArray(windows) || windows.length === 0) throw new TypeError("windows must be a non-empty array");
  const normalizedWindows = windows.map(window => {
    assertFinite("window.startJdTt", window.startJdTt);
    assertFinite("window.endJdTt", window.endJdTt);
    if (!(window.endJdTt > window.startJdTt)) throw new RangeError("window end must be after start");
    return Object.freeze({ ...window });
  });

  function findWindow(jdTt) {
    assertFinite("jdTt", jdTt);
    const window = normalizedWindows.find(item => jdTt >= item.startJdTt && jdTt <= item.endJdTt);
    if (!window) throw new RangeError(`no proof frame window covers TT JD ${jdTt}`);
    return window;
  }

  function matrixAtTtJulianDay(jdTt) {
    const window = findWindow(jdTt);
    const fraction = (jdTt - window.startJdTt) / (window.endJdTt - window.startJdTt);
    return interpolateRotationMatrices(window.startMatrix, window.endMatrix, fraction);
  }

  return Object.freeze({
    id,
    proofOnly:true,
    productionIntegrated:false,
    inputFrame:"ICRF apparent direction",
    outputFrame:"Earth ecliptic-of-date apparent direction",
    interpolation:"quaternion-slerp",
    provenance,
    matrixAtTtJulianDay,
    icrfApparentToEclipticOfDate(jdTt, icrfVector) {
      return applyRotationMatrix(matrixAtTtJulianDay(jdTt), icrfVector);
    }
  });
}
