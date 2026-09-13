const NS = "http://www.w3.org/2000/svg";
const TRACK_IDS = ["year-track", "month-track", "day-track", "solar-track", "zodiac-track"];
const CLIP_ID = "kinetic-master-fan-clip";
const WRAPPER_ID = "kinetic-fan-layer";

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");

function parseRotationCenter(group) {
  const transform = group?.getAttribute("transform") ?? "";
  const match = /rotate\([^\s,)]+[\s,]+(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\)/.exec(transform);
  if (!match) return null;
  return { cx:Number(match[1]), cy:Number(match[2]) };
}

function angleFrom(center, point) {
  return Math.atan2(point.y - center.cy, point.x - center.cx) * 180 / Math.PI;
}

function pointAt(center, radius, degrees) {
  const radians = degrees * Math.PI / 180;
  return {
    x:center.cx + Math.cos(radians) * radius,
    y:center.cy + Math.sin(radians) * radius
  };
}

function guideEnvelope(center) {
  const guides = [...document.querySelectorAll("#guide-layer .guide-arc")];
  const candidates = guides.map(path => {
    const length = path.getTotalLength();
    const start = path.getPointAtLength(0);
    const end = path.getPointAtLength(length);
    const radius = Math.hypot(start.x - center.cx, start.y - center.cy);
    return {
      path,
      radius,
      start:angleFrom(center, start),
      end:angleFrom(center, end)
    };
  });
  return candidates.sort((a, b) => b.radius - a.radius)[0] ?? null;
}

function sectorClipPath(center, radius, startDegrees, endDegrees) {
  let start = startDegrees;
  let end = endDegrees;
  while (end <= start) end += 360;
  const span = end - start;
  const p1 = pointAt(center, radius, start);
  const p2 = pointAt(center, radius, end);
  return [
    `M ${center.cx.toFixed(3)} ${center.cy.toFixed(3)}`,
    `L ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`,
    `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${span > 180 ? 1 : 0} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`,
    "Z"
  ].join(" ");
}

function installMasterFanClip() {
  if (!svg || !instrument) return false;
  const tracks = TRACK_IDS.map(id => document.querySelector(`#${id}`));
  if (tracks.some(track => !track || !track.querySelector("path"))) return false;

  const center = parseRotationCenter(tracks[0]);
  if (!center) return false;
  const envelope = guideEnvelope(center);
  if (!envelope) return false;

  let defs = svg.querySelector("defs[data-kinetic-master-geometry]");
  if (!defs) {
    defs = document.createElementNS(NS, "defs");
    defs.dataset.kineticMasterGeometry = "true";
    svg.prepend(defs);
  }

  let clip = svg.querySelector(`#${CLIP_ID}`);
  if (!clip) {
    clip = document.createElementNS(NS, "clipPath");
    clip.id = CLIP_ID;
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    defs.appendChild(clip);
  }

  let clipPath = clip.querySelector("path");
  if (!clipPath) {
    clipPath = document.createElementNS(NS, "path");
    clip.appendChild(clipPath);
  }
  const clipRadius = envelope.radius + 28;
  clipPath.setAttribute("d", sectorClipPath(center, clipRadius, envelope.start, envelope.end));

  let wrapper = svg.querySelector(`#${WRAPPER_ID}`);
  if (!wrapper) {
    wrapper = document.createElementNS(NS, "g");
    wrapper.id = WRAPPER_ID;
    wrapper.setAttribute("clip-path", `url(#${CLIP_ID})`);
    document.querySelector("#guide-layer")?.insertAdjacentElement("afterend", wrapper);
  }

  tracks.forEach(track => {
    wrapper.appendChild(track);
    track.dataset.fanClipped = "true";
  });

  instrument.dataset.masterGeometry = "shared-fan";
  instrument.dataset.fanClip = "active";
  instrument.dataset.geometryCenter = `${center.cx.toFixed(3)},${center.cy.toFixed(3)}`;
  instrument.dataset.geometryFanStart = envelope.start.toFixed(3);
  instrument.dataset.geometryFanEnd = envelope.end.toFixed(3);
  instrument.dataset.geometryOuterRadius = envelope.radius.toFixed(3);
  return true;
}

function recordMobileComposition() {
  if (!instrument || window.innerWidth > 480) return;
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
  recordMobileComposition();
  queueMicrotask(recordMobileComposition);
  requestAnimationFrame(recordMobileComposition);
  setTimeout(recordMobileComposition, 50);
}

function boot(attempt = 0) {
  if (installMasterFanClip()) {
    refreshCompositionDiagnostics();
    return;
  }
  if (attempt < 12) requestAnimationFrame(() => boot(attempt + 1));
}

boot();
window.addEventListener("resize", refreshCompositionDiagnostics, { passive:true });
