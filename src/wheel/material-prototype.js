import {
  FAN,
  SEXAGENARY_RING_IDS,
  WHEEL_CENTER,
  ringModel
} from "./ring-model.js";

export const MATERIAL_MODES = Object.freeze({
  SVG: "svg",
  ROUGHNESS: "roughness"
});

export const MATERIAL_RING_IDS = Object.freeze([...SEXAGENARY_RING_IDS]);
export const FIXED_LIGHT_DIRECTION = Object.freeze([-0.42, -0.56, 0.714]);
export const ROUGHNESS_FIELD_SIZE = 128;
export const ROUGHNESS_FIELD_SEED = 0x6d32616c;

const SHADER_MODES = new Set([MATERIAL_MODES.ROUGHNESS]);

const VERTEX_SHADER = [
  "#version 300 es",
  "in vec2 a_position;",
  "void main() {",
  "  gl_Position = vec4(a_position, 0.0, 1.0);",
  "}"
].join("\n");

const FRAGMENT_SHADER = [
  "#version 300 es",
  "precision highp float;",
  "uniform vec2 u_resolution;",
  "uniform vec2 u_device_scale;",
  "uniform vec4 u_canvas_to_svg;",
  "uniform vec2 u_canvas_to_svg_offset;",
  "uniform vec2 u_center;",
  "uniform vec2 u_fan_degrees;",
  "uniform vec4 u_inner_radii;",
  "uniform vec4 u_outer_radii;",
  "uniform vec4 u_rotations;",
  "uniform float u_solar_inner_radius;",
  "uniform float u_solar_outer_radius;",
  "uniform float u_solar_rotation;",
  "uniform float u_has_solar_material;",
  "uniform sampler2D u_roughness_field;",
  "out vec4 out_color;",
  "",
  "const float PI = 3.141592653589793;",
  "const float SURFACE_PERIOD_LARGE = 108.0;",
  "const float SURFACE_PERIOD_MEDIUM = 38.0;",
  "const float SURFACE_PERIOD_FINE = 15.0;",
  "const float SURFACE_SAMPLE_STEP = 0.90;",
  "const float SCRATCH_CELL_TANGENT = 12.0;",
  "const float HANDLING_CELL_TANGENT = 45.0;",
  "",
  "mat2 rotation(float radians) {",
  "  float c = cos(radians);",
  "  float s = sin(radians);",
  "  return mat2(c, -s, s, c);",
  "}",
  "",
  "float componentAt(vec4 values, int index) {",
  "  if (index == 0) return values.x;",
  "  if (index == 1) return values.y;",
  "  if (index == 2) return values.z;",
  "  return values.w;",
  "}",
  "",
  "int ringIndex(float radius) {",
  "  for (int index = 0; index < 4; index += 1) {",
  "    float innerRadius = componentAt(u_inner_radii, index);",
  "    float outerRadius = componentAt(u_outer_radii, index);",
  "    if (radius >= innerRadius && radius <= outerRadius) return index;",
  "  }",
  "  return -1;",
  "}",
  "",
  "float fieldAt(vec2 localPoint, float period, vec2 offset) {",
  "  return texture(u_roughness_field, localPoint / period + offset).r;",
  "}",
  "",
  "float surfaceField(vec2 localPoint) {",
  "  vec2 mediumPoint = rotation(0.37) * localPoint;",
  "  vec2 finePoint = rotation(-0.61) * localPoint;",
  "  float large = fieldAt(localPoint, SURFACE_PERIOD_LARGE, vec2(0.13, 0.61));",
  "  float medium = fieldAt(mediumPoint, SURFACE_PERIOD_MEDIUM, vec2(0.47, 0.19));",
  "  float fine = fieldAt(finePoint, SURFACE_PERIOD_FINE, vec2(0.73, 0.37));",
  "  return large * 0.10 + medium * 0.28 + fine * 0.62;",
  "}",
  "",
  "float solarHash(vec2 p, float seed) {",
  "  p += vec2(seed * 17.17, seed * 41.73);",
  "  p = fract(p * vec2(123.34, 456.21));",
  "  p += dot(p, p + 45.32);",
  "  return fract(p.x * p.y);",
  "}",
  "",
  "float solarValueNoise(vec2 p, float seed) {",
  "  vec2 cell = floor(p);",
  "  vec2 fractional = fract(p);",
  "  vec2 eased = fractional * fractional * (3.0 - 2.0 * fractional);",
  "  float a = solarHash(cell, seed);",
  "  float b = solarHash(cell + vec2(1.0, 0.0), seed);",
  "  float c = solarHash(cell + vec2(0.0, 1.0), seed);",
  "  float d = solarHash(cell + vec2(1.0, 1.0), seed);",
  "  return mix(mix(a, b, eased.x), mix(c, d, eased.x), eased.y);",
  "}",
  "",
  "float solarFbm(vec2 p, float seed) {",
  "  float value = 0.0;",
  "  float amplitude = 0.55;",
  "  float normalization = 0.0;",
  "  for (int octave = 0; octave < 3; octave += 1) {",
  "    value += solarValueNoise(p, seed + float(octave) * 19.0) * amplitude;",
  "    normalization += amplitude;",
  "    p = rotation(0.17) * p * 2.03 + vec2(7.1, -4.7);",
  "    amplitude *= 0.5;",
  "  }",
  "  return value / max(normalization, 0.0001);",
  "}",
  "",
  "vec3 solarOxidation(vec2 localPoint) {",
  "  vec2 p = vec2(localPoint.x / 170.0, localPoint.y / 145.0);",
  "  float wx = (solarFbm(p * 2.10, 51.0) - 0.5) * 0.55;",
  "  float wy = (solarFbm(p * 1.95 + vec2(17.0, -9.0), 73.0) - 0.5) * 0.48;",
  "  vec2 warped = p + vec2(wx, wy);",
  "  float low = solarFbm(warped * 2.60, 11.0);",
  "  float mid = solarFbm(vec2(warped.x * 5.00, warped.y * 4.65) + vec2(3.7, -2.1), 29.0);",
  "  float fine = solarFbm(warped * 8.50 + vec2(-5.2, 8.4), 101.0);",
  "  float combined = low * 0.18 + mid * 0.46 + fine * 0.36;",
  "  float oxidePatch = smoothstep(0.58, 0.76, combined);",
  "  float deep = smoothstep(0.72, 0.86, solarFbm(p * vec2(4.00, 3.50) + vec2(-12.0, 7.0), 149.0));",
  "  float cool = smoothstep(0.75, 0.89, solarValueNoise(p * vec2(3.20, 2.90) + vec2(5.0, 13.0), 211.0));",
  "  return vec3(oxidePatch, deep, cool);",
  "}",
  "",
  "float segmentDistance(vec2 p, vec2 a, vec2 b) {",
  "  vec2 pa = p - a;",
  "  vec2 ba = b - a;",
  "  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);",
  "  return length(pa - ba * h);",
  "}",
  "",
  "vec3 solarScratchCoordinates(vec2 localPoint) {",
  "  float radius = length(localPoint);",
  "  float midRadius = (u_solar_inner_radius + u_solar_outer_radius) * 0.5;",
  "  float circumference = 2.0 * PI * midRadius;",
  "  float angle = atan(localPoint.y, localPoint.x) + PI;",
  "  return vec3(angle * midRadius, radius - u_solar_inner_radius, circumference);",
  "}",
  "",
  "vec2 scratchFromCell(vec2 uv, float cell, float cellSize, float handling, float circumference, float phase) {",
  "  float cellCount = max(1.0, floor(circumference / cellSize));",
  "  float wrappedCell = mod(mod(cell, cellCount) + cellCount, cellCount);",
  "  vec2 seedCell = vec2(wrappedCell + phase * 37.0, phase * 61.0 + handling * 109.0);",
  "  float r0 = solarHash(seedCell + vec2(0.11, 0.73), 301.0);",
  "  float r1 = solarHash(seedCell + vec2(1.37, 2.19), 313.0);",
  "  float r2 = solarHash(seedCell + vec2(3.71, 0.43), 331.0);",
  "  float r3 = solarHash(seedCell + vec2(5.23, 7.17), 347.0);",
  "  float r4 = solarHash(seedCell + vec2(9.41, 1.89), 359.0);",
  "  float r5 = solarHash(seedCell + vec2(2.83, 11.31), 373.0);",
  "  float exists = step(mix(0.17, 0.52, handling), r0);",
  "  float centerX = (wrappedCell + r1) * cellSize;",
  "  float shortest = mod(centerX - uv.x + circumference * 0.5, circumference) - circumference * 0.5;",
  "  float bandWidth = u_solar_outer_radius - u_solar_inner_radius;",
  "  vec2 center = vec2(uv.x + shortest, mix(2.0, max(2.0, bandWidth - 2.0), r2));",
  "  float demoScale = clamp(bandWidth / 240.0, 0.28, 0.50);",
  "  float shortBias = pow(r3, 2.2);",
  "  float scratchLength = mix(8.0 + shortBias * 135.0, 25.0 + r3 * 170.0, handling) * demoScale * 0.46;",
  "  float angleRandom = fract(r4 * 1.618 + r1 * 0.37);",
  "  float angle = mix(1.675516 + (angleRandom - 0.5) * 0.418879, angleRandom * PI, handling);",
  "  vec2 direction = vec2(cos(angle), sin(angle));",
  "  vec2 normal = vec2(-direction.y, direction.x);",
  "  vec2 a = center - direction * scratchLength * 0.5;",
  "  vec2 b = center + direction * scratchLength * 0.5;",
  "  float axis = dot(uv - center, direction);",
  "  float bendWindow = sin(clamp(axis / max(scratchLength, 0.001) + 0.5, 0.0, 1.0) * PI);",
  "  float bendRandom = fract(r5 * 1.713 + r3 * 0.29);",
  "  float bend = bendWindow * (bendRandom - 0.5) * mix(10.0, 16.0, handling) * demoScale * 0.52;",
  "  float distanceToScratch = segmentDistance(uv - normal * bend, a, b);",
  "  float widthRandom = fract(r4 * 2.414 + r2);",
  "  float width = mix(0.15 + widthRandom * 0.55, 0.25 + widthRandom * 0.65, handling);",
  "  float feather = max(0.20, fwidth(distanceToScratch) * 0.85);",
  "  float mask = (1.0 - smoothstep(width, width + feather, distanceToScratch)) * exists;",
  "  float response = mix(0.55, 1.0, fract(r3 * 1.31 + r4 * 2.17));",
  "  mask *= response;",
  "  float polarity = fract(r5 * 3.17 + r0) > 0.43 ? 1.0 : -1.0;",
  "  return vec2(mask * polarity, mask);",
  "}",
  "",
  "vec2 scratchLayer(vec2 localPoint, float handling, float phase) {",
  "  vec3 coordinates = solarScratchCoordinates(localPoint);",
  "  vec2 uv = coordinates.xy;",
  "  float circumference = coordinates.z;",
  "  float cellSize = mix(SCRATCH_CELL_TANGENT, HANDLING_CELL_TANGENT, handling);",
  "  float baseCell = floor(uv.x / cellSize);",
  "  vec2 best = vec2(0.0);",
  "  for (int offset = -1; offset <= 1; offset += 1) {",
  "    vec2 candidate = scratchFromCell(",
  "      uv,",
  "      baseCell + float(offset),",
  "      cellSize,",
  "      handling,",
  "      circumference,",
  "      phase",
  "    );",
  "    if (candidate.y > best.y) best = candidate;",
  "  }",
  "  return best;",
  "}",
  "",
  "vec2 primaryScratchField(vec2 localPoint) {",
  "  vec2 first = scratchLayer(localPoint, 0.0, 0.0);",
  "  vec2 second = scratchLayer(localPoint, 0.0, 1.0);",
  "  return second.y > first.y ? second : first;",
  "}",
  "",
  "vec2 handlingScratchField(vec2 localPoint) {",
  "  return scratchLayer(localPoint, 1.0, 2.0);",
  "}",
  "",
  "vec3 brassBody(vec2 worldPoint) {",
  "  vec3 brassLight = vec3(0.396, 0.302, 0.178);",
  "  vec3 brassMid = vec3(0.340, 0.248, 0.142);",
  "  vec3 brassDark = vec3(0.175, 0.113, 0.061);",
  "  float worldAngleDegrees = atan(worldPoint.y, worldPoint.x) * 180.0 / PI;",
  "  float fanSpan = max(u_fan_degrees.y - u_fan_degrees.x, 0.001);",
  "  float bodyCoordinate = clamp((worldAngleDegrees - u_fan_degrees.x) / fanSpan, 0.0, 1.0);",
  "  vec3 body = bodyCoordinate < 0.46",
  "    ? mix(brassLight, brassMid, bodyCoordinate / 0.46)",
  "    : mix(brassMid, brassDark, (bodyCoordinate - 0.46) / 0.54);",
  "  float warmCatch = 1.0 - smoothstep(0.0, 0.34, abs(bodyCoordinate - 0.18));",
  "  return mix(body, vec3(0.961, 0.878, 0.710), warmCatch * 0.010);",
  "}",
  "",
  "vec4 renderSolarBrass(vec2 worldPoint, float rotationDegrees, float pixelFootprint) {",
  "  float ringRotation = rotationDegrees * PI / 180.0;",
  "  vec2 localPoint = rotation(ringRotation) * worldPoint;",
  "  vec3 aging = solarOxidation(localPoint);",
  "  vec2 primaryScratch = primaryScratchField(localPoint);",
  "  vec2 handlingScratch = handlingScratchField(localPoint + vec2(19.0, -11.0));",
  "",
  "  vec3 body = brassBody(worldPoint);",
  "  vec3 oxideWarm = vec3(0.267, 0.176, 0.098);",
  "  vec3 oxideCool = vec3(0.298, 0.337, 0.275);",
  "  vec3 oxideMultiplier = mix(oxideWarm, oxideCool, aging.z * 0.55);",
  "  float oxideStrength = clamp(aging.x * 0.10 + aging.y * 0.045 + aging.z * 0.005, 0.0, 0.14);",
  "  body = mix(body, body * oxideMultiplier, oxideStrength);",
  "",
  "  float fineAttenuation = mix(0.34, 1.0, 1.0 - smoothstep(1.15, 2.85, pixelFootprint));",
  "  vec3 scratchLight = vec3(1.0, 0.937, 0.804);",
  "  vec3 scratchDark = vec3(0.145, 0.090, 0.047);",
  "  float primaryStrength = abs(primaryScratch.x) * 0.012 * fineAttenuation;",
  "  float handlingStrength = abs(handlingScratch.x) * 0.007 * fineAttenuation;",
  "  body = mix(body, primaryScratch.x >= 0.0 ? scratchLight : scratchDark, primaryStrength);",
  "  body = mix(body, handlingScratch.x >= 0.0 ? scratchLight : scratchDark, handlingStrength);",
  "",
  "  float radius = length(worldPoint);",
  "  float edgeDistance = min(radius - u_solar_inner_radius, u_solar_outer_radius - radius);",
  "  float edgeMask = smoothstep(0.0, 1.35, edgeDistance);",
  "  float bodyAlpha = edgeMask * 0.92;",
  "  return vec4(body * bodyAlpha, bodyAlpha);",
  "}",
  "",
  "void main() {",
  "  vec2 canvasPoint = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_device_scale;",
  "  vec2 svgPoint = vec2(",
  "    u_canvas_to_svg.x * canvasPoint.x + u_canvas_to_svg.z * canvasPoint.y + u_canvas_to_svg_offset.x,",
  "    u_canvas_to_svg.y * canvasPoint.x + u_canvas_to_svg.w * canvasPoint.y + u_canvas_to_svg_offset.y",
  "  );",
  "  vec2 point = svgPoint - u_center;",
  "  float radius = length(point);",
  "  float angleDegrees = atan(point.y, point.x) * 180.0 / PI;",
  "  if (angleDegrees < u_fan_degrees.x || angleDegrees > u_fan_degrees.y) discard;",
  "  float pixelFootprint = max(length(dFdx(svgPoint)), length(dFdy(svgPoint)));",
  "  bool inSolar = u_has_solar_material > 0.5",
  "    && radius >= u_solar_inner_radius",
  "    && radius <= u_solar_outer_radius;",
  "  if (inSolar) {",
  "    out_color = renderSolarBrass(point, u_solar_rotation, pixelFootprint);",
  "    return;",
  "  }",
  "  int index = ringIndex(radius);",
  "  if (index < 0) discard;",
  "",
  // SVG user coordinates are y-down while GLSL mat2 constructors are column-major.
  // A positive rendered SVG rotation therefore maps to +ringRotation for world->local
  // sampling and -ringRotation for local->world slopes. Keep both signs paired.
  "  float ringRotation = componentAt(u_rotations, index) * PI / 180.0;",
  "  vec2 localPoint = rotation(ringRotation) * point;",
  "  float field = surfaceField(localPoint);",
  "  float fieldCentered = field - 0.5;",
  "  float roughness = clamp(0.810 + fieldCentered * 0.090, 0.770, 0.850);",
  "",
  "  float fieldDx = (",
  "    surfaceField(localPoint + vec2(SURFACE_SAMPLE_STEP, 0.0))",
  "    - surfaceField(localPoint - vec2(SURFACE_SAMPLE_STEP, 0.0))",
  "  ) / (2.0 * SURFACE_SAMPLE_STEP);",
  "  float fieldDy = (",
  "    surfaceField(localPoint + vec2(0.0, SURFACE_SAMPLE_STEP))",
  "    - surfaceField(localPoint - vec2(0.0, SURFACE_SAMPLE_STEP))",
  "  ) / (2.0 * SURFACE_SAMPLE_STEP);",
  "  vec2 slopeLocal = vec2(fieldDx, fieldDy) * 0.44;",
  "  vec2 slopeWorld = rotation(-ringRotation) * slopeLocal;",
  "  vec3 microNormal = normalize(vec3(-slopeWorld.x, -slopeWorld.y, 1.0));",
  "",
  "  vec3 lightDirection = normalize(vec3(-0.42, -0.56, 0.714));",
  "  vec3 viewDirection = vec3(0.0, 0.0, 1.0);",
  "  vec3 halfVector = normalize(lightDirection + viewDirection);",
  "  float baseLight = max(lightDirection.z, 0.0);",
  "  float microLightDelta = clamp(dot(microNormal, lightDirection) - baseLight, -0.060, 0.060);",
  "  float specularPower = mix(18.0, 6.0, roughness);",
  "  float specular = pow(max(dot(microNormal, halfVector), 0.0), specularPower)",
  "    * (0.018 + (1.0 - roughness) * 0.13);",
  "",
  "  float environmentResponse = clamp(",
  "    0.88 + dot(point / vec2(760.0, 500.0), lightDirection.xy) * 0.12,",
  "    0.80,",
  "    1.00",
  "  );",
  "",
  "  float innerRadius = componentAt(u_inner_radii, index);",
  "  float outerRadius = componentAt(u_outer_radii, index);",
  "  float edgeDistance = min(radius - innerRadius, outerRadius - radius);",
  "",
  "  vec3 reflectionTint = vec3(0.84, 0.88, 0.89);",
  "  vec3 microLightTint = vec3(0.72, 0.76, 0.75);",
  "  vec3 microDarkTint = vec3(0.035, 0.042, 0.041);",
  "  float edgeMask = smoothstep(0.0, 1.5, edgeDistance);",
  "  float specularAlpha = clamp(specular * environmentResponse * 0.38, 0.0, 0.010);",
  "  float microAlpha = clamp(abs(microLightDelta) * 0.39 + abs(fieldCentered) * 0.013, 0.0, 0.034);",
  "  vec3 microTint = microLightDelta >= 0.0 ? microLightTint : microDarkTint;",
  "  float overlayAlpha = edgeMask * clamp(specularAlpha + microAlpha, 0.0, 0.044);",
  "  vec3 overlayColor = reflectionTint * specularAlpha + microTint * microAlpha;",
  "  out_color = vec4(overlayColor * edgeMask, overlayAlpha);",
  "}"
].join("\n");

function normalizeMode(value) {
  if (value === null || value === "") return MATERIAL_MODES.ROUGHNESS;
  if (value === MATERIAL_MODES.SVG) return MATERIAL_MODES.SVG;
  return SHADER_MODES.has(value) ? value : MATERIAL_MODES.SVG;
}

export function resolveMaterialMode(search = "") {
  try {
    const params = new URLSearchParams(search);
    return normalizeMode(params.get("material"));
  } catch {
    return MATERIAL_MODES.SVG;
  }
}

export function materialGeometry() {
  return MATERIAL_RING_IDS.map(id => {
    const model = ringModel(id);
    return Object.freeze({
      id,
      innerRadius: model.innerRadius,
      outerRadius: model.outerRadius
    });
  });
}

export function solarMaterialGeometry() {
  const solar = ringModel("solar");
  const zodiac = ringModel("zodiac");
  return Object.freeze({
    id: solar.id,
    innerRadius: solar.innerRadius,
    outerRadius: zodiac.innerRadius
  });
}

export function renderedSolarRotation(renderedRotations) {
  const value = renderedRotations?.get?.("solar");
  return Number.isFinite(value) ? value : 0;
}

export function fillRenderedRotations(renderedRotations, target = new Float32Array(MATERIAL_RING_IDS.length)) {
  MATERIAL_RING_IDS.forEach((id, index) => {
    const value = renderedRotations?.get?.(id);
    target[index] = Number.isFinite(value) ? value : 0;
  });
  return target;
}

function nextRandom(state) {
  let value = state.value >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.value = value >>> 0;
  return (state.value >>> 0) / 4294967295;
}

export function buildRoughnessField(size = ROUGHNESS_FIELD_SIZE, seed = ROUGHNESS_FIELD_SEED) {
  if (!Number.isInteger(size) || size < 8) throw new Error("roughness field size must be an integer >= 8");
  const state = { value: seed >>> 0 || 1 };
  let current = new Float32Array(size * size);
  let next = new Float32Array(size * size);

  for (let index = 0; index < current.length; index += 1) {
    current[index] = nextRandom(state);
  }

  const at = (field, x, y) => {
    const wrappedX = (x + size) % size;
    const wrappedY = (y + size) % size;
    return field[wrappedY * size + wrappedX];
  };

  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const center = at(current, x, y);
        const cross = at(current, x - 1, y)
          + at(current, x + 1, y)
          + at(current, x, y - 1)
          + at(current, x, y + 1);
        const diagonals = at(current, x - 1, y - 1)
          + at(current, x + 1, y - 1)
          + at(current, x - 1, y + 1)
          + at(current, x + 1, y + 1);
        next[y * size + x] = center * 0.50 + cross * 0.10 + diagonals * 0.025;
      }
    }
    [current, next] = [next, current];
  }

  let mean = 0;
  for (const value of current) mean += value;
  mean /= current.length;

  let maxDeviation = 0;
  for (const value of current) maxDeviation = Math.max(maxDeviation, Math.abs(value - mean));
  const scale = maxDeviation > 0 ? 0.5 / maxDeviation : 1;

  const bytes = new Uint8Array(size * size);
  for (let index = 0; index < current.length; index += 1) {
    const normalized = Math.max(0, Math.min(1, 0.5 + (current[index] - mean) * scale));
    bytes[index] = Math.round(normalized * 255);
  }
  return bytes;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("unable to create material shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "unknown shader compilation error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("unable to create material shader program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "unknown shader link error";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

function uniformLocations(gl, program) {
  return Object.freeze({
    resolution: gl.getUniformLocation(program, "u_resolution"),
    deviceScale: gl.getUniformLocation(program, "u_device_scale"),
    canvasToSvg: gl.getUniformLocation(program, "u_canvas_to_svg"),
    canvasToSvgOffset: gl.getUniformLocation(program, "u_canvas_to_svg_offset"),
    center: gl.getUniformLocation(program, "u_center"),
    fanDegrees: gl.getUniformLocation(program, "u_fan_degrees"),
    innerRadii: gl.getUniformLocation(program, "u_inner_radii"),
    outerRadii: gl.getUniformLocation(program, "u_outer_radii"),
    rotations: gl.getUniformLocation(program, "u_rotations"),
    solarInnerRadius: gl.getUniformLocation(program, "u_solar_inner_radius"),
    solarOuterRadius: gl.getUniformLocation(program, "u_solar_outer_radius"),
    solarRotation: gl.getUniformLocation(program, "u_solar_rotation"),
    hasSolarMaterial: gl.getUniformLocation(program, "u_has_solar_material"),
    field: gl.getUniformLocation(program, "u_roughness_field")
  });
}

function setupQuad(gl, program) {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("unable to create material quad");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  return buffer;
}

function setupRoughnessTexture(gl) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("unable to create roughness texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8,
    ROUGHNESS_FIELD_SIZE,
    ROUGHNESS_FIELD_SIZE,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    buildRoughnessField()
  );
  return texture;
}

export function createWheelMaterialPrototype({ canvas, svg, search = globalThis.location?.search ?? "" }) {
  const requestedMode = resolveMaterialMode(search);
  let materialWasExplicit = false;
  try {
    materialWasExplicit = new URLSearchParams(search).has("material");
  } catch {
    materialWasExplicit = false;
  }
  const shell = svg?.closest?.("#kinetic-instrument") ?? null;
  const geometry = materialGeometry();
  const solarGeometry = solarMaterialGeometry();
  const innerRadii = new Float32Array(geometry.map(item => item.innerRadius));
  const outerRadii = new Float32Array(geometry.map(item => item.outerRadius));
  const rotations = new Float32Array(MATERIAL_RING_IDS.length);
  let solarRotation = 0;

  let gl = null;
  let program = null;
  let uniforms = null;
  let active = false;
  let sizeDirty = true;
  let resizeObserver = null;

  function fallBack(reason, detail = "") {
    active = false;
    shell?.removeAttribute("data-material-prototype");
    if (shell) {
      shell.dataset.materialPrototypeFallback = reason;
      if (detail) {
        shell.dataset.materialPrototypeError = String(detail).replace(/\s+/g, " ").slice(0, 600);
      } else {
        shell.removeAttribute("data-material-prototype-error");
      }
    }
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  function resizeCanvas() {
    if (!active || !sizeDirty) return;
    sizeDirty = false;
    const rect = svg.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  function draw() {
    if (!active) return;
    resizeCanvas();
    if (!(canvas.width > 1 && canvas.height > 1)) return;

    const canvasRect = canvas.getBoundingClientRect();
    const screenCtm = svg.getScreenCTM?.();
    if (!screenCtm || !(canvasRect.width > 0 && canvasRect.height > 0)) return;
    let screenToSvg;
    try {
      screenToSvg = screenCtm.inverse();
    } catch {
      return;
    }

    const deviceScaleX = canvas.width / canvasRect.width;
    const deviceScaleY = canvas.height / canvasRect.height;
    const offsetX = screenToSvg.a * canvasRect.left
      + screenToSvg.c * canvasRect.top
      + screenToSvg.e;
    const offsetY = screenToSvg.b * canvasRect.left
      + screenToSvg.d * canvasRect.top
      + screenToSvg.f;

    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.deviceScale, deviceScaleX, deviceScaleY);
    gl.uniform4f(
      uniforms.canvasToSvg,
      screenToSvg.a,
      screenToSvg.b,
      screenToSvg.c,
      screenToSvg.d
    );
    gl.uniform2f(uniforms.canvasToSvgOffset, offsetX, offsetY);
    gl.uniform2f(uniforms.center, WHEEL_CENTER.x, WHEEL_CENTER.y);
    gl.uniform2f(uniforms.fanDegrees, FAN.start, FAN.end);
    gl.uniform4fv(uniforms.innerRadii, innerRadii);
    gl.uniform4fv(uniforms.outerRadii, outerRadii);
    gl.uniform4fv(uniforms.rotations, rotations);
    gl.uniform1f(uniforms.solarInnerRadius, solarGeometry.innerRadius);
    gl.uniform1f(uniforms.solarOuterRadius, solarGeometry.outerRadius);
    gl.uniform1f(uniforms.solarRotation, solarRotation);
    gl.uniform1f(uniforms.hasSolarMaterial, 1);
    gl.uniform1i(uniforms.field, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function activateShader() {
    if (active || !canvas || !svg || !SHADER_MODES.has(requestedMode)) return active;

    try {
      if (new URLSearchParams(search).get("materialWebgl") === "off") {
        throw new Error("forced WebGL fallback");
      }
      gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: "low-power"
      });
      if (!gl) throw new Error("WebGL2 unavailable");

      program = createProgram(gl);
      uniforms = uniformLocations(gl, program);
      gl.useProgram(program);
      setupQuad(gl, program);
      setupRoughnessTexture(gl);
      gl.activeTexture(gl.TEXTURE0);

      active = true;
      shell?.removeAttribute("data-material-prototype-fallback");
      shell?.removeAttribute("data-material-prototype-error");
      if (shell) shell.dataset.materialPrototype = requestedMode;

      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        fallBack("context-lost");
      }, { once: true });

      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => {
          sizeDirty = true;
          draw();
        });
        resizeObserver.observe(svg);
      } else {
        globalThis.addEventListener?.("resize", () => {
          sizeDirty = true;
          draw();
        });
      }

      sizeDirty = true;
      draw();
      return true;
    } catch (error) {
      const forced = error?.message === "forced WebGL fallback";
      fallBack(forced ? "forced" : "webgl-unavailable", forced ? "" : error?.message);
      return false;
    }
  }

  function initialize() {
    if (!canvas || !svg || !SHADER_MODES.has(requestedMode)) return false;

    if (materialWasExplicit) return activateShader();

    const scheduleIdleActivation = () => {
      const activate = () => activateShader();
      if (typeof globalThis.requestIdleCallback === "function") {
        globalThis.requestIdleCallback(activate, { timeout: 1800 });
      } else {
        globalThis.setTimeout?.(activate, 900);
      }
    };

    if (globalThis.document?.readyState === "complete") {
      globalThis.setTimeout?.(scheduleIdleActivation, 0);
    } else {
      globalThis.addEventListener?.("load", scheduleIdleActivation, { once:true });
    }
    return true;
  }

  function updateFrame(renderedRotations) {
    if (!active) return;
    fillRenderedRotations(renderedRotations, rotations);
    solarRotation = renderedSolarRotation(renderedRotations);
    draw();
  }

  return Object.freeze({
    mode: requestedMode,
    initialize,
    updateFrame,
    isActive: () => active
  });
}
