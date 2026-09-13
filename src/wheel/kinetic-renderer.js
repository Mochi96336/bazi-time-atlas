import {
  CURSOR_ANGLE,
  FAN,
  GUIDE_RADII,
  RADII,
  SEXAGENARY_RING_IDS,
  WHEEL_CENTER,
  ringModel
} from "./ring-model.js";
import {
  annularSectorPath,
  arcPath,
  pointAt,
  rotationTransform
} from "./polar-geometry.js";
import { addTitle, setActiveSector, svgElement } from "./svg-renderer.js";

export function createKineticRenderer({ svg, sexagenary, solarTerms, zodiacSigns }) {
  const cycleSectors = new Map();
  const termSectorNodes = [];
  const zodiacSectorNodes = [];

  const groupFor = id => svg.querySelector(`#${ringModel(id).groupId}`);
  const guides = svg.querySelector("#guide-layer");
  const cursorLayer = svg.querySelector("#cursor-layer");
  const solarTrack = groupFor("solar");
  const zodiacTrack = groupFor("zodiac");

  const el = (tag, attrs = {}, parent = svg) => svgElement(tag, attrs, parent);
  const polar = (radius, angle) => pointAt(WHEEL_CENTER, radius, angle);

  function renderGuides() {
    GUIDE_RADII.forEach(radius => {
      el("path", {
        d: arcPath(WHEEL_CENTER, radius, FAN.start, FAN.end),
        class: "guide-arc"
      }, guides);
    });
  }

  function renderCycleRing(id) {
    const model = ringModel(id);
    const group = groupFor(id);
    const sectors = [];
    group.classList.add("ring-track", `${id}-track`);

    sexagenary.forEach((label, index) => {
      const start = index * 6 + .18;
      const end = (index + 1) * 6 - .18;
      const path = el("path", {
        d: annularSectorPath(WHEEL_CENTER, model.innerRadius, model.outerRadius, start, end),
        class: `cycle-sector ${model.className}`,
        "data-cycle-index": index,
        "data-cycle-label": label
      }, group);
      addTitle(path, `${index + 1} · ${label}`);
      sectors.push(path);

      const tickAngle = index * 6;
      const inner = polar(model.outerRadius - 8, tickAngle);
      const outer = polar(model.outerRadius, tickAngle);
      el("line", {
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        class: `ring-tick${index % 5 === 0 ? " major" : ""}`
      }, group);

      if (index % 5 === 0) {
        const radius = (model.innerRadius + model.outerRadius) / 2;
        const point = polar(radius, index * 6 + 3);
        const text = el("text", {
          x: point.x,
          y: point.y,
          class: "cycle-label",
          transform: `rotate(${index * 6 + 93} ${point.x} ${point.y})`
        }, group);
        text.textContent = label;
      }
    });
    cycleSectors.set(id, sectors);
  }

  function renderSolarRing() {
    solarTerms.forEach((term, index) => {
      const path = el("path", {
        d: annularSectorPath(
          WHEEL_CENTER,
          RADII.dayOuter,
          RADII.solarOuter,
          term.longitude + .15,
          term.longitude + 15 - .15
        ),
        class: `term-sector ${term.kind}`,
        "data-term-index": index
      }, solarTrack);
      addTitle(path, `${term.name} · ${term.longitude}°`);
      termSectorNodes.push(path);

      const markInner = polar(RADII.dayOuter, term.longitude);
      const markOuter = polar(term.kind === "jie" ? RADII.solarOuter : RADII.solarOuter - 12, term.longitude);
      el("line", {
        x1: markInner.x,
        y1: markInner.y,
        x2: markOuter.x,
        y2: markOuter.y,
        class: `term-mark ${term.kind}`
      }, solarTrack);

      const labelPoint = polar(term.kind === "jie" ? RADII.solarOuter - 32 : RADII.solarOuter - 44, term.longitude + 7.5);
      const label = el("text", {
        x: labelPoint.x,
        y: labelPoint.y,
        class: `term-label ${term.kind}`,
        transform: `rotate(${term.longitude + 97.5} ${labelPoint.x} ${labelPoint.y})`
      }, solarTrack);
      label.textContent = term.name;
    });
  }

  function renderZodiacRing() {
    zodiacSigns.forEach((sign, index) => {
      const path = el("path", {
        d: annularSectorPath(
          WHEEL_CENTER,
          RADII.solarOuter,
          RADII.zodiacOuter,
          sign.start + .15,
          sign.end - .15
        ),
        class: "zodiac-sector",
        "data-zodiac-index": index
      }, zodiacTrack);
      addTitle(path, `${sign.name} · ${sign.element} · ${sign.modality}`);
      zodiacSectorNodes.push(path);

      const angle = sign.start + 15;
      const point = polar((RADII.solarOuter + RADII.zodiacOuter) / 2, angle);
      const label = el("text", {
        x: point.x,
        y: point.y,
        class: "zodiac-label",
        transform: `rotate(${angle + 90} ${point.x} ${point.y})`
      }, zodiacTrack);
      label.textContent = sign.name;
    });
  }

  function renderCursor() {
    const inner = polar(RADII.inner - 12, CURSOR_ANGLE);
    const outer = polar(RADII.zodiacOuter + 12, CURSOR_ANGLE);
    el("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-halo" }, cursorLayer);
    el("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-line" }, cursorLayer);
    const cap = polar(RADII.zodiacOuter + 21, CURSOR_ANGLE);
    el("path", {
      d: `M ${cap.x - 6} ${cap.y - 1} L ${cap.x + 6} ${cap.y - 1} L ${cap.x} ${cap.y + 10} Z`,
      class: "cursor-cap"
    }, cursorLayer);
    const label = polar(RADII.zodiacOuter + 40, CURSOR_ANGLE);
    const text = el("text", { x: label.x, y: label.y, class: "cursor-note" }, cursorLayer);
    text.textContent = "SELECTED INSTANT";
  }

  function renderStatic() {
    renderGuides();
    SEXAGENARY_RING_IDS.forEach(renderCycleRing);
    renderSolarRing();
    renderZodiacRing();
    renderCursor();
  }

  function setCyclePose(id, rotationDegrees, activeIndex) {
    groupFor(id).setAttribute("transform", rotationTransform(rotationDegrees, WHEEL_CENTER));
    setActiveSector(cycleSectors.get(id) ?? [], activeIndex);
  }

  function setSolarPose(rotationDegrees, solarLongitude) {
    const transform = rotationTransform(rotationDegrees, WHEEL_CENTER);
    solarTrack.setAttribute("transform", transform);
    zodiacTrack.setAttribute("transform", transform);
    setActiveSector(termSectorNodes, Math.floor(((solarLongitude % 360) + 360) % 360 / 15) % 24);
    setActiveSector(zodiacSectorNodes, Math.floor(((solarLongitude % 360) + 360) % 360 / 30) % 12);
  }

  return Object.freeze({
    renderStatic,
    setCyclePose,
    setSolarPose
  });
}
