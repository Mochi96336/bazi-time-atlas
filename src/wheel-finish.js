// Home wheel finish "lacquer" (2026-11): ink-blue lacquer rings, a turned brass
// solar band, engraved hairlines and serif type. index.html sets
// <html data-look="lacquer"> and loads atlas-wheel-finish.css; this module adds
// the SVG detail that CSS cannot draw.
//
// Design rules (from the 2026-11 reader reviews):
//   - one material per ring family: lacquer for the four pillars, brass for the
//     sun's band; colour comes from the material's own knobs, never from veils;
//   - a luminance ladder with every level present: ground, ring bodies,
//     hairlines, resting labels, then the four pillars read down the needle;
//   - warmth belongs to material (brass) or light (needle, current names);
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
    const step = 6 / spec.per;
    let d = "";
    for (let i = 0; i < 60 * spec.per; i += 1) {
      if (i % spec.per === 0) continue; // sector boundaries already carry ticks
      const angle = i * step;
      const a = polar(ring.innerRadius, angle);
      const b = polar(ring.innerRadius + spec.length, angle);
      d += `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    // A bare path (no wrapper group) keeps each track's children flat.
    group.prepend(el("path", { d, class: "look-fine-ticks", "aria-hidden": "true" }));
  }
  // Solar band: one hairline per degree of solar longitude along its outer edge.
  const solar = wheel.querySelector("#solar-track");
  if (solar && !solar.querySelector(".look-fine-ticks")) {
    let d = "";
    let major = "";
    for (let deg = 0; deg < 360; deg += 1) {
      const length = deg % 15 === 0 ? 12 : deg % 5 === 0 ? 7 : 4;
      const a = polar(RADII.solarTermOuter - length, deg);
      const b = polar(RADII.solarTermOuter, deg);
      const seg = `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
      if (deg % 15 === 0) major += seg; else d += seg;
    }
    solar.prepend(
      el("path", { d, class: "look-fine-ticks look-degree-ticks", "aria-hidden": "true" }),
      el("path", { d: major, class: "look-fine-ticks look-degree-ticks major", "aria-hidden": "true" })
    );
  }
}

// Brass finish — what separates machined brass from brown paint:
//   - turned (circular-grain) metal shows its highlight as a narrow band
//     pointing at the light, not as a soft blob; inside that band the grain
//     itself is visible as fine concentric lines;
//   - a crisp chamfer catches the light along both edges, strongest on the lit
//     side and dying out toward the needle.
// The light is fixed in spirit, but each camera crops a different run of the
// fan; place the band about a quarter in from the left of what is visible.
const BRASS_STREAK = Object.freeze([
  { query: "(max-width: 480px)", angle: -101, half: 120 },
  { query: "(max-width: 820px)", angle: -110, half: 135 },
  { query: "all", angle: -121, half: 150 }
]);

function brassFinish(layer, defs) {
  const r0 = RADII.dayOuter;
  const r1 = RADII.solarTermOuter;
  const mid = (r0 + r1) / 2;
  const streak = el("linearGradient", { id: "look-brass-streak", gradientUnits: "userSpaceOnUse" }, defs);
  const aim = () => {
    const { angle, half } = BRASS_STREAK.find(item => matchMedia(item.query).matches);
    const at = polar(mid, angle);
    const rad = (angle * Math.PI) / 180;
    const t = { x: -Math.sin(rad), y: Math.cos(rad) };
    streak.setAttribute("x1", (at.x - t.x * half).toFixed(2));
    streak.setAttribute("y1", (at.y - t.y * half).toFixed(2));
    streak.setAttribute("x2", (at.x + t.x * half).toFixed(2));
    streak.setAttribute("y2", (at.y + t.y * half).toFixed(2));
  };
  aim();
  for (const { query } of BRASS_STREAK.slice(0, -1)) matchMedia(query).addEventListener("change", aim);
  for (const [offset, opacity] of [[0, 0], [.22, .025], [.38, .08], [.47, .17], [.5, .2], [.53, .17], [.62, .08], [.78, .025], [1, 0]]) {
    el("stop", { offset, "stop-color": "#f4cf7c", "stop-opacity": opacity }, streak);
  }
  // Grain: concentric hairlines of uneven strength, seen only where light falls.
  const grain = el("mask", { id: "look-brass-grain", maskUnits: "userSpaceOnUse", x: -700, y: 0, width: 2600, height: 1400 }, defs);
  el("rect", { x: -700, y: 0, width: 2600, height: 1400, fill: "#fff", "fill-opacity": .5 }, grain);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const arcAt = r => { const a = polar(r, FAN.start); const b = polar(r, FAN.end); return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`; };
  for (let r = r0 + 1.5; r < r1; r += 1.9 + random() * 1.4) {
    el("path", { d: arcAt(r), fill: "none", stroke: "#fff", "stroke-opacity": (.25 + random() * .75).toFixed(2), "stroke-width": (.6 + random() * .9).toFixed(2) }, grain);
  }
  el("path", { d: annulus(r0, r1, FAN.start, FAN.end), class: "look-brass-streak", fill: "url(#look-brass-streak)", mask: "url(#look-brass-grain)" }, layer);
  // Chamfers: light from the upper left, fading toward the right.
  const edge = el("linearGradient", { id: "look-brass-edge", gradientUnits: "userSpaceOnUse", x1: -450, y1: 500, x2: 1500, y2: 900 }, defs);
  for (const [offset, opacity] of [[0, .5], [.3, .32], [.5, .12], [.75, .05], [1, .03]]) {
    el("stop", { offset, "stop-color": "#f2dba3", "stop-opacity": opacity }, edge);
  }
  for (const r of [r0 + 1.2, r1 - 1]) el("path", { d: arcAt(r), class: "look-brass-chamfer", stroke: "url(#look-brass-edge)" }, layer);
}

// Stacked discs: a soft shadow just inside each ring edge, and a gentle
// darkening toward the fan's far ends. No rim lights, no spotlight.
function shading(wheel) {
  if (wheel.querySelector("#look-light-layer")) return;
  const defs = wheel.querySelector("defs") ?? el("defs", {}, wheel);
  // The key light comes from the upper left; this shade darkens the lower right.
  const shade = el("radialGradient", { id: "look-key-shade", gradientUnits: "userSpaceOnUse", cx: 1330, cy: 980, r: 1150 }, defs);
  for (const [offset, opacity] of [[0, 0.5], [0.55, 0.2], [1, 0]]) {
    el("stop", { offset, "stop-color": "#04060a", "stop-opacity": opacity }, shade);
  }
  const layer = el("g", { id: "look-light-layer", class: "look-light-layer", "aria-hidden": "true" });
  const disc = annulus(RADII.inner, RADII.outer, FAN.start, FAN.end);
  el("path", { d: disc, class: "look-key-shade", fill: "url(#look-key-shade)" }, layer);
  // Brass sheen: a broad warm lift on the lit run of the band (colour follows
  // value: lights lean yellow); it fades out long before the needle.
  const sheenAt = polar((RADII.dayOuter + RADII.solarTermOuter) / 2, -128);
  const sheen = el("radialGradient", { id: "look-brass-sheen", gradientUnits: "userSpaceOnUse", cx: sheenAt.x, cy: sheenAt.y, r: 520 }, defs);
  for (const [offset, opacity] of [[0, 0.12], [0.4, 0.05], [1, 0]]) {
    el("stop", { offset, "stop-color": "#f7ebb9", "stop-opacity": opacity }, sheen);
  }
  el("path", { d: annulus(RADII.dayOuter, RADII.solarTermOuter, FAN.start, FAN.end), class: "look-brass-sheen", fill: "url(#look-brass-sheen)" }, layer);
  // Colour follows value (painters' rule): the lit run of the brass leans yellow,
  // its shadow side leans red-orange. A warm-brown bounce only on the shadow side.
  const bounceAt = polar((RADII.dayOuter + RADII.solarTermOuter) / 2, -66);
  const bounce = el("radialGradient", { id: "look-brass-bounce", gradientUnits: "userSpaceOnUse", cx: bounceAt.x, cy: bounceAt.y, r: 900 }, defs);
  for (const [offset, opacity] of [[0, 0.3], [0.55, 0.14], [1, 0]]) {
    el("stop", { offset, "stop-color": "#9c7444", "stop-opacity": opacity }, bounce);
  }
  el("path", { d: annulus(RADII.dayOuter, RADII.solarTermOuter, FAN.start, FAN.end), class: "look-brass-bounce", fill: "url(#look-brass-bounce)" }, layer);
  brassFinish(layer, defs);
  const arc = r => { const a = polar(r, FAN.start); const b = polar(r, FAN.end); return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`; };
  for (const r of [RADII.hourOuter, RADII.dayOuter, RADII.solarOuter, RADII.monthOuter, RADII.yearOuter]) {
    el("path", { d: arc(r - 7), class: "look-rim-shadow" }, layer);
  }
  // Just beneath the cursor, wherever it lives: the atlas may already have
  // moved it into the static #kinetic-wheel-over layer
  // (src/wheel/static-wheel-layers.js), which moves this layer otherwise.
  const cursor = document.getElementById("cursor-layer");
  cursor.parentNode.insertBefore(layer, cursor);
}

function install() {
  const root = document.documentElement;
  // ?look=classic shows the previous finish for comparison: without the root
  // attribute none of atlas-wheel-finish.css applies.
  if (LOOK === "classic") delete root.dataset.look;
  if (root.dataset.look !== "lacquer") return;
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
