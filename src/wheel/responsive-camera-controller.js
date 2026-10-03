import { responsiveInstrumentCamera, viewBoxString } from "./camera.js";
import { setAttributeIfChanged } from "./svg-renderer.js";

// The SVG's rendered box can change without a window resize (dynamic viewport
// units, late CSS, or Tools layout). Never turn an unmeasurable startup box into
// a landscape camera, and keep following the actual box after it becomes ready.
export function createResponsiveCameraController({
  svg,
  instrument,
  center,
  outerRadius,
  onCameraChange = () => {},
  eventTarget = globalThis.window,
  visibilityTarget = globalThis.document,
  ResizeObserverCtor = globalThis.ResizeObserver,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id)
}) {
  let frameId = null;
  let cameraMode = null;
  let destroyed = false;

  function refresh() {
    if (destroyed) return null;
    const { width, height } = svg.getBoundingClientRect();
    const viewportWidth = eventTarget?.innerWidth;
    if (![width, height, viewportWidth].every(value => Number.isFinite(value) && value > 0)) return null;
    const camera = responsiveInstrumentCamera({
      center, outerRadius, viewportWidth, viewportAspect:width / height
    });
    const changed = setAttributeIfChanged(svg, "viewBox", viewBoxString(camera.viewBox));
    if (changed || cameraMode !== camera.mode) {
      cameraMode = camera.mode;
      onCameraChange(camera);
    }
    return camera;
  }

  function scheduleRefresh() {
    if (destroyed || frameId !== null) return;
    frameId = requestFrame(() => {
      frameId = null;
      refresh();
    });
  }

  function visibilityChanged() {
    if (!visibilityTarget?.hidden) scheduleRefresh();
  }

  const resizeObserver = typeof ResizeObserverCtor === "function"
    ? new ResizeObserverCtor(scheduleRefresh) : null;
  resizeObserver?.observe(svg);
  if (instrument) resizeObserver?.observe(instrument);
  eventTarget?.addEventListener("resize", scheduleRefresh, { passive:true });
  eventTarget?.addEventListener("pageshow", scheduleRefresh, { passive:true });
  eventTarget?.visualViewport?.addEventListener("resize", scheduleRefresh, { passive:true });
  visibilityTarget?.addEventListener("visibilitychange", visibilityChanged);
  refresh();
  scheduleRefresh();

  return Object.freeze({
    refresh,
    destroy() {
      destroyed = true;
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
      resizeObserver?.disconnect();
      eventTarget?.removeEventListener("resize", scheduleRefresh);
      eventTarget?.removeEventListener("pageshow", scheduleRefresh);
      eventTarget?.visualViewport?.removeEventListener("resize", scheduleRefresh);
      visibilityTarget?.removeEventListener("visibilitychange", visibilityChanged);
    }
  });
}
