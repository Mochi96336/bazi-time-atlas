// Research view: what the scenes draw on the instrument.
//
// Following the performance rules measured on the prototype
// (docs/research-scenes-plan.md, 效能實驗):
// - ring poses are written by the host through the renderer (not here);
// - a ring's start mark lives INSIDE that ring's group, made once, so it turns
//   with the ring by transform and is never redrawn while the ring moves;
// - the screen-fixed layer (veils, names, trails, gaps) is rebuilt only when a
//   cheap key of what it shows changes, i.e. at step boundaries and fades;
// - geometry (scale, read-head extents) is measured on layout change only.
import { CURSOR_ANGLE, FAN, RADII, WHEEL_CENTER as C } from "../wheel/ring-model.js";
import { annularSectorPath, arcPath, pointAt } from "../wheel/polar-geometry.js";
import { cycleItem } from "../sexagenary-data.js";
import { VEIL, clamp, fmt, lerp, mod, signed } from "./scroll-scenes.js";

const NS = "http://www.w3.org/2000/svg";
export const BAND = Object.freeze({
  year: [RADII.monthOuter, RADII.yearOuter],
  greg: [RADII.solarOuter, RADII.monthOuter],
  zodiac: [RADII.solarTermOuter, RADII.solarOuter],
  solar: [RADII.dayOuter, RADII.solarTermOuter],
  day: [RADII.hourOuter, RADII.dayOuter],
  hour: [RADII.inner, RADII.hourOuter]
});
const TRACKS = { year: "#year-track", greg: "#month-track", zodiac: "#zodiac-track", solar: "#solar-track", day: "#day-track", hour: "#hour-track" };
const round = v => Math.round(v * 1000) / 1000;

function el(doc, parent, name, attrs = {}, text) {
  const node = doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

export function createResearchOverlay({ svg, mobile }) {
  const doc = svg.ownerDocument;
  const geo = { u: 1, keep: {}, columnRight: C.x, baseDay: null };
  const nameAngle = mobile ? -117 : -123;
  const tangent = (parent, r, a, text, attrs) => {
    const p = pointAt(C, r, a);
    return el(doc, parent, "text", { x: p.x, y: p.y, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(${a + 90} ${p.x} ${p.y})`, ...attrs }, text);
  };

  // the screen-fixed layer sits above the rings (the cursor lives in its own
  // static layer above the wheel; see static-wheel-layers.js)
  const layer = el(doc, svg, "g", { id: "research-overlay", "aria-hidden": "true" });

  // The Gregorian 400-year ring that stands in for the month ring in 一 曆法.
  const greg = el(doc, svg, "g", { id: "research-greg", "aria-hidden": "true" });
  svg.insertBefore(greg, layer);
  const gregMark = el(doc, greg, "line", { class: "research-start", opacity: 0 });

  // Start marks inside the year and day ring groups (see header).
  const ringMarks = {};
  for (const id of ["year", "day"]) ringMarks[id] = el(doc, svg.querySelector(TRACKS[id]), "line", { class: "research-start", opacity: 0, "data-research": "" });

  function markLine(node, ring, angle, width) {
    const [r0, r1] = BAND[ring];
    const e0 = pointAt(C, r0 + 3, angle), e1 = pointAt(C, r1 - 3, angle);
    for (const [k, v] of Object.entries({ x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": width * geo.u })) node.setAttribute(k, v);
  }

  // Measure once per layout: px-constant text scale, the lit column extents
  // (from the home's own read-heads) and the base pose of the rings.
  function measure(base) {
    const m = svg.getScreenCTM();
    if (!m) return;
    geo.u = 1 / (m.a || 1);
    const inv = m.inverse();
    for (const [band, sel] of Object.entries(TRACKS)) {
      let lo = CURSOR_ANGLE - 3.1, hi = CURSOR_ANGLE + 3.1, right = C.x;
      for (const node of svg.querySelectorAll(`${sel} :is(.active-cycle-label, .active-annual-label)`)) {
        const r = node.getBoundingClientRect();
        if (!r.width) continue;
        for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]) {
          const q = new DOMPoint(x, y).matrixTransform(inv);
          const a = Math.atan2(q.y - C.y, q.x - C.x) * 180 / Math.PI;
          lo = Math.min(lo, a - .6); hi = Math.max(hi, a + .6); right = Math.max(right, q.x);
        }
      }
      geo.keep[band] = { lo, hi, right };
    }
    geo.columnRight = Math.max(...Object.values(geo.keep).map(k => k.right));
    if (base) {
      // marks in ring coordinates: a child at local angle θ shows at θ + rotation;
      // the ring's origin sits under the needle at the base pose
      for (const id of ["year", "day"]) markLine(ringMarks[id], id, CURSOR_ANGLE - base[id], 1.6);
      geo.baseDay = { rotation: base.day, index: mod(Math.floor(mod(CURSOR_ANGLE - base.day, 360) / 6), 60) };
    }
    buildGreg();
    lastKey = null;
  }

  function buildGreg() {
    greg.replaceChildren(gregMark);
    const [r0, r1] = BAND.greg;
    for (let v = 0; v < 400; v += 5) {
      const a = CURSOR_ANGLE + v * .9;
      const major = v % 50 === 0, ten = v % 10 === 0;
      const p0 = pointAt(C, r0, a), p1 = pointAt(C, r0 + (major ? 26 : ten ? 14 : 8), a);
      el(doc, greg, "line", { class: `ring-tick${major ? " major" : ""}`, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
      if (major && v) tangent(greg, (r0 + r1) / 2 + 8, a, `${v}`, { class: "research-greg-label", "font-size": 13 * geo.u });
    }
    markLine(gregMark, "greg", CURSOR_ANGLE, 1.6);
  }

  // per-frame, cheap: the moving parts (transforms and opacities only)
  function setMoving(st) {
    const g = st.greg ?? 0;
    setAttr(greg, "transform", `rotate(${round(st.pose?.greg ?? 0)} ${C.x} ${C.y})`);
    setAttr(greg, "opacity", String(round(g)));
    setAttr(greg, "display", g > 0 ? "inline" : "none");
    for (const [id, node] of [["year", ringMarks.year], ["day", ringMarks.day], ["greg", gregMark]])
      setAttr(node, "opacity", st.marks && (st.veil?.[id] ?? 0) <= .3 ? "1" : "0");
  }

  let lastKey = null;
  function draw(st, push = 0) {
    setMoving(st);
    // what the screen-fixed layer shows; numbers rounded so tiny changes do not redraw
    const key = JSON.stringify([
      Object.values(st.veil ?? {}).map(round), round(st.column ?? 0), st.columnNotes ? 1 : 0,
      st.split === undefined ? null : [round(st.split), round(st.hits ?? 0)],
      st.manual ? 1 : 0, round(st.greg ?? 0), st.trail ? [st.trail.ring, st.trail.poses.length] : null,
      st.back ?? [], round(st.gap ?? 0), st.gap > .01 ? st.pose.delta : null, mobile && push > .5,
      st.band ? [round(st.band.view), st.band.window && round(st.band.window.o), (st.band.marks ?? []).map(m => round(m.o ?? 1))] : null
    ]);
    if (key === lastKey) return;
    lastKey = key;
    const g = doc.createElementNS(NS, "g");
    drawVeils(g, st);
    if (st.column) drawColumnNames(g, st.column, st.columnNotes);
    drawSplit(g, st.split, st.hits ?? 0);
    if (st.manual) drawChapter01(g, st, push);
    if (st.band) drawBand(g, st.band);
    layer.replaceChildren(...g.childNodes);
  }

  function drawVeils(g, st) {
    for (const [b, [r0, r1]] of Object.entries(BAND)) {
      const full = st.veil?.[b] ?? 0, column = (st.column ?? 0) * VEIL;
      if (full > .001) el(doc, g, "path", { class: "research-veil", opacity: full, d: annularSectorPath(C, r0, r1, FAN.start, FAN.end) });
      if (column > .001) {
        const k = geo.keep[b] ?? { lo: CURSOR_ANGLE - 3, hi: CURSOR_ANGLE + 3 };
        el(doc, g, "path", { class: "research-veil", opacity: column, d: annularSectorPath(C, r0, r1, FAN.start, k.lo) });
        el(doc, g, "path", { class: "research-veil", opacity: column, d: annularSectorPath(C, r0, r1, k.hi, FAN.end) });
      }
    }
  }

  function drawColumnNames(g, t, notes = null) {
    if (t < .02) return;
    const u = geo.u, m = mobile;
    const rows = [
      ["年柱", "看立春換年 · 60 年一輪", BAND.year],
      ["月柱", "看「節」換月 · 一年 12 個月", [RADII.solarOuter, RADII.monthOuter]],
      ["節", "白露：月柱在這裡換", BAND.solar],
      ["日柱", "每天走一格 · 60 天一輪", BAND.day],
      ["時柱", "每 2 小時走一格 · 一天 12 格", BAND.hour]
    ];
    const names = el(doc, g, "g", { opacity: t });
    for (const [name, defaultNote, [r0, r1]] of rows) {
      const note = notes?.[name] ?? defaultNote;
      const p = pointAt(C, (r0 + r1) / 2, CURSOR_ANGLE);
      const x0 = geo.columnRight + 10 * u, x1 = geo.columnRight + (m ? 30 : 40) * u;
      el(doc, names, "line", { class: "research-leader", x1: x0, y1: p.y, x2: x1 - 8 * u, y2: p.y, "stroke-width": .8 * u });
      el(doc, names, "text", { class: "research-name", x: x1, y: p.y + (m ? 5 : -2) * u, "font-size": (m ? 14 : 16) * u }, name);
      if (!m) el(doc, names, "text", { class: "research-note", x: x1, y: p.y + 18 * u, "font-size": 13 * u }, note);
    }
  }

  // 日柱 splits into its stem and branch rows; the hits light where each row
  // shows 庚 / 寅 again (every 10 / every 12), together only every 60.
  function drawSplit(g, split, hits) {
    const show = split === undefined ? 0 : clamp(split * 8);
    svg.closest("#kinetic-instrument")?.style.setProperty("--research-day-labels", show > 0 ? String(1 - show) : "");
    if (show <= 0 || !geo.baseDay) return;
    const u = geo.u, [r0, r1] = BAND.day;
    const layerG = el(doc, g, "g", { opacity: show });
    const { rotation, index: baseIndex } = geo.baseDay;
    const mid = (r0 + r1) / 2, dr = (r1 - r0) * .24, size = 15 * u;
    const target = cycleItem(baseIndex);
    for (let k = -16; k <= 16; k++) {
      const index = mod(baseIndex + k, 60);
      const a = rotation + index * 6 + 3;
      if (a < FAN.start || a > FAN.end) continue;
      if (split > .6 && Math.abs(a - (mobile ? -112 : -122)) < 9) continue;
      const item = cycleItem(index);
      const half = (size * .55) / mid * 180 / Math.PI * (1 - split);
      const stemHit = item.stemIndex === target.stemIndex, branchHit = item.branchIndex === target.branchIndex;
      tangent(layerG, mid + dr * split, a - half, item.stem.name, { class: `research-split${stemHit && hits > .5 ? " hit" : ""}`, "font-size": size });
      tangent(layerG, mid - dr * split, a + half, item.branch.name, { class: `research-split${branchHit && hits > .5 ? " hit" : ""}`, "font-size": size });
    }
    if (split > .6) {
      const na = mobile ? -112 : -122, o = clamp((split - .6) / .3);
      tangent(layerG, mid + dr, na, "天干 · 10", { class: "research-row-name", "font-size": 12 * u, opacity: o });
      tangent(layerG, mid - dr, na, "地支 · 12", { class: "research-row-name", "font-size": 12 * u, opacity: o });
    }
  }

  const startAngle = (ring, p) => CURSOR_ANGLE + signed(p[ring], 360);
  function trailMark(g, ring, a) {
    if (a < FAN.start || a > FAN.end) return;
    const [r0, r1] = BAND[ring];
    const e0 = pointAt(C, r0 + 3, a), e1 = pointAt(C, r1 - 3, a);
    el(doc, g, "line", { class: "research-trail", x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": 1.2 * geo.u });
  }

  function drawChapter01(g, st, push) {
    const u = geo.u, m = mobile;
    if (st.trail) for (const p of st.trail.poses) {
      const a = startAngle(st.trail.ring, p);
      trailMark(g, st.trail.ring, a);
      if (Math.abs(a - CURSOR_ANGLE) > 2.5 && a > FAN.start && a < FAN.end) {
        const [, r1] = BAND[st.trail.ring];
        tangent(g, r1 - 11 * u, a + (m ? 1.6 : 1.1), `+${fmt(p.delta)}`, { class: "research-trail-tag", "font-size": (m ? 10 : 11) * u, "text-anchor": "start" });
      }
    }
    // ring names (with a dark halo, so the labels turning under them never need re-styling)
    for (const [ring, name] of [["year", "年序 · 60 年"], ["greg", (st.greg ?? 0) > .5 ? "公曆 · 400 年" : null], ["day", "日序 · 60 日"]]) {
      if (!name || (st.veil[ring] ?? 0) > .3) continue;
      const [r0, r1] = BAND[ring];
      tangent(g, (r0 + r1) / 2, nameAngle, name, { class: "research-ring-name", "font-size": (m ? 11 : 12) * u });
    }
    // "回到起點" sits left of the needle; on a phone with the needle at the
    // left edge it would be cut off (the ledger says it already)
    const backRoom = !(m && push > .5);
    for (const ring of backRoom ? st.back ?? [] : []) {
      const [r0, r1] = BAND[ring];
      const p = pointAt(C, (r0 + r1) / 2, CURSOR_ANGLE);
      el(doc, g, "text", { class: "research-back", x: p.x - 46 * u, y: p.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": (m ? 11 : 13) * u }, "回到起點");
    }
    if (st.gap > .01) {
      const [r0, r1] = BAND.greg;
      const zero = startAngle("greg", st.pose);
      const end = lerp(CURSOR_ANGLE, zero, st.gap);
      el(doc, g, "path", { class: "research-gap", "stroke-width": 3 * u, d: arcPath(C, r1 - 10, Math.min(end, CURSOR_ANGLE), Math.max(end, CURSOR_ANGLE)) });
      if (st.gap > .9) {
        const off = Math.abs(signed(st.pose.state.phases.gregorian, 400));
        tangent(g, r1 - 30 * u, (zero + CURSOR_ANGLE) / 2, `還差 ${off} 年`, { class: "research-gap-label", "font-size": (m ? 15 : 18) * u });
        tangent(g, (r0 + r1) / 2 + 8, zero + (m ? -1.2 : 2.6), "2026 的起點", { class: "research-echo-label", "font-size": (m ? 11 : 12) * u, "text-anchor": m ? "end" : "start" });
      }
    }
  }

  // the brass band (solar longitude): a window between two Jie, and marks
  function drawBand(g, band) {
    const u = geo.u, m = mobile;
    const r0 = RADII.dayOuter, r1 = RADII.solarTermOuter, arcR = r1 + 9;
    const angleOf = lambda => CURSOR_ANGLE + signed(lambda - band.view, 360);
    const inFan = a => a > FAN.start - 2 && a < FAN.end + 2;
    if (band.window && band.window.o > .01) {
      const w = band.window, a0 = angleOf(w.from), a1 = a0 + signed(w.to - w.from, 360);
      const win = el(doc, g, "g", { opacity: w.o });
      for (const [x, y] of [[FAN.start, a0], [a1, FAN.end]]) if (y > x) el(doc, win, "path", { class: "research-veil", opacity: .5, d: annularSectorPath(C, r0, RADII.solarOuter, x, y) });
      el(doc, win, "path", { class: "research-shift", "stroke-width": 1.6 * u, d: arcPath(C, arcR, a0, a1) });
      for (const a of [a0, a1]) { const e0 = pointAt(C, arcR - 6, a), e1 = pointAt(C, arcR + 6, a); el(doc, win, "line", { class: "research-shift", x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": 1.6 * u }); }
      if (w.label) tangent(win, arcR + 16 * u, (a0 + a1) / 2, w.label, { class: "research-shift-value", "font-size": (m ? 12 : 13) * u });
    }
    for (const mk of band.marks ?? []) {
      if ((mk.o ?? 1) < .01) continue;
      const a = angleOf(mk.lambda);
      if (!inFan(a)) continue;
      const markG = el(doc, g, "g", { opacity: mk.o ?? 1 });
      const e0 = pointAt(C, r0 + 3, a), e1 = pointAt(C, r1 - 3, a);
      el(doc, markG, "line", { class: "research-echo", x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": mk.w * u });
      if (mk.label) {
        // labels sit just inside the band, on the side away from the needle
        const side = a <= CURSOR_ANGLE + .01 ? -1 : 1;
        const p = pointAt(C, r0 - 16 * u, a);
        el(doc, markG, "text", { class: "research-echo-label", x: p.x + side * 4 * u, y: p.y, "text-anchor": side < 0 ? "end" : "start", "dominant-baseline": "central", "font-size": (m ? 11 : 12) * u }, mk.label);
      }
    }
  }

  return {
    measure,
    draw,
    geo,
    destroy() {
      layer.remove(); greg.remove();
      for (const node of Object.values(ringMarks)) node.remove();
      svg.closest("#kinetic-instrument")?.style.removeProperty("--research-day-labels");
    }
  };
}

function setAttr(node, name, value) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
