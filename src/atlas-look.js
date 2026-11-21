// Home look prototype (2026-11-21): "lacquer". Opt-in with ?look=lacquer so the
// production wheel stays untouched while the direction is compared side by side.
//
// Direction (from the reader review and the user's own art direction):
//   - one material for every ring: dark lacquer with incised hairlines;
//   - a luminance ladder with every level present (v2): ground, ring bodies,
//     hairlines, resting labels, then the four pillars; warm = now;
//   - the four pillars read down the needle in a serif face, everything else recedes;
//   - fine engraved ticks give close-up detail without adding visual weight.
// Presentation only: it reads the renderer's existing ring groups and never
// touches time, phase or rotation state.
import { FAN, RADII, RINGS, WHEEL_CENTER } from "./wheel/ring-model.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LOOK = new URLSearchParams(location.search).get("look");

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

// Same convention as the renderer: SVG degrees, -90 is straight up.
function polar(radius, degrees) {
  const a = (degrees * Math.PI) / 180;
  return { x: WHEEL_CENTER.x + radius * Math.cos(a), y: WHEEL_CENTER.y + radius * Math.sin(a) };
}

function annulus(r0, r1, a0, a1) {
  const p = (r, a) => { const q = polar(r, a); return `${q.x.toFixed(2)} ${q.y.toFixed(2)}`; };
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

// Sub-divisions engraved at each ring's inner edge: one tick per natural unit.
const FINE_TICKS = Object.freeze({
  hour: { per: 8, length: 6 },   // 刻 (15 min) inside each 時辰
  day: { per: 12, length: 7 },   // 時辰 inside each day
  month: { per: 6, length: 7 },  // ~5-day 候 inside each month
  year: { per: 12, length: 8 }   // months inside each year
});

function engraveTicks(wheel) {
  for (const ring of RINGS) {
    const spec = FINE_TICKS[ring.id];
    const group = wheel.querySelector(`#${ring.groupId}`);
    if (!spec || !group || group.querySelector(".look-fine-ticks")) continue;
    const layer = el("g", { class: "look-fine-ticks", "aria-hidden": "true" });
    const step = 6 / spec.per;
    let d = "";
    for (let i = 0; i < 60 * spec.per; i += 1) {
      if (i % spec.per === 0) continue; // sector boundaries already carry ticks
      const angle = i * step;
      const a = polar(ring.innerRadius, angle);
      const b = polar(ring.innerRadius + spec.length, angle);
      d += `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    el("path", { d }, layer);
    group.prepend(layer);
  }
  // Solar band: one hairline per degree of solar longitude along its outer edge.
  const solar = wheel.querySelector("#solar-track");
  if (solar && !solar.querySelector(".look-fine-ticks")) {
    const layer = el("g", { class: "look-fine-ticks look-degree-ticks", "aria-hidden": "true" });
    let d = "";
    let major = "";
    for (let deg = 0; deg < 360; deg += 1) {
      const length = deg % 15 === 0 ? 12 : deg % 5 === 0 ? 7 : 4;
      const a = polar(RADII.solarTermOuter - length, deg);
      const b = polar(RADII.solarTermOuter, deg);
      const seg = `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
      if (deg % 15 === 0) major += seg; else d += seg;
    }
    el("path", { d }, layer);
    el("path", { d: major, class: "major" }, layer);
    solar.prepend(layer);
  }
}

// Stacked discs: a soft shadow just inside each ring edge, and a gentle
// darkening toward the fan's far ends. No rim lights, no spotlight (v1 review).
function shading(wheel) {
  if (wheel.querySelector("#look-light-layer")) return;
  const defs = wheel.querySelector("defs") ?? el("defs", {}, wheel);
  const shade = el("radialGradient", {
    id: "look-edge-shade", gradientUnits: "userSpaceOnUse",
    cx: WHEEL_CENTER.x, cy: WHEEL_CENTER.y - RADII.outer, r: RADII.outer * 1.05
  }, defs);
  for (const [offset, opacity] of [[0, 0], [0.55, 0.18], [1, 0.62]]) {
    el("stop", { offset, "stop-color": "#06080c", "stop-opacity": opacity }, shade);
  }
  const layer = el("g", { id: "look-light-layer", class: "look-light-layer", "aria-hidden": "true" });
  el("path", { d: annulus(RADII.inner, RADII.outer, FAN.start, FAN.end), class: "look-edge-shade", fill: "url(#look-edge-shade)" }, layer);
  const arc = r => { const a = polar(r, FAN.start); const b = polar(r, FAN.end); return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`; };
  for (const r of [RADII.hourOuter, RADII.dayOuter, RADII.solarOuter, RADII.monthOuter, RADII.yearOuter]) {
    el("path", { d: arc(r - 7), class: "look-rim-shadow" }, layer);
  }
  const cursor = wheel.querySelector("#cursor-layer");
  cursor.parentNode.insertBefore(layer, cursor);
}

function install() {
  if (LOOK !== "lacquer") return;
  document.documentElement.dataset.look = "lacquer";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../atlas-look-lacquer.css", import.meta.url).href;
  document.head.append(link);
  let tries = 0;
  const ready = () => {
    const wheel = document.querySelector("#kinetic-wheel");
    if (!wheel?.querySelector("#year-track .cycle-sector")) {
      if (tries++ < 400) requestAnimationFrame(ready);
      return;
    }
    engraveTicks(wheel);
    shading(wheel);
    wheel.dataset.look = "lacquer";
  };
  ready();
}

install();
