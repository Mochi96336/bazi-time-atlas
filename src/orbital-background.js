const DEFAULTS = Object.freeze({
  idleSpeedDegPerSec:0.42,
  inputToBackground:0.085,
  maxBackgroundSpeedDegPerSec:32,
  followRate:7.5,
  releaseRate:2.25,
  quietThresholdDegPerSec:0.8,
  energyThresholdDegPerSec:25,
  energyFullDegPerSec:220,
  energyFollowRate:9.5,
  energyReleaseRate:3.0,
  energySettleEpsilon:0.012,
  occlusionPaddingWorld:18,
  idleTickMs:125,
  idleSettleEpsilonDegPerSec:0.04,
  maxFrameDeltaSec:0.05,
  maxIdleDeltaSec:0.25
});

const ORBIT_RADIUS_MULTIPLIERS = Object.freeze([1.035, 1.088, 1.155, 1.242, 1.355, 1.495]);
const VEIL_RADIUS_MULTIPLIERS = Object.freeze([1.066, 1.225, 1.425]);
const VEIL_PROFILES = Object.freeze([
  Object.freeze({ idleWidth:0.85, hotWidth:5.20, idleOpacity:0.27, hotOpacity:0.92 }),
  Object.freeze({ idleWidth:1.10, hotWidth:3.60, idleOpacity:0.22, hotOpacity:0.74 }),
  Object.freeze({ idleWidth:1.30, hotWidth:2.80, idleOpacity:0.17, hotOpacity:0.54 })
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function monotonicNowMs() {
  const now = globalThis.performance?.now?.();
  return Number.isFinite(now) ? now : Date.now();
}

export function createOrbitalSourceVelocityTracker({
  staleAfterMs = 90,
  minimumSampleMs = 4,
  nowMs = monotonicNowMs
} = {}) {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0
    || !Number.isFinite(minimumSampleMs) || minimumSampleMs < 0
    || typeof nowMs !== "function") {
    throw new RangeError("orbital source velocity tracker options are invalid");
  }

  let sampleAngleDeg = null;
  let sampleTimeMs = null;
  let lastObservationTimeMs = null;
  let velocityDegPerSec = 0;

  function observe(rotationDeg, timestampMs = nowMs()) {
    if (!Number.isFinite(rotationDeg) || !Number.isFinite(timestampMs)) return velocityDegPerSec;
    lastObservationTimeMs = timestampMs;

    if (!Number.isFinite(sampleAngleDeg) || !Number.isFinite(sampleTimeMs)) {
      sampleAngleDeg = rotationDeg;
      sampleTimeMs = timestampMs;
      velocityDegPerSec = 0;
      return velocityDegPerSec;
    }

    const deltaTimeMs = timestampMs - sampleTimeMs;
    if (deltaTimeMs <= 0 || deltaTimeMs < minimumSampleMs) return velocityDegPerSec;

    velocityDegPerSec = (rotationDeg - sampleAngleDeg) / deltaTimeMs * 1000;
    sampleAngleDeg = rotationDeg;
    sampleTimeMs = timestampMs;
    return velocityDegPerSec;
  }

  function current(timestampMs = nowMs()) {
    if (!Number.isFinite(timestampMs) || !Number.isFinite(lastObservationTimeMs)) return 0;
    if (timestampMs - lastObservationTimeMs > staleAfterMs) return 0;
    return Number.isFinite(velocityDegPerSec) ? velocityDegPerSec : 0;
  }

  function reset() {
    sampleAngleDeg = null;
    sampleTimeMs = null;
    lastObservationTimeMs = null;
    velocityDegPerSec = 0;
  }

  return Object.freeze({
    observe,
    current,
    reset,
    get velocityDegPerSec() { return velocityDegPerSec; }
  });
}

export function orbitalRadiiWorld(wheelOuterRadius) {
  if (!Number.isFinite(wheelOuterRadius) || wheelOuterRadius <= 0) {
    throw new RangeError("wheel outer radius must be a positive finite number");
  }
  return Object.freeze(
    ORBIT_RADIUS_MULTIPLIERS.map(multiplier => wheelOuterRadius * multiplier)
  );
}

export function orbitalOcclusionRadiusWorld(
  wheelOuterRadius,
  paddingWorld = DEFAULTS.occlusionPaddingWorld
) {
  if (!Number.isFinite(wheelOuterRadius) || wheelOuterRadius <= 0
    || !Number.isFinite(paddingWorld) || paddingWorld < 0) {
    throw new RangeError("orbital occlusion inputs must be finite and non-negative");
  }
  return wheelOuterRadius + paddingWorld;
}

export function orbitalKineticIntensity(
  wheelAngularVelocityDegPerSec,
  {
    energyThresholdDegPerSec = DEFAULTS.energyThresholdDegPerSec,
    energyFullDegPerSec = DEFAULTS.energyFullDegPerSec
  } = {}
) {
  const speed = Math.abs(Number.isFinite(wheelAngularVelocityDegPerSec)
    ? wheelAngularVelocityDegPerSec
    : 0);
  if (!(energyFullDegPerSec > energyThresholdDegPerSec)) {
    throw new RangeError("orbital energy full speed must exceed threshold");
  }
  const linear = clamp(
    (speed - energyThresholdDegPerSec)
      / (energyFullDegPerSec - energyThresholdDegPerSec),
    0,
    1
  );
  return linear * linear * (3 - 2 * linear);
}

export function orbitalVeilPresentation(index, intensity) {
  const profile = VEIL_PROFILES[index];
  if (!profile || !Number.isFinite(intensity)) {
    throw new RangeError("orbital veil presentation inputs are invalid");
  }
  const t = clamp(intensity, 0, 1);
  return Object.freeze({
    strokeWidth:profile.idleWidth + (profile.hotWidth - profile.idleWidth) * t,
    opacity:profile.idleOpacity + (profile.hotOpacity - profile.idleOpacity) * t
  });
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
  wheelOuterRadius,
  getSourceAngularVelocityDegPerSec = () => 0,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = frameId => globalThis.cancelAnimationFrame(frameId),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = timerId => globalThis.clearTimeout(timerId),
  reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null,
  ResizeObserverCtor = globalThis.ResizeObserver,
  MutationObserverCtor = globalThis.MutationObserver,
  options = {}
} = {}) {
  const orbitalSpace = root?.querySelector?.(".orbital-space");
  const field = root?.querySelector?.(".orbital-field");
  const staticRings = Array.from(root?.querySelectorAll?.(".orbital-static-ring") ?? []);
  const veils = Array.from(root?.querySelectorAll?.(".orbital-veil") ?? []);
  const occlusionDisc = root?.querySelector?.(".orbital-occlusion-disc");
  if (!root || !orbitalSpace || !field || !occlusionDisc || !instrument || !svg || !wheelCenter
    || staticRings.length !== ORBIT_RADIUS_MULTIPLIERS.length
    || veils.length !== VEIL_RADIUS_MULTIPLIERS.length
    || !Number.isFinite(wheelOuterRadius) || wheelOuterRadius <= 0) return null;

  const config = Object.freeze({ ...DEFAULTS, ...options });
  const orbitRadiiWorld = orbitalRadiiWorld(wheelOuterRadius);
  const veilRadiiWorld = VEIL_RADIUS_MULTIPLIERS.map(
    multiplier => wheelOuterRadius * multiplier
  );
  const occlusionRadiusWorld = orbitalOcclusionRadiusWorld(
    wheelOuterRadius,
    config.occlusionPaddingWorld
  );

  let backgroundAngleDeg = 0;
  let backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
  let kineticIntensity = 0;
  let frameId = null;
  let idleTimerId = null;
  let lastTimestamp = null;
  let lastIdleTimestamp = null;
  let idleActivated = false;
  let destroyed = false;

  function setCircleGeometry(circle, radius) {
    circle.setAttribute("cx", String(wheelCenter.x));
    circle.setAttribute("cy", String(wheelCenter.y));
    circle.setAttribute("r", radius.toFixed(3));
  }

  function syncWorldGeometry() {
    field.style.transformOrigin = `${wheelCenter.x}px ${wheelCenter.y}px`;
    staticRings.forEach((ring, index) => setCircleGeometry(ring, orbitRadiiWorld[index]));
    veils.forEach((veil, index) => setCircleGeometry(veil, veilRadiiWorld[index]));
    setCircleGeometry(occlusionDisc, occlusionRadiusWorld);
  }

  function syncGeometry() {
    const viewBox = svg.getAttribute?.("viewBox");
    if (viewBox) orbitalSpace.setAttribute("viewBox", viewBox);
    const preserveAspectRatio = svg.getAttribute?.("preserveAspectRatio") || "xMidYMid meet";
    orbitalSpace.setAttribute("preserveAspectRatio", preserveAspectRatio);
    syncWorldGeometry();
  }

  function isReducedMotion() {
    return Boolean(reducedMotionQuery?.matches);
  }

  function wheelMotionActive() {
    return Boolean(instrument.dataset.dragRing);
  }

  function applyAngle() {
    field.style.transform = `rotate(${backgroundAngleDeg.toFixed(4)}deg)`;
  }

  function applyEnergy(intensity) {
    veils.forEach((veil, index) => {
      const presentation = orbitalVeilPresentation(index, intensity);
      veil.style.strokeWidth = `${presentation.strokeWidth.toFixed(3)}px`;
      veil.style.opacity = presentation.opacity.toFixed(3);
    });
  }

  function stopFrame() {
    if (frameId !== null) cancelFrame?.(frameId);
    frameId = null;
    lastTimestamp = null;
  }

  function stopIdleTimer() {
    if (idleTimerId !== null) clearTimer?.(idleTimerId);
    idleTimerId = null;
    lastIdleTimestamp = null;
  }

  function scheduleIdleTick(delayMs = config.idleTickMs) {
    if (destroyed || isReducedMotion() || idleTimerId !== null || frameId !== null) return;
    if (!Number.isFinite(lastIdleTimestamp)) lastIdleTimestamp = monotonicNowMs();
    idleTimerId = setTimer(idleTick, delayMs);
  }

  function idleTick() {
    idleTimerId = null;
    if (destroyed || isReducedMotion() || frameId !== null) return;
    if (wheelMotionActive()) {
      startInteractiveFrame();
      return;
    }

    const now = monotonicNowMs();
    const deltaTimeSec = clamp(
      (now - lastIdleTimestamp) / 1000,
      0,
      config.maxIdleDeltaSec
    );
    lastIdleTimestamp = now;
    backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
    backgroundAngleDeg = (backgroundAngleDeg + backgroundVelocityDegPerSec * deltaTimeSec) % 360;
    applyAngle();
    scheduleIdleTick();
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

    const sourceVelocity = Number(getSourceAngularVelocityDegPerSec?.()) || 0;
    const coupled = Math.abs(sourceVelocity) >= config.quietThresholdDegPerSec;
    const targetVelocity = orbitalTargetVelocityDegPerSec(sourceVelocity, config);
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
    applyAngle();

    const targetIntensity = orbitalKineticIntensity(sourceVelocity, config);
    const energyRate = targetIntensity > kineticIntensity
      ? config.energyFollowRate
      : config.energyReleaseRate;
    kineticIntensity = stepOrbitalVelocityDegPerSec(
      kineticIntensity,
      targetIntensity,
      deltaTimeSec,
      energyRate
    );
    applyEnergy(kineticIntensity);

    const settledToIdle = !wheelMotionActive()
      && !coupled
      && Math.abs(backgroundVelocityDegPerSec - config.idleSpeedDegPerSec)
        <= config.idleSettleEpsilonDegPerSec
      && kineticIntensity <= config.energySettleEpsilon;
    if (settledToIdle) {
      backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
      kineticIntensity = 0;
      applyEnergy(0);
      lastTimestamp = null;
      delete root.dataset.orbitalKinetic;
      if (idleActivated) scheduleIdleTick();
      return;
    }

    frameId = requestFrame(renderFrame);
  }

  function startInteractiveFrame() {
    if (destroyed || isReducedMotion() || frameId !== null) return;
    stopIdleTimer();
    root.dataset.orbitalKinetic = "true";
    frameId = requestFrame(renderFrame);
  }

  function activateIdleMotion() {
    if (destroyed || isReducedMotion()) return;
    idleActivated = true;
    if (!wheelMotionActive() && frameId === null) scheduleIdleTick();
  }

  function applyMotionPreference() {
    stopFrame();
    stopIdleTimer();
    if (isReducedMotion()) {
      root.dataset.orbitalMotion = "reduced";
      delete root.dataset.orbitalKinetic;
      backgroundVelocityDegPerSec = 0;
      kineticIntensity = 0;
      field.style.transform = "none";
      applyEnergy(0);
      return;
    }
    root.dataset.orbitalMotion = "active";
    backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
    kineticIntensity = 0;
    applyEnergy(0);
    if (wheelMotionActive()) startInteractiveFrame();
    else if (idleActivated) scheduleIdleTick();
  }

  function instrumentMotionChange() {
    if (destroyed || isReducedMotion()) return;
    if (wheelMotionActive()) startInteractiveFrame();
  }

  function sourceMotionChanged() {
    if (destroyed || isReducedMotion()) return;
    startInteractiveFrame();
  }

  syncGeometry();
  applyEnergy(0);

  const resizeObserver = typeof ResizeObserverCtor === "function"
    ? new ResizeObserverCtor(syncGeometry)
    : null;
  resizeObserver?.observe?.(instrument);

  const motionObserver = typeof MutationObserverCtor === "function"
    ? new MutationObserverCtor(instrumentMotionChange)
    : null;
  motionObserver?.observe?.(instrument, {
    attributes:true,
    attributeFilter:["data-drag-ring"]
  });

  instrument.addEventListener?.("pointermove", activateIdleMotion, { passive:true });
  instrument.addEventListener?.("pointerdown", activateIdleMotion, { passive:true });
  instrument.addEventListener?.("touchstart", activateIdleMotion, { passive:true });
  reducedMotionQuery?.addEventListener?.("change", applyMotionPreference);
  applyMotionPreference();

  return Object.freeze({
    syncGeometry,
    sourceMotionChanged,
    get backgroundAngleDeg() { return backgroundAngleDeg; },
    get backgroundVelocityDegPerSec() { return backgroundVelocityDegPerSec; },
    get kineticIntensity() { return kineticIntensity; },
    get occlusionRadiusWorld() { return occlusionRadiusWorld; },
    destroy() {
      destroyed = true;
      stopFrame();
      stopIdleTimer();
      resizeObserver?.disconnect?.();
      motionObserver?.disconnect?.();
      instrument.removeEventListener?.("pointermove", activateIdleMotion);
      instrument.removeEventListener?.("pointerdown", activateIdleMotion);
      instrument.removeEventListener?.("touchstart", activateIdleMotion);
      reducedMotionQuery?.removeEventListener?.("change", applyMotionPreference);
      delete root.dataset.orbitalMotion;
      delete root.dataset.orbitalKinetic;
      field.style.transform = "";
      veils.forEach(veil => {
        veil.style.strokeWidth = "";
        veil.style.opacity = "";
      });
    }
  });
}
