export function createFrameCommitQueue({
  commit,
  requestFrame = typeof globalThis.requestAnimationFrame === "function"
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : null,
  cancelFrame = typeof globalThis.cancelAnimationFrame === "function"
    ? globalThis.cancelAnimationFrame.bind(globalThis)
    : null
} = {}) {
  if (typeof commit !== "function") throw new TypeError("commit must be a function");

  let pending = false;
  let frameId = null;
  let destroyed = false;

  function clearScheduledFrame() {
    if (frameId === null) return;
    if (typeof cancelFrame === "function") cancelFrame(frameId);
    frameId = null;
  }

  function run() {
    frameId = null;
    if (destroyed || !pending) return false;
    pending = false;
    commit();
    return true;
  }

  function schedule() {
    if (destroyed) return false;
    pending = true;
    if (frameId !== null) return false;

    if (typeof requestFrame !== "function") return run();
    const scheduledId = requestFrame(run);
    if (scheduledId === null || scheduledId === undefined) return run();
    frameId = scheduledId;
    return true;
  }

  function flush() {
    if (destroyed || !pending) return false;
    clearScheduledFrame();
    return run();
  }

  function cancel() {
    const hadPending = pending || frameId !== null;
    clearScheduledFrame();
    pending = false;
    return hadPending;
  }

  function destroy() {
    cancel();
    destroyed = true;
  }

  return Object.freeze({
    schedule,
    flush,
    cancel,
    destroy,
    get pending() { return pending; },
    get scheduled() { return frameId !== null; }
  });
}
