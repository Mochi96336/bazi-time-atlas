function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
}

export function createDeltaPlaybackController({
  playButton,
  playIcon,
  playLabel,
  getDelta,
  setDelta,
  maxDelta,
  yearsPerSecond = 20,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  onPlayingChange = () => {},
  onStop = () => {}
} = {}) {
  assertFunction(getDelta, "getDelta");
  assertFunction(setDelta, "setDelta");
  assertFunction(maxDelta, "maxDelta");
  assertFunction(requestFrame, "requestFrame");
  assertFunction(cancelFrame, "cancelFrame");
  assertFunction(onPlayingChange, "onPlayingChange");
  assertFunction(onStop, "onStop");
  if (!Number.isFinite(yearsPerSecond) || yearsPerSecond <= 0) {
    throw new RangeError("yearsPerSecond must be positive");
  }

  let playing = false;
  let frameId = null;
  let startedAt = null;
  let startDelta = 0;
  let lastDelta = null;

  function syncButton() {
    if (playButton) {
      playButton.setAttribute("aria-pressed", String(playing));
      playButton.setAttribute("aria-label", playing ? "暫停時間推演" : "播放時間推演");
      playButton.setAttribute("title", playing ? "暫停時間推演" : "播放時間推演");
    }
    if (playLabel) playLabel.textContent = playing ? "暫停" : "播放";
    if (playIcon) playIcon.textContent = playing ? "Ⅱ" : "▶";
    onPlayingChange(playing);
  }

  function stop({ commit = true } = {}) {
    const wasPlaying = playing;
    playing = false;
    startedAt = null;
    startDelta = 0;
    lastDelta = null;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    syncButton();
    if (wasPlaying) onStop({ commit });
  }

  function tick(timestamp) {
    if (!playing) return;
    if (startedAt === null) startedAt = timestamp;
    const limit = Math.max(0, Math.floor(Number(maxDelta()) || 0));
    const elapsedSeconds = Math.max(0, timestamp - startedAt) / 1000;
    const next = Math.min(
      limit,
      startDelta + Math.floor(elapsedSeconds * yearsPerSecond)
    );
    if (next !== lastDelta) {
      setDelta(next, { source:"playback", syncQuery:false });
      lastDelta = next;
    }
    if (next >= limit) {
      stop({ commit:true });
      return;
    }
    frameId = requestFrame(tick);
  }

  function start() {
    if (playing) return;
    const limit = Math.max(0, Math.floor(Number(maxDelta()) || 0));
    let current = Math.max(0, Math.floor(Number(getDelta()) || 0));
    if (current >= limit) {
      setDelta(0, { source:"playback-reset", syncQuery:true });
      current = 0;
    }
    playing = true;
    startedAt = null;
    startDelta = current;
    lastDelta = current;
    syncButton();
    frameId = requestFrame(tick);
  }

  function toggle() {
    if (playing) stop({ commit:true });
    else start();
  }

  syncButton();

  return {
    start,
    stop,
    toggle,
    get playing() { return playing; }
  };
}
