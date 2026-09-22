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
  "uniform sampler2D u_roughness_field;",
  "out vec4 out_color;",
  "",
  "const float PI = 3.141592653589793;",
  "const float FIELD_PERIOD = 96.0;",
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
  "float fieldAt(vec2 localPoint) {",
  "  return texture(u_roughness_field, localPoint / FIELD_PERIOD).r;",
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
  "  int index = ringIndex(radius);",
  "  if (index < 0) discard;",
  "",
  "  float ringRotation = componentAt(u_rotations, index) * PI / 180.0;",
  "  vec2 localPoint = rotation(-ringRotation) * point;",
  "  float field = fieldAt(localPoint);",
  "  float fieldCentered = field - 0.5;",
  "  vec3 lightDirection = normalize(vec3(-0.42, -0.56, 0.714));",
  "  vec2 environmentDirection = normalize(lightDirection.xy);",
  "  float environmentCoordinate = dot(point / vec2(600.0, 380.0), environmentDirection);",
  "  float reflectionBand = exp(-pow((environmentCoordinate + 0.08) / 0.68, 2.0));",
  "  float environmentResponse = 0.06 + reflectionBand * 0.94;",
  "  float grainResponse = clamp(1.0 + fieldCentered * 0.90, 0.55, 1.45);",
  "",
  "  float innerRadius = componentAt(u_inner_radii, index);",
  "  float outerRadius = componentAt(u_outer_radii, index);",
  "  float edgeDistance = min(radius - innerRadius, outerRadius - radius);",
  "",
  "  vec3 reflectionTint = vec3(0.80, 0.84, 0.86);",
  "  float edgeMask = smoothstep(0.0, 1.25, edgeDistance);",
  "  float overlayAlpha = edgeMask * clamp((0.005 + environmentResponse * 0.080) * grainResponse, 0.0, 0.110);",
  "  out_color = vec4(reflectionTint * overlayAlpha, overlayAlpha);",
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
  const innerRadii = new Float32Array(geometry.map(item => item.innerRadius));
  const outerRadii = new Float32Array(geometry.map(item => item.outerRadius));
  const rotations = new Float32Array(MATERIAL_RING_IDS.length);

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
    draw();
  }

  return Object.freeze({
    mode: requestedMode,
    initialize,
    updateFrame,
    isActive: () => active
  });
}
