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
  "const float OXIDE_PERIOD_LARGE = 166.0;",
  "const float OXIDE_PERIOD_MEDIUM = 72.0;",
  "const float OXIDE_PERIOD_FINE = 29.0;",
  "const float OXIDE_WARP_STRENGTH = 24.0;",
  "const float SCRATCH_CELL_TANGENT = 46.0;",
  "const float SCRATCH_CELL_RADIAL = 21.0;",
  "const float SCRATCH_SAMPLE_STEP = 0.85;",
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
  "vec2 oxidationWarp(vec2 localPoint) {",
  "  float wx = fieldAt(localPoint, 171.0, vec2(0.17, 0.63)) - 0.5;",
  "  float wy = fieldAt(rotation(0.73) * localPoint, 143.0, vec2(0.61, 0.21)) - 0.5;",
  "  return vec2(wx, wy);",
  "}",
  "",
  "float oxidationBase(vec2 localPoint) {",
  "  vec2 warped = localPoint + oxidationWarp(localPoint) * OXIDE_WARP_STRENGTH;",
  "  float large = fieldAt(warped, OXIDE_PERIOD_LARGE, vec2(0.31, 0.77));",
  "  float medium = fieldAt(rotation(-0.43) * warped, OXIDE_PERIOD_MEDIUM, vec2(0.67, 0.11));",
  "  float fine = fieldAt(rotation(0.58) * warped, OXIDE_PERIOD_FINE, vec2(0.09, 0.53));",
  "  return large * 0.58 + medium * 0.31 + fine * 0.11;",
  "}",
  "",
  "float oxidationField(vec2 localPoint) {",
  "  float thresholdVariation = (fieldAt(localPoint, 238.0, vec2(0.83, 0.27)) - 0.5) * 0.10;",
  "  return smoothstep(0.49 + thresholdVariation, 0.68 + thresholdVariation, oxidationBase(localPoint));",
  "}",
  "",
  "float deepOxidationField(vec2 localPoint) {",
  "  vec2 shifted = rotation(0.41) * localPoint + vec2(37.0, -19.0);",
  "  return smoothstep(0.70, 0.82, oxidationBase(shifted));",
  "}",
  "",
  "float hash21(vec2 p) {",
  "  p = fract(p * vec2(123.34, 456.21));",
  "  p += dot(p, p + 45.32);",
  "  return fract(p.x * p.y);",
  "}",
  "",
  "float segmentDistance(vec2 p, vec2 a, vec2 b) {",
  "  vec2 pa = p - a;",
  "  vec2 ba = b - a;",
  "  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);",
  "  return length(pa - ba * h);",
  "}",
  "",
  "vec2 solarScratchUv(vec2 localPoint) {",
  "  float radius = length(localPoint);",
  "  float midRadius = (u_solar_inner_radius + u_solar_outer_radius) * 0.5;",
  "  return vec2(atan(localPoint.y, localPoint.x) * midRadius, radius - u_solar_inner_radius);",
  "}",
  "",
  "float scratchFromCell(vec2 uv, vec2 cell, float handling) {",
  "  vec2 cellSize = vec2(SCRATCH_CELL_TANGENT, SCRATCH_CELL_RADIAL);",
  "  vec2 seed = cell + vec2(handling * 71.0, handling * 113.0);",
  "  float r0 = hash21(seed + vec2(0.11, 0.73));",
  "  float r1 = hash21(seed + vec2(1.37, 2.19));",
  "  float r2 = hash21(seed + vec2(3.71, 0.43));",
  "  float r3 = hash21(seed + vec2(5.23, 7.17));",
  "  float r4 = hash21(seed + vec2(9.41, 1.89));",
  "  float r5 = hash21(seed + vec2(2.83, 11.31));",
  "  float r6 = hash21(seed + vec2(13.13, 4.57));",
  "  float r7 = hash21(seed + vec2(6.67, 15.79));",
  "  float threshold = mix(0.60, 0.978, handling);",
  "  float exists = step(threshold, r0);",
  "  vec2 center = cell * cellSize + vec2(r1 * cellSize.x, r2 * cellSize.y);",
  "  float shortBias = r3 * r3;",
  "  float scratchLength = mix(mix(9.0, 22.0, handling), mix(40.0, 64.0, handling), shortBias);",
  "  float maxAngle = mix(0.16, 0.68, handling);",
  "  float angle = (r5 - 0.5) * 2.0 * maxAngle;",
  "  vec2 direction = vec2(cos(angle), sin(angle));",
  "  vec2 normal = vec2(-direction.y, direction.x);",
  "  vec2 a = center - direction * scratchLength * 0.5;",
  "  vec2 b = center + direction * scratchLength * 0.5;",
  "  float axis = dot(uv - center, direction);",
  "  float bendWindow = sin(clamp(axis / scratchLength + 0.5, 0.0, 1.0) * PI);",
  "  float bend = bendWindow * (r6 - 0.5) * mix(1.25, 2.4, handling);",
  "  float distanceToScratch = segmentDistance(uv - normal * bend, a, b);",
  "  float width = mix(mix(0.26, 0.38, handling), mix(0.82, 0.96, handling), r4);",
  "  float feather = max(0.34, fwidth(distanceToScratch) * 0.90);",
  "  float mask = (1.0 - smoothstep(width, width + feather, distanceToScratch)) * exists;",
  "  float polarity = r7 > 0.46 ? 1.0 : -1.0;",
  "  return mask * polarity;",
  "}",
  "",
  "float scratchField(vec2 localPoint, float handling) {",
  "  vec2 uv = solarScratchUv(localPoint);",
  "  vec2 cellSize = vec2(SCRATCH_CELL_TANGENT, SCRATCH_CELL_RADIAL);",
  "  vec2 baseCell = floor(uv / cellSize);",
  "  float best = 0.0;",
  "  for (int offset = -1; offset <= 1; offset += 1) {",
  "    float candidate = scratchFromCell(uv, baseCell + vec2(float(offset), 0.0), handling);",
  "    if (abs(candidate) > abs(best)) best = candidate;",
  "  }",
  "  return best;",
  "}",
  "",
  "float brassMicroField(vec2 localPoint) {",
  "  float medium = fieldAt(rotation(0.29) * localPoint, 47.0, vec2(0.23, 0.87));",
  "  float fine = fieldAt(rotation(-0.52) * localPoint, 17.0, vec2(0.79, 0.33));",
  "  return medium * 0.34 + fine * 0.66;",
  "}",
  "",
  "vec4 renderSolarBrass(vec2 worldPoint, float rotationDegrees, float pixelFootprint) {",
  "  float ringRotation = rotationDegrees * PI / 180.0;",
  "  vec2 localPoint = rotation(ringRotation) * worldPoint;",
  "  float oxide = oxidationField(localPoint);",
  "  float deepOxide = deepOxidationField(localPoint) * oxide;",
  "  float primaryScratch = scratchField(localPoint, 0.0);",
  "  float handlingScratch = scratchField(localPoint + vec2(11.0, -7.0), 1.0);",
  "  float scratchSigned = primaryScratch + handlingScratch * 0.25;",
  "  float scratch = clamp(abs(primaryScratch) + abs(handlingScratch) * 0.25, 0.0, 1.0);",
  "  float micro = brassMicroField(localPoint);",
  "  float roughness = clamp(0.72 + (micro - 0.5) * 0.045 + oxide * 0.085 + scratch * 0.060, 0.64, 0.90);",
  "",
  "  float scratchDx = (scratchField(localPoint + vec2(SCRATCH_SAMPLE_STEP, 0.0), 0.0)",
  "    - scratchField(localPoint - vec2(SCRATCH_SAMPLE_STEP, 0.0), 0.0)) / (2.0 * SCRATCH_SAMPLE_STEP);",
  "  float scratchDy = (scratchField(localPoint + vec2(0.0, SCRATCH_SAMPLE_STEP), 0.0)",
  "    - scratchField(localPoint - vec2(0.0, SCRATCH_SAMPLE_STEP), 0.0)) / (2.0 * SCRATCH_SAMPLE_STEP);",
  "  vec2 slopeLocal = vec2(scratchDx, scratchDy) * 0.22;",
  "  vec2 slopeWorld = rotation(-ringRotation) * slopeLocal;",
  "  vec3 microNormal = normalize(vec3(-slopeWorld.x, -slopeWorld.y, 1.0));",
  "",
  "  vec3 lightDirection = normalize(vec3(-0.42, -0.56, 0.714));",
  "  vec3 viewDirection = vec3(0.0, 0.0, 1.0);",
  "  vec3 halfVector = normalize(lightDirection + viewDirection);",
  "  float baseLight = max(lightDirection.z, 0.0);",
  "  float microLightDelta = clamp(dot(microNormal, lightDirection) - baseLight, -0.085, 0.085);",
  "  float specularPower = mix(15.0, 5.5, roughness);",
  "  float specular = pow(max(dot(microNormal, halfVector), 0.0), specularPower)",
  "    * (0.020 + (1.0 - roughness) * 0.12);",
  "  float environmentResponse = clamp(",
  "    0.91 + dot(worldPoint / vec2(840.0, 560.0), lightDirection.xy) * 0.075,",
  "    0.84,",
  "    0.99",
  "  );",
  "  float responseLoss = 1.0 - oxide * 0.22;",
  "",
  "  float coolNoise = fieldAt(rotation(-0.52) * localPoint, 43.0, vec2(0.57, 0.91));",
  "  float coolOxide = smoothstep(0.76, 0.88, coolNoise) * oxide;",
  "  vec3 oxideWarm = vec3(0.24, 0.14, 0.065);",
  "  vec3 oxideCool = vec3(0.18, 0.19, 0.135);",
  "  vec3 oxideTint = mix(oxideWarm, oxideCool, coolOxide * 0.12);",
  "  vec3 reflectionTint = vec3(0.92, 0.84, 0.66);",
  "  vec3 microLightTint = vec3(0.86, 0.74, 0.52);",
  "  vec3 microDarkTint = vec3(0.12, 0.072, 0.032);",
  "",
  "  float fineAttenuation = mix(0.28, 1.0, 1.0 - smoothstep(1.15, 3.0, pixelFootprint));",
  "  float oxideAlpha = clamp(oxide * 0.026 + deepOxide * 0.016, 0.0, 0.038);",
  "  float specularAlpha = clamp(specular * environmentResponse * responseLoss * 0.40, 0.0, 0.012);",
  "  float microAlpha = clamp(",
  "    abs(microLightDelta) * 0.27 * fineAttenuation",
  "      + scratch * 0.016 * fineAttenuation",
  "      + abs(micro - 0.5) * 0.009,",
  "    0.0,",
  "    0.030",
  "  );",
  "  vec3 microTint = (microLightDelta + scratchSigned * 0.015) >= 0.0 ? microLightTint : microDarkTint;",
  "  float radius = length(worldPoint);",
  "  float edgeDistance = min(radius - u_solar_inner_radius, u_solar_outer_radius - radius);",
  "  float edgeMask = smoothstep(0.0, 1.35, edgeDistance);",
  "  float overlayAlpha = edgeMask * clamp(oxideAlpha + specularAlpha + microAlpha, 0.0, 0.062);",
  "  vec3 overlayColor = oxideTint * oxideAlpha",
  "    + reflectionTint * specularAlpha",
  "    + microTint * microAlpha;",
  "  return vec4(overlayColor * edgeMask, overlayAlpha);",
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

  function fallBack(reason) {
    active = false;
    shell?.removeAttribute("data-material-prototype");
    if (shell) shell.dataset.materialPrototypeFallback = reason;
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
      fallBack(error?.message === "forced WebGL fallback" ? "forced" : "webgl-unavailable");
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
