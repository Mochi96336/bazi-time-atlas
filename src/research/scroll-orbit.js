import { ECC, JIE, PERI, lerp, signed } from "./scroll-scenes.js";
import { arcPath, pointAt } from "../wheel/polar-geometry.js";

const NS = "http://www.w3.org/2000/svg";
const SUN = { x: 0, y: 0 };
const EXAGGERATION = 8;
const angle = longitude => 180 - longitude;
const eccentricity = e => Math.min(.6, e * EXAGGERATION);

function orbitPoint(longitude, e, peri, a) {
  const r = a * (1 - e * e) / (1 + e * Math.cos((longitude - peri) * Math.PI / 180));
  return pointAt(SUN, r, angle(longitude));
}

function attributes(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    const next = typeof v === "number" ? String(Math.round(v * 1000) / 1000) : v;
    if (node.getAttribute(k) !== next) node.setAttribute(k, next);
  }
}

export function createOrbitPlate(svg) {
  function el(parent, name, attrs, text) {
    const node = svg.ownerDocument.createElementNS(NS, name);
    attributes(node, attrs);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  }
  const group = el(svg, "g", {});
  for (const term of JIE) {
    const a = angle(term.longitude);
    const p = pointAt(SUN, 112, a), q = pointAt(SUN, 119, a), label = pointAt(SUN, 132, a);
    el(group, "line", { class: "ob-tick", x1: p.x, y1: p.y, x2: q.x, y2: q.y });
    el(group, "text", { class: "ob-jie", x: label.x, y: label.y + 4 }, term.name);
  }
  const old = el(group, "ellipse", { class: "ob-orbit-old" });
  const next = el(group, "ellipse", { class: "ob-orbit" });
  const rim = el(group, "g", {});
  const dots = el(group, "g", {});
  const rays = el(group, "g", {});
  const raysData = ["old", "current"].map(name => ({
    line: el(rays, "line", { class: `ob-peri ${name}` }),
    label: el(rays, "text", { class: `ob-peri-label ${name}` })
  }));
  const needle = el(group, "line", { class: "ob-needle" });
  el(group, "circle", { class: "ob-sun", r: 7 });
  const earth = el(group, "circle", { class: "ob-earth", r: 4.2 });
  const caption = el(svg, "text", { class: "ob-caption", x: 0, y: 153 }, `軌道俯視 · 偏心率放大 ×${EXAGGERATION}`);
  const legend = el(svg, "g", { display: "none" });
  for (const [x, variant, year] of [[-94, "old", "2026"], [18, "current", "26,026"]]) {
    el(legend, "line", { class: `ob-peri ${variant}`, x1: x, x2: x + 24, y1: 149, y2: 149 });
    el(legend, "text", { class: `ob-peri-label ${variant}`, x: x + 31, y: 155 }, year);
  }

  let lastKey;
  const arcs = [], marks = [];
  function patch(nodes, data, parent, tag, update) {
    data.forEach((item, i) => update(nodes[i] ?? (nodes[i] = el(parent, tag, {})), item));
    for (let i = data.length; i < nodes.length; i++) attributes(nodes[i], { opacity: 0 });
  }

  function ellipse(node, a, e, peri) {
    attributes(node, { cx: -a * e, rx: a, ry: a * Math.sqrt(1 - e * e), transform: `rotate(${angle(peri).toFixed(3)})` });
  }

  function draw(orbit, band) {
    const opacity = (orbit?.o ?? 0).toFixed(3);
    if (svg.style.opacity !== opacity) svg.style.opacity = opacity;
    if (Number(opacity) < .01 || !band) return;
    const big = (orbit.big ?? 0).toFixed(3);
    if (svg.style.getPropertyValue("--research-orbit-big") !== big) svg.style.setProperty("--research-orbit-big", big);
    attributes(legend, { display: orbit.legend ? "inline" : "none" });
    attributes(caption, { y: orbit.legend ? 181 : 153 });
    const morph = orbit.morph ?? 1, target = orbit.target;
    const oldE = eccentricity(ECC.from);
    const e = eccentricity(target?.e ?? lerp(ECC.from, ECC.to, morph));
    const peri = target?.peri ?? PERI.from + signed(PERI.to - PERI.from, 360) * morph;
    const a = 104 / (1 + Math.max(oldE, e));
    const key = JSON.stringify([e, peri, orbit.peri, target?.name, band.view, band.marks, band.arcs, band.window]);
    if (key === lastKey) return;
    lastKey = key;
    ellipse(old, a, oldE, PERI.from);
    ellipse(next, a, e, peri);

    const rimArcs = band.window ? [band.window, ...(band.arcs ?? [])] : band.arcs ?? [];
    patch(arcs, rimArcs, rim, "path", (node, arc) => {
      const start = angle(arc.from), end = start - signed(arc.to - arc.from, 360);
      attributes(node, { opacity: Math.abs(end - start) > .15 ? arc.o ?? 1 : 0,
        class: arc === band.window ? "ob-window" : arc.cls === "research-gap" ? "ob-gap" : "ob-shift",
        d: start === end ? "" : arcPath(SUN, 112, Math.min(start, end), Math.max(start, end)) });
    });
    patch(marks, band.marks ?? [], dots, "circle", (node, mark) => {
      const warm = mark.cls === "research-sun-mark";
      const p = orbitPoint(mark.lambda, warm ? e : oldE, warm ? peri : PERI.from, a);
      attributes(node, { opacity: mark.o ?? 1, cx: p.x, cy: p.y, r: warm ? 3.2 : 2.8,
        class: warm ? "ob-dot-warm" : mark.cls === "research-trail" ? "ob-dot-trail" : "ob-dot" });
    });
    const current = orbitPoint(band.view, e, peri, a);
    attributes(earth, { cx: current.x, cy: current.y });
    attributes(needle, { x2: current.x, y2: current.y });

    attributes(rays, { display: orbit.peri ? "inline" : "none" });
    if (!orbit.peri) return;
    const p0 = orbitPoint(PERI.from, oldE, PERI.from, a), p1 = orbitPoint(peri, e, peri, a);
    const close = Math.abs(signed(peri - PERI.from, 360)) < 30, oldLeft = p0.x <= p1.x;
    const name = target?.name ?? (morph === 1 ? "26026" : "軌道變化");
    for (const [i, p] of [p0, p1].entries()) {
      const { line, label } = raysData[i];
      const left = close ? (i === 0) === oldLeft : p.x > 0;
      const o = i === 0 || morph > .05 ? 1 : 0;
      attributes(line, { x2: p.x * 1.12, y2: p.y * 1.12, opacity: o });
      attributes(label, { x: p.x * (close ? .82 : .76) + (left ? -5 : 5),
        y: p.y * (close ? .82 : .76) + (close ? 4 : i === 0 ? -5 : 14),
        "text-anchor": left ? "end" : "start", opacity: o });
      const word = i === 0 ? "近日點 2026" : `近日點 ${name}`;
      if (label.textContent !== word) label.textContent = word;
    }
  }
  return { draw, destroy() { svg.replaceChildren(); } };
}
