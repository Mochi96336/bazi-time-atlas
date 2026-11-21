// Home look prototype (2026-11-21): "lacquer". Opt-in with ?look=lacquer so the
// production wheel stays untouched while the direction is compared side by side.
//
// Direction (from the reader review and the user's own art direction):
//   - one material for every ring: dark lacquer with incised hairlines;
//   - a luminance ladder with every level present (v2): ground, ring bodies,
//     hairlines, resting labels, then the four pillars; warm = now;
//   - the four pillars read down the needle in a serif face, everything else recedes;
//   - fine engraved ticks give close-up detail without adding visual weight.
//   - v6 composition: the camera pulls back so the fan reads as one object;
//   - v6 motion: a loupe of fine ticks under the needle while a ring is held,
//     and a warm sweep across each new cell once the wheel comes to rest.
// Presentation only: it reads the renderer's existing ring groups and never
// touches time, phase or rotation state (the camera framing goes through the
// camera module's prototype override).
import { FAN, RADII, RINGS, WHEEL_CENTER } from "./wheel/ring-model.js";
import { setCameraFrameOverride } from "./wheel/camera.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LOOK = new URLSearchParams(location.search).get("look");
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");

// Composition: pull the camera back so the fan reads as one object with a dark
// hub, not a band running off every edge. Type is scaled back up in CSS by the
// same factor (--lq-k = heightRatio / .72), so labels keep their pixel size.
const LOOK_CAMERA = Object.freeze({
  desktop: Object.freeze({ heightRatio: 1.0, topMargin: 120 }),
  compact: Object.freeze({ heightRatio: .9, topMargin: 110 }),
  mobile: Object.freeze({ heightRatio: .8, topMargin: 140 })
});

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
    const layer = el("g", { id: `look-ticks-${ring.id}`, class: "look-fine-ticks", "aria-hidden": "true" });
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
    const layer = el("g", { id: "look-ticks-solar", class: "look-fine-ticks look-degree-ticks", "aria-hidden": "true" });
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
  // v3: one soft light from the upper left, falling off toward the lower right,
  // so the disc has a lit side and a shadow side instead of an even grey.
  const light = el("radialGradient", { id: "look-key-light", gradientUnits: "userSpaceOnUse", cx: 120, cy: 260, r: 1250 }, defs);
  for (const [offset, color, opacity] of [[0, "#d4e0f0", 0.075], [0.45, "#c8d6ea", 0.03], [1, "#c8d6ea", 0]]) {
    el("stop", { offset, "stop-color": color, "stop-opacity": opacity }, light);
  }
  const shade = el("radialGradient", { id: "look-key-shade", gradientUnits: "userSpaceOnUse", cx: 1330, cy: 980, r: 1150 }, defs);
  for (const [offset, opacity] of [[0, 0.5], [0.55, 0.2], [1, 0]]) {
    el("stop", { offset, "stop-color": "#04060a", "stop-opacity": opacity }, shade);
  }
  const layer = el("g", { id: "look-light-layer", class: "look-light-layer", "aria-hidden": "true" });
  const disc = annulus(RADII.inner, RADII.outer, FAN.start, FAN.end);
  el("path", { d: disc, class: "look-key-shade", fill: "url(#look-key-shade)" }, layer);
  el("path", { d: disc, class: "look-key-light", fill: "url(#look-key-light)" }, layer);
  // v5: brass sheen — the annual band catches the key light on its upper-left
  // run, like brushed metal; it fades out long before the needle.
  const sheenAt = polar((RADII.dayOuter + RADII.solarTermOuter) / 2, -128);
  const sheen = el("radialGradient", { id: "look-brass-sheen", gradientUnits: "userSpaceOnUse", cx: sheenAt.x, cy: sheenAt.y, r: 520 }, defs);
  for (const [offset, opacity] of [[0, 0.15], [0.4, 0.06], [1, 0]]) {
    el("stop", { offset, "stop-color": "#f7ebb9", "stop-opacity": opacity }, sheen);
  }
  el("path", { d: annulus(RADII.dayOuter, RADII.solarTermOuter, FAN.start, FAN.end), class: "look-brass-sheen", fill: "url(#look-brass-sheen)" }, layer);
  // Colour follows value (painters' rule): the lit run of the brass leans yellow,
  // its shadow side leans red-orange. A warm-brown bounce only on the shadow side.
  const bounceAt = polar((RADII.dayOuter + RADII.solarTermOuter) / 2, -55);
  const bounce = el("radialGradient", { id: "look-brass-bounce", gradientUnits: "userSpaceOnUse", cx: bounceAt.x, cy: bounceAt.y, r: 900 }, defs);
  for (const [offset, opacity] of [[0, 0.3], [0.55, 0.14], [1, 0]]) {
    el("stop", { offset, "stop-color": "#9c7444", "stop-opacity": opacity }, bounce);
  }
  el("path", { d: annulus(RADII.dayOuter, RADII.solarTermOuter, FAN.start, FAN.end), class: "look-brass-bounce", fill: "url(#look-brass-bounce)" }, layer);
  const arc = r => { const a = polar(r, FAN.start); const b = polar(r, FAN.end); return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`; };
  for (const r of [RADII.hourOuter, RADII.dayOuter, RADII.solarOuter, RADII.monthOuter, RADII.yearOuter]) {
    el("path", { d: arc(r - 7), class: "look-rim-shadow" }, layer);
  }
  const cursor = wheel.querySelector("#cursor-layer");
  cursor.parentNode.insertBefore(layer, cursor);
}

// ---------------------------------------------------------------- composition

function trackAngle(track) {
  const match = /rotate\(\s*(-?[\d.]+)/.exec(track?.getAttribute("transform") ?? "");
  return match ? Number(match[1]) : 0;
}

function needleAngle(wheel) {
  const value = Number(wheel.dataset.referenceCursorAngle);
  return Number.isFinite(value) ? value : -90;
}

// Fixed ring identities (年 月 太陽 日 時) are HTML placed with percentages of the
// production camera. Re-derive them from the live camera: each one sits on a
// spoke near its band's inner edge, turned to the local tangent, and slides
// toward the needle when that spoke would leave the screen (phones).
const LEGEND = Object.freeze([
  { row: ".ring-year", r0: RADII.monthOuter, r1: RADII.yearOuter },
  { row: ".ring-month", r0: RADII.solarOuter, r1: RADII.monthOuter },
  { row: ".ring-solar", r0: RADII.dayOuter, r1: RADII.solarTermOuter },
  { row: ".ring-day", r0: RADII.hourOuter, r1: RADII.dayOuter },
  { row: ".ring-hour", r0: RADII.inner, r1: RADII.hourOuter }
]);

function placeLegend(wheel) {
  const instrument = document.querySelector("#kinetic-instrument");
  const ctm = wheel.getScreenCTM();
  if (!instrument || !ctm) return;
  const box = instrument.getBoundingClientRect();
  const toScreen = p => new DOMPoint(p.x, p.y).matrixTransform(ctm);
  const leftWorld = new DOMPoint(box.left + 14, 0).matrixTransform(ctm.inverse()).x;
  const spoke = innerWidth <= 480 ? -100 : innerWidth <= 820 ? -110 : -117;
  for (const { row, r0, r1 } of LEGEND) {
    const node = instrument.querySelector(row);
    if (!node) continue;
    const r = r0 + (r1 - r0) * .24;
    const cos = (leftWorld - WHEEL_CENTER.x) / r;
    const edge = cos > -1 ? -(Math.acos(cos) * 180) / Math.PI : -180;
    const angle = Math.max(spoke, edge + 1.5);
    const at = toScreen(polar(r, angle));
    node.style.setProperty("--lq-x", `${(at.x - box.left).toFixed(1)}px`);
    node.style.setProperty("--lq-y", `${(at.y - box.top - node.offsetHeight / 2).toFixed(1)}px`);
    node.style.setProperty("--lq-rot", `${(angle + 90).toFixed(1)}deg`);
  }
}

function frame(wheel) {
  setCameraFrameOverride(LOOK_CAMERA);
  // The camera controller re-frames on resize; ask it to apply the new framing.
  dispatchEvent(new Event("resize"));
  let pending = 0;
  const schedule = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => placeLegend(wheel));
  };
  new MutationObserver(schedule).observe(wheel, { attributes: true, attributeFilter: ["viewBox"] });
  addEventListener("resize", schedule, { passive: true });
  document.fonts?.ready.then(schedule);
  schedule();
}

// ---------------------------------------------------------------- motion

// Loupe: while a ring is held (or coasting) its fine scale comes up under the
// needle and nowhere else; hovering shows a faint version as the affordance.
// The reveal is a copy of the ring's own engraved ticks, kept in step with the
// ring's rotation and masked by an angular falloff around the needle.
const LOUPE_HALF_DEGREES = 13;

function loupe(wheel, layer, defs) {
  const group = el("g", { class: "look-loupe", "aria-hidden": "true" }, layer);
  const needle = needleAngle(wheel);
  for (const ring of RINGS) {
    const track = wheel.querySelector(`#${ring.groupId}`);
    if (!track || !wheel.querySelector(`#look-ticks-${ring.id}`)) continue;
    const mid = (ring.innerRadius + ring.outerRadius) / 2;
    const half = mid * Math.sin((LOUPE_HALF_DEGREES * Math.PI) / 180);
    const at = polar(mid, needle);
    const fall = el("linearGradient", { id: `look-loupe-fall-${ring.id}`, gradientUnits: "userSpaceOnUse", x1: at.x - half, y1: 0, x2: at.x + half, y2: 0 }, defs);
    for (const [offset, opacity] of [[0, 0], [.3, .28], [.5, 1], [.7, .28], [1, 0]]) {
      el("stop", { offset, "stop-color": "#fff", "stop-opacity": opacity }, fall);
    }
    const mask = el("mask", { id: `look-loupe-mask-${ring.id}`, maskUnits: "userSpaceOnUse", x: at.x - half, y: WHEEL_CENTER.y - RADII.outer - 20, width: half * 2, height: RADII.outer + 20 }, defs);
    el("rect", { x: at.x - half, y: WHEEL_CENTER.y - RADII.outer - 20, width: half * 2, height: RADII.outer + 20, fill: `url(#look-loupe-fall-${ring.id})` }, mask);
    // The mask sits on a still wrapper: on the rotating copy it would turn too.
    const still = el("g", { mask: `url(#look-loupe-mask-${ring.id})` }, group);
    // A real copy (not <use>): document CSS does not reach into <use> clones.
    const copy = el("g", { class: "look-loupe-copy", "data-ring": ring.id }, still);
    for (const path of wheel.querySelectorAll(`#look-ticks-${ring.id} path`)) copy.append(path.cloneNode(false));
    const follow = () => copy.setAttribute("transform", track.getAttribute("transform") ?? "");
    new MutationObserver(follow).observe(track, { attributes: true, attributeFilter: ["transform"] });
    follow();
  }
}

// Ripple: when a pillar (or the solar term) changes and the wheel has come to
// rest, a warm wavefront spreads out from the needle across the new cell and
// its name cools from warm to ivory. Changes that happen mid-drag wait for the
// release, so one gesture produces one settled event, cascading inner → outer.
const RIPPLE_ORDER = ["hour", "day", "solar", "month", "year"];
const RIPPLE_MS = 1300;
const RIPPLE_STAGGER_MS = 110;
const SETTLE_MS = 160;
let rippleSerial = 0;

function activeKey(wheel, ring) {
  const label = wheel.querySelector(`#${ring}-track .active-cycle-label`);
  return label ? label.textContent : null;
}

function snapshot(wheel) {
  return Object.fromEntries(RIPPLE_ORDER.map(ring => [ring, activeKey(wheel, ring)]));
}

function ripple(wheel, ringId, delay) {
  const ring = RINGS.find(item => item.id === ringId);
  const track = wheel.querySelector(`#${ring.groupId}`);
  const sector = track?.querySelector(ringId === "solar" ? ".term-sector.is-active" : ".cycle-sector.is-active");
  const label = track?.querySelector(".active-cycle-label");
  if (!sector) return;
  if (label) {
    label.animate(
      [{ fill: "#f0d49a", offset: 0 }, { fill: "#f0d49a", offset: .25 }, { fill: "#f1e8d4", offset: 1 }],
      { duration: RIPPLE_MS + 500, delay, easing: "ease-out" }
    );
  }
  if (REDUCED_MOTION.matches) return;
  const outer = ringId === "solar" ? RADII.solarTermOuter : ring.outerRadius;
  const mid = (ring.innerRadius + outer) / 2;
  // Light runs along the ring — the direction time flows — from the needle to
  // both edges of the new cell. The gradient lives in the track's rotated
  // space, so express the needle point and its tangent in that space.
  const local = needleAngle(wheel) - trackAngle(track);
  const at = polar(mid, local);
  const rad = (local * Math.PI) / 180;
  const tangent = { x: -Math.sin(rad), y: Math.cos(rad) };
  const span = mid * ((ringId === "solar" ? 15 : 6) * Math.PI) / 180; // one cell of arc
  const id = `look-ripple-${++rippleSerial}`;
  const defs = wheel.querySelector("defs");
  const grad = el("linearGradient", {
    id, gradientUnits: "userSpaceOnUse",
    x1: (at.x - tangent.x * span).toFixed(2), y1: (at.y - tangent.y * span).toFixed(2),
    x2: (at.x + tangent.x * span).toFixed(2), y2: (at.y + tangent.y * span).toFixed(2)
  }, defs);
  const stops = Array.from({ length: 7 }, () => el("stop", { offset: 0, "stop-color": "#f3d699", "stop-opacity": 0 }, grad));
  const wave = sector.cloneNode(false);
  wave.removeAttribute("id");
  wave.setAttribute("class", "look-ripple");
  wave.setAttribute("fill", `url(#${id})`);
  wave.setAttribute("aria-hidden", "true");
  sector.after(wave);
  const peak = ringId === "solar" ? .34 : .3;
  const start = performance.now() + delay;
  const set = (stop, offset, opacity) => {
    stop.setAttribute("offset", Math.min(1, Math.max(0, offset)).toFixed(4));
    stop.setAttribute("stop-opacity", opacity.toFixed(3));
  };
  const step = () => {
    if ("activeRing" in wheel.dataset) { wave.remove(); grad.remove(); return; }
    const p = Math.min(1, Math.max(0, (performance.now() - start) / RIPPLE_MS));
    const front = (1 - (1 - p) ** 3) * .5;     // 0 → .5: needle → one cell away
    const a = peak * (1 - p) ** 1.3;
    const soft = .08;
    set(stops[0], .5 - front - soft, 0);
    set(stops[1], .5 - front, a);
    set(stops[2], .5 - front * .55, a * .62);
    set(stops[3], .5, a * .46);
    set(stops[4], .5 + front * .55, a * .62);
    set(stops[5], .5 + front, a);
    set(stops[6], .5 + front + soft, 0);
    if (p < 1) requestAnimationFrame(step);
    else { wave.remove(); grad.remove(); }
  };
  requestAnimationFrame(step);
}

function watchPillars(wheel) {
  let settled = snapshot(wheel);
  let timer = 0;
  const interacting = () => "activeRing" in wheel.dataset || "coastingRing" in wheel.dataset;
  const settle = () => {
    timer = 0;
    if (interacting()) return;
    const now = snapshot(wheel);
    let order = 0;
    for (const ring of RIPPLE_ORDER) {
      if (now[ring] && settled[ring] && now[ring] !== settled[ring]) ripple(wheel, ring, order++ * RIPPLE_STAGGER_MS);
    }
    settled = now;
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!interacting()) timer = setTimeout(settle, SETTLE_MS);
  };
  const tracks = RIPPLE_ORDER.map(ring => wheel.querySelector(`#${ring}-track`)).filter(Boolean);
  const observer = new MutationObserver(schedule);
  for (const track of tracks) observer.observe(track, { subtree: true, childList: true, characterData: true });
  new MutationObserver(schedule).observe(wheel, { attributes: true, attributeFilter: ["data-active-ring", "data-coasting-ring"] });
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
    const layer = wheel.querySelector("#look-light-layer");
    loupe(wheel, layer, wheel.querySelector("defs"));
    frame(wheel);
    watchPillars(wheel);
    wheel.dataset.look = "lacquer";
  };
  ready();
}

install();
