const DEFAULTS = Object.freeze({
  idleSpeedDegPerSec:0.42,
  inputToBackground:0.085,
  maxBackgroundSpeedDegPerSec:32,
  followRate:7.5,
  releaseRate:2.25,
  quietThresholdDegPerSec:0.8,
  maxFrameDeltaSec:0.05
});

const ORBIT_RADII_WORLD = Object.freeze([565, 695, 805, 945, 1105, 1265, 1395]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function orbitalTargetVelocityDegPerSec(
  wheelAngularVelocityDegPerSec,
  {
    idleSpeedDegPerSec = DEFAULTS.idleSpeedDegPerSec,
    inputToBackground = DEFAULTS.inputToBackground,
    maxBackgroundSpeedDegPerSec = DEFAULTS.maxBackgroundSpeedDegPerSec,
    quietThresholdDegPerSec = DEFAULTS.quietThresholdDegPerSec
  } = {}
) {
  const wheelVelocity = Number.isFinite(wheelAngularVelocityDegPerSec)
    ? wheelAngularVelocityDegPerSec
    : 0;
  if (Math.abs(wheelVelocity) < quietThresholdDegPerSec) return idleSpeedDegPerSec;
  return clamp(
    wheelVelocity * inputToBackground,
    -maxBackgroundSpeedDegPerSec,
    maxBackgroundSpeedDegPerSec
  );
}

export function stepOrbitalVelocityDegPerSec(
  currentVelocityDegPerSec,
  targetVelocityDegPerSec,
  deltaTimeSec,
  responseRate
) {
  if (!Number.isFinite(currentVelocityDegPerSec)
    || !Number.isFinite(targetVelocityDegPerSec)
    || !Number.isFinite(deltaTimeSec)
    || !Number.isFinite(responseRate)
    || deltaTimeSec < 0
    || responseRate < 0) {
    throw new RangeError("orbital velocity step inputs must be finite and non-negative where applicable");
  }
  const blend = 1 - Math.exp(-responseRate * deltaTimeSec);
  return currentVelocityDegPerSec
    + (targetVelocityDegPerSec - currentVelocityDegPerSec) * blend;
}

export function orbitalViewportGeometry({
  width,
  height,
  viewBoxWidth,
  viewBoxHeight,
  wheelCenter
}) {
  if (![width, height, viewBoxWidth, viewBoxHeight, wheelCenter?.x, wheelCenter?.y]
    .every(Number.isFinite)) {
    throw new RangeError("orbital viewport geometry inputs must be finite");
  }
  if (width <= 0 || height <= 0 || viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    throw new RangeError("orbital viewport dimensions must be positive");
  }

  const scale = Math.min(width / viewBoxWidth, height / viewBoxHeight);
  const offsetX = (width - viewBoxWidth * scale) / 2;
  const offsetY = (height - viewBoxHeight * scale) / 2;
  return Object.freeze({
    scale,
    centerX:offsetX + wheelCenter.x * scale,
    centerY:offsetY + wheelCenter.y * scale
  });
}

export function createOrbitalBackground({
  root,
  instrument,
  svg,
  wheelCenter,
  getWheelAngularVelocityDegPerSec = () => 0,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = frameId => globalThis.cancelAnimationFrame(frameId),
  reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null,
  ResizeObserverCtor = globalThis.ResizeObserver,
  options = {}
} = {}) {
  const field = root?.querySelector?.(".orbital-field");
  if (!root || !field || !instrument || !svg || !wheelCenter) return null;

  const config = Object.freeze({ ...DEFAULTS, ...options });
  field.style.transformOrigin = `${wheelCenter.x}px ${wheelCenter.y}px`;
  let backgroundAngleDeg = 0;
  let backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
  let frameId = null;
  let lastTimestamp = null;
  let destroyed = false;

  function syncGeometry() {
    const rect = instrument.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;
    if (!viewBox || rect.width <= 0 || rect.height <= 0) return;
    const geometry = orbitalViewportGeometry({
      width:rect.width,
      height:rect.height,
      viewBoxWidth:viewBox.width,
      viewBoxHeight:viewBox.height,
      wheelCenter
    });

    root.style.setProperty("--orbital-center-x", `${geometry.centerX.toFixed(3)}px`);
    root.style.setProperty("--orbital-center-y", `${geometry.centerY.toFixed(3)}px`);
    ORBIT_RADII_WORLD.forEach((radius, index) => {
      root.style.setProperty(
        `--orbital-r${index + 1}`,
        `${(radius * geometry.scale).toFixed(3)}px`
      );
    });
  }

  function isReducedMotion() {
    return Boolean(reducedMotionQuery?.matches);
  }

  function stopFrame() {
    if (frameId !== null) cancelFrame?.(frameId);
    frameId = null;
    lastTimestamp = null;
  }

  function renderFrame(timestamp) {
    frameId = null;
    if (destroyed || isReducedMotion()) return;

    if (!Number.isFinite(lastTimestamp)) lastTimestamp = timestamp;
    const deltaTimeSec = clamp(
      (timestamp - lastTimestamp) / 1000,
      0,
      config.maxFrameDeltaSec
    );
    lastTimestamp = timestamp;

    const wheelVelocity = Number(getWheelAngularVelocityDegPerSec?.()) || 0;
    const coupled = Math.abs(wheelVelocity) >= config.quietThresholdDegPerSec;
    const targetVelocity = orbitalTargetVelocityDegPerSec(wheelVelocity, config);
    const waking = coupled && (
      Math.abs(targetVelocity) >= Math.abs(backgroundVelocityDegPerSec)
      || Math.sign(targetVelocity) !== Math.sign(backgroundVelocityDegPerSec)
    );
    const responseRate = waking ? config.followRate : config.releaseRate;

    backgroundVelocityDegPerSec = stepOrbitalVelocityDegPerSec(
      backgroundVelocityDegPerSec,
      targetVelocity,
      deltaTimeSec,
      responseRate
    );
    backgroundAngleDeg = (backgroundAngleDeg + backgroundVelocityDegPerSec * deltaTimeSec) % 360;
    field.style.transform = `rotate(${backgroundAngleDeg.toFixed(4)}deg)`;

    frameId = requestFrame(renderFrame);
  }

  function startFrame() {
    if (destroyed || isReducedMotion() || frameId !== null) return;
    frameId = requestFrame(renderFrame);
  }

  function applyMotionPreference() {
    stopFrame();
    if (isReducedMotion()) {
      root.dataset.orbitalMotion = "reduced";
      backgroundVelocityDegPerSec = 0;
      field.style.transform = "none";
      return;
    }
    root.dataset.orbitalMotion = "active";
    backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
    startFrame();
  }

  syncGeometry();
  const resizeObserver = typeof ResizeObserverCtor === "function"
    ? new ResizeObserverCtor(syncGeometry)
    : null;
  resizeObserver?.observe?.(instrument);
  reducedMotionQuery?.addEventListener?.("change", applyMotionPreference);
  applyMotionPreference();

  return Object.freeze({
    syncGeometry,
    get backgroundAngleDeg() { return backgroundAngleDeg; },
    get backgroundVelocityDegPerSec() { return backgroundVelocityDegPerSec; },
    destroy() {
      destroyed = true;
      stopFrame();
      resizeObserver?.disconnect?.();
      reducedMotionQuery?.removeEventListener?.("change", applyMotionPreference);
      delete root.dataset.orbitalMotion;
      field.style.transform = "";
    }
  });
}
