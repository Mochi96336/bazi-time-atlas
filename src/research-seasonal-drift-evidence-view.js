import {
  SEASONAL_DRIFT_26026_RESEARCH as DATA,
  indexForLongitude,
  longitudeForIndex
} from "./research/seasonal-drift-26026-research-data.js";
import { publishResearchTimeSelection } from "./research/research-time-state.js";
import {
  BAZI_JIE_BOUNDARIES,
  baziJieDriftSummary,
  baziMonthContextAtLongitude
} from "./research/bazi-seasonal-boundaries.js";

const NS = "http://www.w3.org/2000/svg";
const root = document.querySelector("#seasonal-drift-evidence");
const curveSvg = document.querySelector("#seasonal-drift-curve");
const orbitSvg = document.querySelector("#seasonal-drift-orbit");
const scrub = document.querySelector("#seasonal-drift-scrub");
const instrument = document.querySelector("#recurrence-instrument");
const secondaryTools = document.querySelector("#secondary-astronomy-tools");
const secondaryToolsMeta = document.querySelector("#secondary-astronomy-tools-meta");
const JIE_SUMMARY = baziJieDriftSummary(DATA.driftDays,indexForLongitude);

if (root && curveSvg && orbitSvg && scrub) {
  const initialParams = new URLSearchParams(location.search);
  const state = {
    index:indexForLongitude(315),
    mode:initialParams.get("seasonalView") === "split" ? "split" : "total",
    exaggerate:initialParams.get("seasonalOrbitScale") !== "true"
  };

  const CURVE = {
    width:760,
    height:330,
    left:62,
    right:24,
    top:24,
    bottom:52
  };
  CURVE.plotWidth = CURVE.width - CURVE.left - CURVE.right;
  CURVE.plotHeight = CURVE.height - CURVE.top - CURVE.bottom;

  const ORBIT = Object.freeze({
    width:470,
    height:420,
    cx:235,
    cy:205,
    baseRadius:142
  });

  function svgEl(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [key,value] of Object.entries(attrs)) {
      node.setAttribute(key, String(value));
    }
    parent.appendChild(node);
    return node;
  }

  function clear(svg) {
    svg.replaceChildren();
  }

  function signedDays(value, digits = 2) {
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) < 0.0005) return "0 d";
    return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)} d`;
  }

  function longitudeLabel(longitude) {
    return DATA.termNames[String(longitude)] ?? `λ ${longitude}°`;
  }

  function selectedDrift() {
    return DATA.driftDays[state.index];
  }

  function selectedShape() {
    return selectedDrift() - DATA.meanDriftDays;
  }

  function humanDrift(value, digits = 3) {
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) < 0.0005) return "幾乎重合";
    return `${value < 0 ? "提前" : "延後"} ${Math.abs(value).toFixed(digits)} 天`;
  }

  function secondaryHashTarget() {
    if (!secondaryTools || !location.hash) return null;
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return null;
    const target = document.getElementById(id);
    return target && secondaryTools.contains(target) ? target : null;
  }

  function revealSecondaryHashTarget() {
    const target = secondaryHashTarget();
    if (!target || !secondaryTools) return false;
    secondaryTools.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ block:"start" }));
    return true;
  }

  function syncSecondaryDeltaLabel() {
    const delta = Number(instrument?.dataset.deltaYears);
    if (!secondaryToolsMeta || !Number.isFinite(delta)) return;
    secondaryToolsMeta.textContent =
      `探索工具 · 目前 Δ = ${delta.toLocaleString("en-US")} 年 · 不影響上方固定 24,000 年主線`;
    if (secondaryTools) secondaryTools.dataset.explorerDelta = String(delta);
  }

  function syncModeButtons() {
    root.querySelectorAll("[data-seasonal-drift-mode]").forEach(item => {
      const active = item.dataset.seasonalDriftMode === state.mode;
      item.setAttribute("aria-pressed",String(active));
    });
  }

  function curveX(index) {
    return CURVE.left + (index / 359) * CURVE.plotWidth;
  }

  function totalY(value) {
    const min = -15;
    const max = 0;
    return CURVE.top + ((max - value) / (max - min)) * CURVE.plotHeight;
  }

  function shapeY(value) {
    const min = -2.35;
    const max = 2.35;
    return CURVE.top + ((max - value) / (max - min)) * CURVE.plotHeight;
  }

  function curveY(value) {
    return state.mode === "total" ? totalY(value) : shapeY(value);
  }

  function drawCurve() {
    clear(curveSvg);
    curveSvg.setAttribute("viewBox", `0 0 ${CURVE.width} ${CURVE.height}`);
    curveSvg.dataset.mode = state.mode;

    const values = state.mode === "total"
      ? DATA.driftDays
      : DATA.driftDays.map(value => value - DATA.meanDriftDays);

    const ticks = state.mode === "total"
      ? [0,-3,-6,-9,-12,-15]
      : [2,1,0,-1,-2];

    for (const tick of ticks) {
      const y = curveY(tick);
      svgEl("line", {
        x1:CURVE.left,
        x2:CURVE.width-CURVE.right,
        y1:y,
        y2:y,
        class:tick === 0 ? "seasonal-drift-zero" : "seasonal-drift-grid"
      }, curveSvg);
      const label = svgEl("text", {
        x:CURVE.left-12,
        y:y+4,
        class:"seasonal-drift-axis-label",
        "text-anchor":"end"
      }, curveSvg);
      label.textContent = `${tick} d`;
    }

    const path = values.map((value,index) =>
      `${index === 0 ? "M" : "L"} ${curveX(index).toFixed(2)} ${curveY(value).toFixed(2)}`
    ).join(" ");
    svgEl("path", { d:path, class:"seasonal-drift-curve-path" }, curveSvg);

    const major = [
      {longitude:270,label:"冬至"},
      {longitude:0,label:"春分"},
      {longitude:90,label:"夏至"},
      {longitude:180,label:"秋分"}
    ];
    major.forEach(({longitude,label}) => {
      const index = indexForLongitude(longitude);
      const x = curveX(index);
      svgEl("line", {
        x1:x,
        x2:x,
        y1:CURVE.height-CURVE.bottom,
        y2:CURVE.height-CURVE.bottom+8,
        class:"seasonal-drift-axis-tick"
      }, curveSvg);
      const text = svgEl("text", {
        x,
        y:CURVE.height-20,
        class:"seasonal-drift-axis-label seasonal-drift-term-axis",
        "text-anchor":"middle"
      }, curveSvg);
      text.textContent = label;
    });

    const cursorX = curveX(state.index);
    const cursorY = curveY(values[state.index]);

    if (state.mode === "total") {
      const zeroY = totalY(0);
      svgEl("line", {
        x1:cursorX,
        x2:cursorX,
        y1:zeroY,
        y2:cursorY,
        class:"seasonal-drift-gap-line"
      }, curveSvg);
      const gapLabel = svgEl("text", {
        x:cursorX > CURVE.width - 150 ? cursorX - 10 : cursorX + 10,
        y:(zeroY + cursorY) / 2,
        class:"seasonal-drift-gap-label",
        "text-anchor":cursorX > CURVE.width - 150 ? "end" : "start"
      }, curveSvg);
      gapLabel.textContent = humanDrift(values[state.index],2);
    }

    svgEl("line", {
      x1:cursorX,
      x2:cursorX,
      y1:CURVE.top,
      y2:CURVE.height-CURVE.bottom,
      class:"seasonal-drift-cursor-line"
    }, curveSvg);
    svgEl("circle", {
      cx:cursorX,
      cy:cursorY,
      r:6,
      class:"seasonal-drift-cursor-dot"
    }, curveSvg);

    const longitude = longitudeForIndex(state.index);
    const name = DATA.termNames[String(longitude)];
    if (name) {
      const marker = svgEl("text", {
        x:cursorX,
        y:Math.max(CURVE.top+16,cursorY-13),
        class:"seasonal-drift-cursor-label",
        "text-anchor":"middle"
      }, curveSvg);
      marker.textContent = name;
    }

    const hit = svgEl("rect", {
      x:CURVE.left,
      y:CURVE.top,
      width:CURVE.plotWidth,
      height:CURVE.plotHeight,
      class:"seasonal-drift-hit"
    }, curveSvg);
    hit.addEventListener("pointerdown", event => {
      hit.setPointerCapture?.(event.pointerId);
      updateFromCurvePointer(event);
    });
    hit.addEventListener("pointermove", event => {
      if (event.buttons === 1 || event.pointerType === "touch") updateFromCurvePointer(event);
    });
  }

  function updateFromCurvePointer(event) {
    const rect = curveSvg.getBoundingClientRect();
    const localX = (event.clientX - rect.left) / rect.width * CURVE.width;
    const fraction = Math.max(0,Math.min(1,(localX-CURVE.left)/CURVE.plotWidth));
    setIndex(Math.round(fraction*359),"curve");
  }

  function ellipseRadius(parameters, longitudeDegrees, exaggeration = 1) {
    const e = Math.min(0.35, parameters.eccentricity * exaggeration);
    const theta = longitudeDegrees * Math.PI / 180;
    const peri = parameters.perihelionSolarLongitudeDegrees * Math.PI / 180;
    return (1-e*e) / (1 + e*Math.cos(theta-peri));
  }

  function heliocentricEarthAngleDegrees(solarLongitudeDegrees) {
    return ((solarLongitudeDegrees + 180) % 360 + 360) % 360;
  }

  function solarLongitudeFromHeliocentricAngleDegrees(angleDegrees) {
    return ((angleDegrees - 180) % 360 + 360) % 360;
  }

  function orbitXY(parameters, longitudeDegrees, exaggeration = 1) {
    const earthAngle = heliocentricEarthAngleDegrees(longitudeDegrees) * Math.PI / 180;
    const radius = ellipseRadius(parameters,longitudeDegrees,exaggeration) * ORBIT.baseRadius;
    return {
      x:ORBIT.cx + Math.cos(earthAngle)*radius,
      y:ORBIT.cy - Math.sin(earthAngle)*radius
    };
  }

  function orbitPath(parameters, exaggeration = 1) {
    const points = [];
    for (let longitude=0; longitude<=360; longitude+=2) {
      const p = orbitXY(parameters,longitude % 360,exaggeration);
      points.push(`${longitude === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    }
    return points.join(" ") + " Z";
  }

  function orbitDirectionXY(longitudeDegrees, radius) {
    const angle = heliocentricEarthAngleDegrees(longitudeDegrees) * Math.PI / 180;
    return {
      x:ORBIT.cx + Math.cos(angle)*radius,
      y:ORBIT.cy - Math.sin(angle)*radius
    };
  }

  function longitudeArcPath(startLongitude, endLongitude, radius) {
    const span = ((endLongitude-startLongitude)%360+360)%360 || 360;
    const points = [];
    const steps = Math.max(2,Math.ceil(span/3));
    for (let step=0; step<=steps; step+=1) {
      const longitude = startLongitude + span*(step/steps);
      const p = orbitDirectionXY(longitude,radius);
      points.push(`${step === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    }
    return points.join(" ");
  }

  function drawBaziBoundaries(longitude) {
    const month = baziMonthContextAtLongitude(longitude);
    svgEl("path", {
      d:longitudeArcPath(month.startLongitudeDegrees,month.endLongitudeDegrees,ORBIT.baseRadius+20),
      class:"seasonal-orbit-bazi-month-arc"
    }, orbitSvg);

    for (const boundary of BAZI_JIE_BOUNDARIES) {
      const selected = boundary.longitudeDegrees === longitude;
      const rayEnd = orbitDirectionXY(boundary.longitudeDegrees,ORBIT.baseRadius+30);
      const labelPoint = orbitDirectionXY(boundary.longitudeDegrees,ORBIT.baseRadius+48);
      svgEl("line", {
        x1:ORBIT.cx,
        y1:ORBIT.cy,
        x2:rayEnd.x,
        y2:rayEnd.y,
        class:`seasonal-orbit-bazi-boundary${selected ? " is-selected" : ""}`
      }, orbitSvg);
      const label = svgEl("text", {
        x:labelPoint.x,
        y:labelPoint.y+3,
        class:`seasonal-orbit-bazi-label${selected ? " is-selected" : ""}`,
        "text-anchor":Math.abs(labelPoint.x-ORBIT.cx)<12 ? "middle" : labelPoint.x<ORBIT.cx ? "end" : "start"
      }, orbitSvg);
      label.textContent = `${boundary.termName} · ${boundary.branch}`;
    }
  }

  function drawOrbit() {
    clear(orbitSvg);
    orbitSvg.setAttribute("viewBox", `0 0 ${ORBIT.width} ${ORBIT.height}`);
    const exaggeration = state.exaggerate ? 10 : 1;
    const longitude = longitudeForIndex(state.index);

    drawBaziBoundaries(longitude);

    svgEl("circle", {
      cx:ORBIT.cx,
      cy:ORBIT.cy,
      r:ORBIT.baseRadius,
      class:"seasonal-orbit-reference"
    }, orbitSvg);

    svgEl("path", {
      d:orbitPath(DATA.baseEllipse,exaggeration),
      class:"seasonal-orbit-path seasonal-orbit-base"
    }, orbitSvg);
    svgEl("path", {
      d:orbitPath(DATA.targetEllipse,exaggeration),
      class:"seasonal-orbit-path seasonal-orbit-target"
    }, orbitSvg);

    [0,90,180,270].forEach(angle => {
      const end = {
        x:ORBIT.cx + Math.cos(angle*Math.PI/180)*(ORBIT.baseRadius+30),
        y:ORBIT.cy - Math.sin(angle*Math.PI/180)*(ORBIT.baseRadius+30)
      };
      svgEl("line", {
        x1:ORBIT.cx,
        y1:ORBIT.cy,
        x2:end.x,
        y2:end.y,
        class:"seasonal-orbit-guide"
      }, orbitSvg);
    });

    const earthAngleRadians = heliocentricEarthAngleDegrees(longitude) * Math.PI / 180;
    const rayEnd = {
      x:ORBIT.cx + Math.cos(earthAngleRadians)*(ORBIT.baseRadius+38),
      y:ORBIT.cy - Math.sin(earthAngleRadians)*(ORBIT.baseRadius+38)
    };
    svgEl("line", {
      x1:ORBIT.cx,
      y1:ORBIT.cy,
      x2:rayEnd.x,
      y2:rayEnd.y,
      class:"seasonal-orbit-selection-ray"
    }, orbitSvg);

    svgEl("circle", {
      cx:ORBIT.cx,
      cy:ORBIT.cy,
      r:10,
      class:"seasonal-orbit-sun"
    }, orbitSvg);

    const basePoint = orbitXY(DATA.baseEllipse,longitude,exaggeration);
    const targetPoint = orbitXY(DATA.targetEllipse,longitude,exaggeration);
    svgEl("circle", {
      cx:basePoint.x,
      cy:basePoint.y,
      r:5,
      class:"seasonal-orbit-point seasonal-orbit-point-base"
    }, orbitSvg);
    svgEl("circle", {
      cx:targetPoint.x,
      cy:targetPoint.y,
      r:7,
      class:"seasonal-orbit-point seasonal-orbit-point-target"
    }, orbitSvg);

    const targetTerm = DATA.termNames[String(longitude)];
    if (targetTerm) {
      const label = svgEl("text", {
        x:targetPoint.x,
        y:targetPoint.y-14,
        class:"seasonal-orbit-point-label",
        "text-anchor":"middle"
      }, orbitSvg);
      label.textContent = targetTerm;
    }

    const hit = svgEl("circle", {
      cx:ORBIT.cx,
      cy:ORBIT.cy,
      r:ORBIT.baseRadius+52,
      class:"seasonal-orbit-hit"
    }, orbitSvg);
    hit.addEventListener("pointerdown", event => {
      hit.setPointerCapture?.(event.pointerId);
      updateFromOrbitPointer(event);
    });
    hit.addEventListener("pointermove", event => {
      if (event.buttons === 1 || event.pointerType === "touch") updateFromOrbitPointer(event);
    });
  }

  function updateFromOrbitPointer(event) {
    const rect = orbitSvg.getBoundingClientRect();
    const x = (event.clientX-rect.left)/rect.width*ORBIT.width;
    const y = (event.clientY-rect.top)/rect.height*ORBIT.height;
    const earthAngle = Math.atan2(ORBIT.cy-y,x-ORBIT.cx)*180/Math.PI;
    const longitude = Math.round(solarLongitudeFromHeliocentricAngleDegrees(earthAngle));
    setIndex(indexForLongitude(longitude),"orbit");
  }

  function updateReadout() {
    const longitude = longitudeForIndex(state.index);
    const drift = selectedDrift();
    const shape = selectedShape();
    const month = baziMonthContextAtLongitude(longitude);
    const namedTerm = DATA.termNames[String(longitude)] ?? null;
    const termName = namedTerm
      ? `${namedTerm} · ${month.boundary ? `${month.branch}月界` : `${month.branch}月`}`
      : `${month.branch}月區段`;

    const set = (id,value) => {
      const node = document.querySelector(`#${id}`);
      if (node) node.textContent = value;
    };

    set("seasonal-drift-selected-name",termName);
    set("seasonal-drift-selected-longitude",`${longitude}°`);
    set(
      "seasonal-drift-selected-bazi",
      month.boundary
        ? `${month.boundary.yearBoundary ? "年界＋" : ""}${month.branch}月起點`
        : `${month.branch}月 · 下一界 ${month.endTerm}`
    );
    set("seasonal-drift-jie-count",`${JIE_SUMMARY.displacedCount} / ${JIE_SUMMARY.count}`);
    set(
      "seasonal-drift-jie-range",
      `提前 ${JIE_SUMMARY.minAdvanceDays.toFixed(3)}–${JIE_SUMMARY.maxAdvanceDays.toFixed(3)} 天`
    );
    set("seasonal-drift-selected-total",signedDays(drift,3));
    set("seasonal-drift-selected-total-human",humanDrift(drift,3));
    set("seasonal-drift-selected-shape",signedDays(shape,3));
    set("seasonal-drift-phase-value",signedDays(DATA.meanDriftDays,3));
    set("seasonal-drift-shape-span",`${DATA.peakToPeakDays.toFixed(3)} d`);
    set("seasonal-drift-orbit-base-e",DATA.baseEllipse.eccentricity.toFixed(5));
    set("seasonal-drift-orbit-target-e",DATA.targetEllipse.eccentricity.toFixed(5));
    set("seasonal-drift-scale-label",state.exaggerate ? "形變 ×10" : "真實比例");

    scrub.value = String(state.index);
    root.dataset.selectedLongitude = String(longitude);
    root.dataset.mode = state.mode;
    root.dataset.orbitScale = state.exaggerate ? "exaggerated" : "true";
    syncModeButtons();
    syncSecondaryDeltaLabel();
  }

  function render() {
    updateReadout();
    drawCurve();
    drawOrbit();
  }

  function setIndex(index,source="unknown") {
    const next = Math.max(0,Math.min(359,Math.round(index)));
    if (next === state.index && source !== "init") return;
    state.index = next;
    root.dataset.cursorSource = source;
    render();
    publishResearchTimeSelection({
      owner:"seasonal",
      longitudeDegrees:longitudeForIndex(state.index),
      source
    });
  }

  root.querySelectorAll("[data-seasonal-drift-mode]").forEach(button => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.seasonalDriftMode === "split" ? "split" : "total";
      render();
    });
  });

  document.querySelector("#seasonal-drift-orbit-scale")?.addEventListener("click", event => {
    state.exaggerate = !state.exaggerate;
    event.currentTarget.setAttribute("aria-pressed",String(state.exaggerate));
    render();
  });

  scrub.addEventListener("input", () => setIndex(Number(scrub.value),"keyboard-slider"));

  root.addEventListener("keydown", event => {
    if (!["ArrowLeft","ArrowRight"].includes(event.key)) return;
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    setIndex(state.index + (event.key === "ArrowRight" ? 1 : -1),"keyboard");
  });

  if (instrument) {
    new MutationObserver(syncSecondaryDeltaLabel).observe(instrument, {
      attributes:true,
      attributeFilter:["data-delta-years"]
    });
  }

  window.addEventListener("hashchange", () => {
    syncSecondaryDeltaLabel();
    revealSecondaryHashTarget();
  });
  window.addEventListener("load", () => {
    syncSecondaryDeltaLabel();
    revealSecondaryHashTarget();
  }, { once:true });

  root.dataset.ready = "true";
  render();
  publishResearchTimeSelection({
    owner:"seasonal",
    longitudeDegrees:longitudeForIndex(state.index),
    source:"init"
  });
}