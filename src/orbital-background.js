const DEFAULTS = Object.freeze({
  idleSpeedDegPerSec:0.42,
  inputToBackground:0.085,
  maxBackgroundSpeedDegPerSec:32,
  followRate:7.5,
  releaseRate:2.25,
  quietThresholdDegPerSec:0.8,
  idleTickMs:125,
  idleSettleEpsilonDegPerSec:0.04,
  maxFrameDeltaSec:0.05,
  maxIdleDeltaSec:0.25
});

const ORBIT_RADII_WORLD = Object.freeze([565, 695, 805, 945, 1105, 1265, 1395]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function monotonicNowMs() {
  const now = globalThis.performance?.now?.();
  return Number.isFinite(now) ? now : Date.now();
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
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = timerId => globalThis.clearTimeout(timerId),
  reducedMotionQuery = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null,
  ResizeObserverCtor = globalThis.ResizeObserver,
  MutationObserverCtor = globalThis.MutationObserver,
  options = {}
} = {}) {
  const field = root?.querySelector?.(".orbital-field");
  if (!root || !field || !instrument || !svg || !wheelCenter) return null;

  const config = Object.freeze({ ...DEFAULTS, ...options });
  let backgroundAngleDeg = 0;
  let backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
  let frameId = null;
  let idleTimerId = null;
  let lastTimestamp = null;
  let lastIdleTimestamp = null;
  let idleActivated = false;
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

  function wheelMotionActive() {
    return Boolean(instrument.dataset.dragRing);
  }

  function applyAngle() {
    field.style.transform = `rotate(${backgroundAngleDeg.toFixed(4)}deg)`;
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
    applyAngle();

    const settledToIdle = !wheelMotionActive()
      && !coupled
      && Math.abs(backgroundVelocityDegPerSec - config.idleSpeedDegPerSec)
        <= config.idleSettleEpsilonDegPerSec;
    if (settledToIdle) {
      backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
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
      field.style.transform = "none";
      return;
    }
    root.dataset.orbitalMotion = "active";
    backgroundVelocityDegPerSec = config.idleSpeedDegPerSec;
    if (wheelMotionActive()) startInteractiveFrame();
    else if (idleActivated) scheduleIdleTick();
  }

  function instrumentMotionChange() {
    if (destroyed || isReducedMotion()) return;
    if (wheelMotionActive()) startInteractiveFrame();
  }

  syncGeometry();
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
    get backgroundAngleDeg() { return backgroundAngleDeg; },
    get backgroundVelocityDegPerSec() { return backgroundVelocityDegPerSec; },
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
    }
  });
}
