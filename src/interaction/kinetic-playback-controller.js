import { advanceKineticPlayback } from "./kinetic-playback.js";

export function createKineticPlaybackController({
  state,
  slider,
  playButton,
  updateWheel,
  prepareStart = () => {},
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = frameId => cancelAnimationFrame(frameId)
}) {
  if (!state || !slider || !playButton || typeof updateWheel !== "function") return null;

  function stop() {
    state.playing = false;
    state.lastAnimationTs = null;
    if (state.animationFrame) cancelFrame(state.animationFrame);
    state.animationFrame = null;
    playButton.textContent = "播放";
    playButton.setAttribute("aria-pressed", "false");
  }

  function tick(timestamp) {
    if (!state.playing) return;
    const playback = advanceKineticPlayback({
      scale: state.scale,
      selectedMs: state.selectedMs,
      anchorMs: state.anchorMs,
      previousTimestamp: state.lastAnimationTs,
      timestamp
    });
    if (state.lastAnimationTs !== null) {
      state.selectedMs = playback.selectedMs;
      slider.value = String(playback.offsetDays);
      updateWheel();
      if (playback.reachedEnd) {
        stop();
        return;
      }
    }
    state.lastAnimationTs = timestamp;
    state.animationFrame = requestFrame(tick);
  }

  function start() {
    prepareStart();
    state.playing = true;
    state.lastAnimationTs = null;
    playButton.textContent = "暫停";
    playButton.setAttribute("aria-pressed", "true");
    state.animationFrame = requestFrame(tick);
  }

  function toggle() {
    if (state.playing) stop();
    else start();
  }

  return Object.freeze({
    start,
    stop,
    toggle,
    get playing() { return Boolean(state.playing); }
  });
}
