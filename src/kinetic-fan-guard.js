import {
  FAN,
  RADII,
  TRACK_IDS,
  WHEEL_CENTER,
  assertWheelModel
} from "./wheel/ring-model.js";
import { fanSectorPath } from "./wheel/polar-geometry.js";
import { instrumentViewBox, viewBoxString } from "./wheel/camera.js";
import { SVG_NS } from "./wheel/svg-renderer.js";

const CLIP_ID = "kinetic-master-fan-clip";
const WRAPPER_ID = "kinetic-fan-layer";
const MOBILE_QUERY = "(max-width: 480px)";
const CLIP_MARGIN = 28;

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");

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
    fanSectorPath(WHEEL_CENTER, RADII.zodiacOuter + CLIP_MARGIN, FAN.start, FAN.end)
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

  const camera = instrumentViewBox({
    center: WHEEL_CENTER,
    outerRadius: RADII.zodiacOuter
  });
  svg.setAttribute("viewBox", viewBoxString(camera));

  instrument.dataset.masterGeometry = "shared-fan";
  instrument.dataset.fanClip = "active";
  instrument.dataset.geometrySource = "wheel-core";
  instrument.dataset.geometryCenter = `${WHEEL_CENTER.x.toFixed(3)},${WHEEL_CENTER.y.toFixed(3)}`;
  instrument.dataset.geometryFanStart = FAN.start.toFixed(3);
  instrument.dataset.geometryFanEnd = FAN.end.toFixed(3);
  instrument.dataset.geometryInnerRadius = RADII.inner.toFixed(3);
  instrument.dataset.geometryOuterRadius = RADII.zodiacOuter.toFixed(3);
  instrument.dataset.geometryRadiusRatio = (RADII.inner / RADII.zodiacOuter).toFixed(4);
  instrument.dataset.geometryCameraY = camera.y.toFixed(3);
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
