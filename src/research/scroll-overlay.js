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
import { DEG_PER_HOUR, VEIL, clamp, fmt, lerp, mod, signed } from "./scroll-scenes.js";

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
  const solarMarks = el(doc, svg.querySelector(TRACKS.solar), "g", { id: "research-solar-marks", "aria-hidden": "true" });
  const windowShade = el(doc, svg, "g", { class: "research-veil", "aria-hidden": "true" });
  const windowEdges = [el(doc, windowShade, "path"), el(doc, windowShade, "path")];
  const hazeLayer = el(doc, svg, "g", { "aria-hidden": "true" });
  const hazes = ["day", "hour"].map(ring => ({
    ring,
    head: svg.querySelector(`${TRACKS[ring]} .active-cycle-label`),
    fill: el(doc, hazeLayer, "path", { class: "research-haze" }),
    edges: [0, 1].map(() => el(doc, hazeLayer, "line", { class: "research-haze-edge" })),
    label: el(doc, hazeLayer, "text", { class: "research-haze-label", "dominant-baseline": "central" })
  }));
  const veils = Object.fromEntries(Object.keys(BAND).map(ring => [
    ring, el(doc, svg, "path", { class: "research-veil", "aria-hidden": "true" })
  ]));
  const staticVeils = el(doc, svg, "g", { "aria-hidden": "true" });
  for (const node of [...Object.values(veils), staticVeils]) svg.insertBefore(node, layer);

  function markLine(node, ring, angle, width) {
    const [r0, r1] = BAND[ring];
    const e0 = pointAt(C, r0 + 3, angle), e1 = pointAt(C, r1 - 3, angle);
    for (const [k, v] of Object.entries({ x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, "stroke-width": width * geo.u })) node.setAttribute(k, v);
  }

  // Measure once per layout: px-constant text scale, the lit column extents
  // (from the home's own read-heads) and the base pose of the rings.
  function measure(base, k = 1) {
    const m = svg.getScreenCTM();
    if (!m) return;
    geo.u = k / (m.a || 1);
    geo.compact = mobile && matchMedia("(max-height: 625px)").matches;
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
    for (const [ring, [r0, r1]] of Object.entries(BAND))
      setAttr(veils[ring], "d", annularSectorPath(C, r0, r1, FAN.start, FAN.end));
    buildGreg();
    lastKey = null;
    bandScene = null;
    staticVeils.replaceChildren();
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
  function draw(id, st, push = 0) {
    setMoving(st);
    for (const [ring, node] of Object.entries(veils)) setAttr(node, "opacity", String(round(st.veil?.[ring] ?? 0)));
    drawBand(id, st.band);
    drawHaze(st.haze);
    // what the screen-fixed layer shows; numbers rounded so tiny changes do not redraw
    const calendar = st.marks === true;
    const key = JSON.stringify([
      round(st.column ?? 0), st.columnNotes ? 1 : 0,
      st.split === undefined ? null : [round(st.split), round(st.hits ?? 0)],
      calendar ? [st.greg > .5, Object.values(st.veil).map(v => v > .3),
        st.trail?.ring, st.trail?.poses.length, st.back, round(st.gap ?? 0), mobile && push > .5] : null
    ]);
    if (key === lastKey) return;
    lastKey = key;
    const g = doc.createElementNS(NS, "g");
    drawColumnVeils(st.column ?? 0);
    if (st.column && !(mobile && st.columnNotes)) drawColumnNames(g, st.column, st.columnNotes);
    drawSplit(g, st.split, st.hits ?? 0);
    if (calendar) drawChapter01(g, st, push);
    layer.replaceChildren(...g.childNodes);
  }

  function drawColumnVeils(column) {
    if (column && !staticVeils.childElementCount) {
      for (const [b, [r0, r1]] of Object.entries(BAND)) {
        const k = geo.keep[b] ?? { lo: CURSOR_ANGLE - 3, hi: CURSOR_ANGLE + 3 };
        el(doc, staticVeils, "path", { d: annularSectorPath(C, r0, r1, FAN.start, k.lo) });
        el(doc, staticVeils, "path", { d: annularSectorPath(C, r0, r1, k.hi, FAN.end) });
      }
    }
    setAttr(staticVeils, "opacity", String(round(column * VEIL)));
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
    const labels = svg.querySelector(TRACKS.day).style;
    const opacity = show > 0 ? String(1 - show) : "";
    if (labels.getPropertyValue("--research-day-labels") !== opacity) labels.setProperty("--research-day-labels", opacity);
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
        tangent(g, r1 - 11 * u, a + (m ? 1.6 : 1.1), `+${fmt(p.delta)}`, { class: "research-trail-tag", "font-size": 12 * u, "text-anchor": "start" });
      }
    }
    // ring names (with a dark halo, so the labels turning under them never need re-styling)
    for (const [ring, name] of [["year", "年序 · 60 年"], ["greg", (st.greg ?? 0) > .5 ? "公曆 · 400 年" : null], ["day", "日序 · 60 日"]]) {
      if (!name || (st.veil[ring] ?? 0) > .3) continue;
      const [r0, r1] = BAND[ring];
      tangent(g, (r0 + r1) / 2, nameAngle, name, { class: "research-ring-name", "font-size": 12 * u });
    }
    // "回到起點" sits left of the needle; on a phone with the needle at the
    // left edge it would be cut off (the ledger says it already)
    const backRoom = !(m && push > .5);
    for (const ring of backRoom ? st.back ?? [] : []) {
      const [r0, r1] = BAND[ring];
      const p = pointAt(C, (r0 + r1) / 2, CURSOR_ANGLE);
      el(doc, g, "text", { class: "research-back", x: p.x - 46 * u, y: p.y, "text-anchor": "end", "dominant-baseline": "central", "font-size": (m ? 12 : 13) * u }, "回到起點");
    }
    if (st.gap > .01) {
      const [r0, r1] = BAND.greg;
      const zero = startAngle("greg", st.pose);
      const end = lerp(CURSOR_ANGLE, zero, st.gap);
      el(doc, g, "path", { class: "research-gap", "stroke-width": 3 * u, d: arcPath(C, r1 - 10, Math.min(end, CURSOR_ANGLE), Math.max(end, CURSOR_ANGLE)) });
      if (st.gap > .9) {
        const off = Math.abs(signed(st.pose.state.phases.gregorian, 400));
        tangent(g, r1 - 30 * u, (zero + CURSOR_ANGLE) / 2, `還差 ${off} 年`, { class: "research-gap-label", "font-size": (m ? 15 : 18) * u });
        tangent(g, (r0 + r1) / 2 + 8, zero + (m ? -1.2 : 2.6), "2026 的起點", { class: "research-echo-label", "font-size": 12 * u, "text-anchor": m ? "end" : "start" });
      }
    }
  }

  // The geometry is in solar longitude, so the renderer moves it with the
  // solar track. Only changing endpoints, labels and opacities are patched.
  let bandScene, bandNodes, shadeKey;
  const r0 = RADII.dayOuter, r1 = RADII.solarTermOuter, arcR = r1 + 9;
  function drawBand(id, band) {
    if (bandScene !== id) {
      bandScene = id;
      solarMarks.replaceChildren();
      bandNodes = null;
      shadeKey = null;
    }
    setAttr(solarMarks, "display", band ? "inline" : "none");
    const w = band?.window;
    setAttr(windowShade, "opacity", String(round((w?.o ?? 0) * .5)));
    if (!band) return;
    const u = geo.u;
    if (!bandNodes) {
      const windowArc = el(doc, solarMarks, "g");
      bandNodes = {
        windowArc,
        windowPath: el(doc, windowArc, "path", { class: "research-shift", "stroke-width": 1.6 * u }),
        windowTicks: [0, 1].map(() => el(doc, windowArc, "line", { class: "research-shift", "stroke-width": 1.6 * u })),
        windowLabel: el(doc, windowArc, "text", { class: "research-shift-value", "font-size": 13 * u, "text-anchor": "middle" }),
        marks: el(doc, solarMarks, "g"), markNodes: [], arcNodes: []
      };
    }
    const nodes = bandNodes;
    setAttr(nodes.windowArc, "opacity", String(round(w?.o ?? 0)));
    if (w) {
      const to = w.from + signed(w.to - w.from, 360);
      const arcKey = `${w.from}|${to}|${w.label}`;
      if (nodes.arcKey !== arcKey) {
        nodes.arcKey = arcKey;
        setAttr(nodes.windowPath, "d", arcPath(C, arcR, w.from, to));
        [w.from, to].forEach((a, i) => radialLine(nodes.windowTicks[i], a, arcR - 6, arcR + 6));
        bandLabel(nodes.windowLabel, w.label, arcR + 16 * u, (w.from + to) / 2);
      }
      const fromAngle = CURSOR_ANGLE + signed(w.from - band.view, 360);
      const until = fromAngle + (to - w.from);
      const key = round(fromAngle) + "|" + round(until);
      if (shadeKey !== key) {
        shadeKey = key;
        const lo = clamp(fromAngle, FAN.start, FAN.end), hi = clamp(until, FAN.start, FAN.end);
        [[FAN.start, lo], [hi, FAN.end]].forEach(([a, b], i) => {
          setAttr(windowEdges[i], "d", b > a ? annularSectorPath(C, r0, RADII.solarOuter, a, b) : "");
        });
      }
    }
    setAttr(nodes.marks, "opacity", String(round(band.marksOpacity ?? 1)));
    if (id !== "sun" || !nodes.markNodes.length) {
      patchList(nodes.markNodes, band.marks, () => {
        const group = el(doc, nodes.marks, "g");
        return { group, line: el(doc, group, "line"), label: el(doc, group, "text", { "text-anchor": mobile && id !== "sun" ? "end" : "middle" }) };
      }, (node, mark) => {
        const { lambda, cls, label, tier = 0 } = mark;
        setAttr(node.group, "opacity", String(round(mark.o ?? 1)));
        setAttr(node.line, "class", cls);
        setAttr(node.line, "stroke-width", String(mark.w * u));
        radialLine(node.line, lambda, r0 + 3, r1 - 3);
        setAttr(node.label, "class", mark.warm ? "research-sun-label" : "research-echo-label");
        setAttr(node.label, "font-size", String(12 * u));
        bandLabel(node.label, label, r0 - (14 + 20 * tier) * u, lambda);
      });
    }
    patchList(nodes.arcNodes, band.arcs, () => {
      const group = el(doc, solarMarks, "g");
      return { group, path: el(doc, group, "path"), label: el(doc, group, "text", { "text-anchor": "middle" }) };
    }, (node, arc) => {
      const from = arc.from, to = from + signed(arc.to - from, 360);
      setAttr(node.group, "opacity", String(round(arc.o ?? 1)));
      // lead (0–1): a call-out that blends from the plain shift to the red gap
      const f = arc.lead ?? (arc.big ? 1 : 0), blend = arc.lead !== undefined;
      setAttr(node.path, "class", blend ? "research-shift" : arc.cls);
      setAttr(node.path, "style", blend && f > 0 ? `stroke:${mixRgba(SHIFT_RGBA, GAP_RGBA, f)}` : "");
      setAttr(node.path, "stroke-width", String(arc.w * u));
      setAttr(node.path, "d", from === to ? "" : arcPath(C, arcR, Math.min(from, to), Math.max(from, to)));
      setAttr(node.label, "class", blend ? "research-shift-value" : arc.big ? "research-gap-label" : "research-shift-value");
      setAttr(node.label, "style", blend && f > 0 ? `fill:${mixRgba(SHIFT_VALUE_RGBA, GAP_LABEL_RGBA, f)};font-weight:${f > .5 ? 500 : 400}` : "");
      setAttr(node.label, "font-size", String((12 + 3 * f) * u));
      bandLabel(node.label, arc.label, arcR + (14 + 8 * f) * u, (from + to) / 2);
    });
  }

  function patchList(nodes, data = [], create, update) {
    data.forEach((item, i) => {
      const node = nodes[i] ?? (nodes[i] = create());
      setAttr(node.group, "display", "inline");
      const key = JSON.stringify(item);
      if (key === node.key) return;
      node.key = key;
      update(node, item);
    });
    for (let i = data.length; i < nodes.length; i++) setAttr(nodes[i].group, "display", "none");
  }

  function radialLine(node, angle, inner, outer) {
    const a = pointAt(C, inner, angle), b = pointAt(C, outer, angle);
    for (const [key, value] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }))
      setAttr(node, key, String(round(value)));
  }

  function bandLabel(node, label, radius, angle) {
    const word = label ?? "";
    if (node.textContent !== word) node.textContent = word;
    if (!word) return;
    const p = pointAt(C, radius, angle), x = round(p.x), y = round(p.y);
    setAttr(node, "x", String(x));
    setAttr(node, "y", String(y));
    setAttr(node, "transform", `rotate(${round(angle + 90)} ${x} ${y})`);
  }

  let hazeKey;
  function drawHaze(haze) {
    const key = `${round(haze?.hours ?? 0)}|${haze?.label ?? ""}|${geo.u}|${geo.compact}`;
    if (hazeKey === key) return;
    hazeKey = key;
    setAttr(hazeLayer, "display", haze?.hours > 0 ? "inline" : "none");
    for (const { ring, head, fill, edges, label } of hazes) {
      const span = (haze?.hours ?? 0) * DEG_PER_HOUR[ring];
      const read = 1 - .72 * clamp((span - 1.5) / 6);
      if (head) head.style.opacity = read < 1 ? String(round(read)) : "";
      if (!haze?.hours) continue;
      const [inner, outer] = BAND[ring];
      const full = span >= 180;
      const lo = CURSOR_ANGLE - span, hi = CURSOR_ANGLE + span;
      setAttr(fill, "d", span < .05 ? "" : annularSectorPath(C, inner + 2, outer - 2, Math.max(FAN.start, lo), Math.min(FAN.end, hi)));
      [lo, hi].forEach((angle, i) => {
        const visible = span >= .05 && !full && angle > FAN.start && angle < FAN.end;
        setAttr(edges[i], "display", visible ? "inline" : "none");
        if (visible) {
          setAttr(edges[i], "stroke-width", String(1.2 * geo.u));
          radialLine(edges[i], angle, inner + 4, outer - 4);
        }
      });
      setAttr(label, "text-anchor", "middle");
      setAttr(label, "font-size", String((mobile ? 13 : 14) * geo.u));
      const text = haze.label && (ring === "day" ? `日柱 ${haze.label}` : full ? "時柱 · 整圈都有可能" : `時柱 ±${(span / 6).toFixed(1)} 格`);
      if (geo.compact) {
        if (label.textContent !== (text || "")) label.textContent = text || "";
        setAttr(label, "x", String(C.x + 62 * geo.u));
        setAttr(label, "y", String(C.y - RADII.yearOuter + (ring === "day" ? 118 : 142) * geo.u));
        label.removeAttribute("transform");
        continue;
      }
      const offset = mobile ? clamp(span + 5, 8, 13) : clamp(span + 6, 8, 32);
      bandLabel(label, text, (inner + outer) / 2, CURSOR_ANGLE + (full ? (mobile ? 9 : 16) : offset));
    }
  }

  return {
    measure,
    draw,
    geo,
    destroy() {
      for (const node of [layer, greg, solarMarks, windowShade, hazeLayer, staticVeils, ...Object.values(veils)]) node.remove();
      for (const { head } of hazes) if (head) head.style.removeProperty("opacity");
      for (const node of Object.values(ringMarks)) node.remove();
      svg.querySelector(TRACKS.day).style.removeProperty("--research-day-labels");
    }
  };
}

// the colours of .research-shift / .research-gap and their labels (research-scroll.css)
const SHIFT_RGBA = [233, 207, 149, .7], GAP_RGBA = [200, 102, 79, 1];
const SHIFT_VALUE_RGBA = [240, 226, 196, .8], GAP_LABEL_RGBA = [217, 128, 106, 1];
function mixRgba(a, b, f) {
  const c = a.map((v, i) => v + (b[i] - v) * f);
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(2)})`;
}

function setAttr(node, name, value) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
