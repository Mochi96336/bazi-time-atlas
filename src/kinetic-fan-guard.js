import {
  FAN,
  RADII,
  TRACK_IDS,
  WHEEL_CENTER,
  assertWheelModel
} from "./wheel/ring-model.js";
import { fanSectorPath } from "./wheel/polar-geometry.js";
import { responsiveInstrumentCamera, viewBoxString } from "./wheel/camera.js";
import { SVG_NS } from "./wheel/svg-renderer.js";

const CLIP_ID = "kinetic-master-fan-clip";
const WRAPPER_ID = "kinetic-fan-layer";
const MOBILE_QUERY = "(max-width: 480px)";
// Cursor label sits 40 world units outside the slowest outer ring. Keep enough
// radial headroom while enforcing the same fixed angular fan on all overlays.
const CLIP_MARGIN = 58;

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");

function applyResponsiveCamera() {
  if (!svg || !instrument) return null;
  const bounds = svg.getBoundingClientRect();
  const viewportAspect = bounds.width > 0 && bounds.height > 0
    ? bounds.width / bounds.height
    : 1200 / 760;
  const camera = responsiveInstrumentCamera({
    center: WHEEL_CENTER,
    outerRadius: RADII.outer,
    viewportWidth: window.innerWidth,
    viewportAspect
  });
  svg.setAttribute("viewBox", viewBoxString(camera.viewBox));
  instrument.dataset.geometryCameraMode = camera.mode;
  instrument.dataset.geometryCameraZoom = camera.zoom.toFixed(4);
  instrument.dataset.geometryCameraX = camera.viewBox.x.toFixed(3);
  instrument.dataset.geometryCameraY = camera.viewBox.y.toFixed(3);
  instrument.dataset.geometryCameraWidth = camera.viewBox.width.toFixed(3);
  instrument.dataset.geometryCameraHeight = camera.viewBox.height.toFixed(3);
  instrument.dataset.geometryCameraAspect = camera.viewportAspect.toFixed(4);
  instrument.dataset.geometryCameraOriginGap = camera.originGap.toFixed(3);
  instrument.dataset.geometryCameraOriginGapRatio = camera.originGapRatio.toFixed(4);
  instrument.dataset.geometryCameraInnerBlank = (RADII.inner - camera.originGap).toFixed(3);
  instrument.dataset.geometryCameraInnerBlankRatio = ((RADII.inner - camera.originGap) / RADII.outer).toFixed(4);
  return camera;
}

function installMasterFanClip() {
  if (!svg || !instrument) return false;
  assertWheelModel();

  const tracks = TRACK_IDS.map(id => document.querySelector(`#${id}`));
  if (tracks.some(track => !track || !track.querySelector("path"))) return false;

  let defs = svg.querySelector("defs[data-kinetic-master-geometry]");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    defs.dataset.kineticMasterGeometry = "true";
    svg.prepend(defs);
  }

  let clip = svg.querySelector(`#${CLIP_ID}`);
  if (!clip) {
    clip = document.createElementNS(SVG_NS, "clipPath");
    clip.id = CLIP_ID;
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    defs.appendChild(clip);
  }

  let clipPath = clip.querySelector("path");
  if (!clipPath) {
    clipPath = document.createElementNS(SVG_NS, "path");
    clip.appendChild(clipPath);
  }
  clipPath.setAttribute(
    "d",
    fanSectorPath(WHEEL_CENTER, RADII.outer + CLIP_MARGIN, FAN.start, FAN.end)
  );

  let wrapper = svg.querySelector(`#${WRAPPER_ID}`);
  if (!wrapper) {
    wrapper = document.createElementNS(SVG_NS, "g");
    wrapper.id = WRAPPER_ID;
    wrapper.setAttribute("clip-path", `url(#${CLIP_ID})`);
    document.querySelector("#guide-layer")?.insertAdjacentElement("afterend", wrapper);
  }

  tracks.forEach(track => {
    wrapper.appendChild(track);
    track.dataset.fanClipped = "true";
  });

  // The wrapper owns the fixed screen-space aperture. Rings rotate inside it,
  // and relative-frame overlays must do the same: clipping a transformed cursor
  // on the cursor node itself would make transform/clip coordinate ownership
  // browser-sensitive. Moving both overlays under the untransformed wrapper keeps
  // the fan fixed while the cursor can rotate freely inside it.
  [svg.querySelector("#motion-layer"), svg.querySelector("#cursor-layer")]
    .filter(Boolean)
    .forEach(layer => {
      layer.removeAttribute("clip-path");
      wrapper.appendChild(layer);
      layer.dataset.fanClipped = "true";
      layer.dataset.fanClipOwner = WRAPPER_ID;
    });

  applyResponsiveCamera();

  instrument.dataset.masterGeometry = "shared-fan";
  instrument.dataset.fanClip = "active";
  instrument.dataset.geometrySource = "wheel-core";
  instrument.dataset.geometryCenter = `${WHEEL_CENTER.x.toFixed(3)},${WHEEL_CENTER.y.toFixed(3)}`;
  instrument.dataset.geometryFanStart = FAN.start.toFixed(3);
  instrument.dataset.geometryFanEnd = FAN.end.toFixed(3);
  instrument.dataset.geometryInnerRadius = RADII.inner.toFixed(3);
  instrument.dataset.geometryOuterRadius = RADII.outer.toFixed(3);
  instrument.dataset.geometryRadiusRatio = (RADII.inner / RADII.outer).toFixed(4);
  instrument.dataset.geometryRadialDepth = (RADII.outer - RADII.inner).toFixed(3);
  instrument.dataset.geometryRadialDepthRatio = ((RADII.outer - RADII.inner) / RADII.outer).toFixed(4);
  return true;
}

function recordCompositionDiagnostics() {
  if (!instrument) return;
  const mediaMatched = window.matchMedia(MOBILE_QUERY).matches;
  instrument.dataset.mobileInnerWidth = String(Math.round(window.innerWidth));
  instrument.dataset.mobileMediaMatched = String(mediaMatched);
  if (!mediaMatched) return;

  const rect = instrument.getBoundingClientRect();
  const secondary = [".timeline-dock", ".state-strip", ".atlas-notes", ".sources-panel"]
    .map(selector => document.querySelector(selector))
    .filter(Boolean);
  const hidden = secondary.every(node => getComputedStyle(node).display === "none");
  const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const viewportHeight = window.innerHeight;
  instrument.dataset.mobileViewportFit = String(scrollHeight <= viewportHeight + 2);
  instrument.dataset.mobileViewportHeight = String(Math.round(viewportHeight));
  instrument.dataset.mobileScrollHeight = String(Math.round(scrollHeight));
  instrument.dataset.mobileInstrumentShare = viewportHeight > 0 ? (rect.height / viewportHeight).toFixed(3) : "0.000";
  instrument.dataset.mobileSecondaryHidden = String(hidden);
}

function refreshCompositionDiagnostics() {
  applyResponsiveCamera();
  recordCompositionDiagnostics();
  queueMicrotask(recordCompositionDiagnostics);
  requestAnimationFrame(recordCompositionDiagnostics);
  setTimeout(recordCompositionDiagnostics, 50);
}

function boot(attempt = 0) {
  if (installMasterFanClip()) {
    refreshCompositionDiagnostics();
    return;
  }
  if (attempt < 12) requestAnimationFrame(() => boot(attempt + 1));
}

boot();
window.addEventListener("resize", refreshCompositionDiagnostics, { passive: true });
