import {
  SEASONAL_DRIFT_26026_RESEARCH as DATA,
  indexForLongitude,
  longitudeForIndex
} from "./research/seasonal-drift-26026-research-data.js";

const NS = "http://www.w3.org/2000/svg";
const root = document.querySelector("#seasonal-drift-prototype");
const curveSvg = document.querySelector("#seasonal-drift-curve");
const orbitSvg = document.querySelector("#seasonal-drift-orbit");
const scrub = document.querySelector("#seasonal-drift-scrub");

if (root && curveSvg && orbitSvg && scrub) {
  const state = {
    index:indexForLongitude(315),
    mode:"total",
    exaggerate:true
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
    return selectedDrift() - DATA.commonPhaseDays;
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
      : DATA.driftDays.map(value => value - DATA.commonPhaseDays);

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

    if (state.mode === "total") {
      const phaseY = totalY(DATA.commonPhaseDays);
      svgEl("line", {
        x1:CURVE.left,
        x2:CURVE.width-CURVE.right,
        y1:phaseY,
        y2:phaseY,
        class:"seasonal-drift-phase-line"
      }, curveSvg);
      const phaseLabel = svgEl("text", {
        x:CURVE.width-CURVE.right-4,
        y:phaseY-8,
        class:"seasonal-drift-phase-label",
        "text-anchor":"end"
      }, curveSvg);
      phaseLabel.textContent = `共同 phase ${signedDays(DATA.commonPhaseDays,2)}`;
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

  function orbitXY(parameters, longitudeDegrees, exaggeration = 1) {
    const theta = longitudeDegrees * Math.PI / 180;
    const radius = ellipseRadius(parameters,longitudeDegrees,exaggeration) * ORBIT.baseRadius;
    return {
      x:ORBIT.cx + Math.cos(theta)*radius,
      y:ORBIT.cy - Math.sin(theta)*radius
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

  function drawOrbit() {
    clear(orbitSvg);
    orbitSvg.setAttribute("viewBox", `0 0 ${ORBIT.width} ${ORBIT.height}`);
    const exaggeration = state.exaggerate ? 10 : 1;
    const longitude = longitudeForIndex(state.index);

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

    const rayEnd = {
      x:ORBIT.cx + Math.cos(longitude*Math.PI/180)*(ORBIT.baseRadius+38),
      y:ORBIT.cy - Math.sin(longitude*Math.PI/180)*(ORBIT.baseRadius+38)
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
    const angle = Math.atan2(ORBIT.cy-y,x-ORBIT.cx)*180/Math.PI;
    const longitude = ((Math.round(angle)%360)+360)%360;
    setIndex(indexForLongitude(longitude),"orbit");
  }

  function updateReadout() {
    const longitude = longitudeForIndex(state.index);
    const drift = selectedDrift();
    const shape = selectedShape();
    const termName = DATA.termNames[String(longitude)] ?? "任意黃經";

    const set = (id,value) => {
      const node = document.querySelector(`#${id}`);
      if (node) node.textContent = value;
    };

    set("seasonal-drift-selected-name",termName);
    set("seasonal-drift-selected-longitude",`${longitude}°`);
    set("seasonal-drift-selected-total",signedDays(drift,3));
    set("seasonal-drift-selected-shape",signedDays(shape,3));
    set("seasonal-drift-phase-value",signedDays(DATA.commonPhaseDays,3));
    set("seasonal-drift-shape-span",`${DATA.peakToPeakDays.toFixed(3)} d`);
    set("seasonal-drift-orbit-base-e",DATA.baseEllipse.eccentricity.toFixed(5));
    set("seasonal-drift-orbit-target-e",DATA.targetEllipse.eccentricity.toFixed(5));
    set("seasonal-drift-scale-label",state.exaggerate ? "形變 ×10" : "真實比例");

    scrub.value = String(state.index);
    root.dataset.mode = state.mode;
    root.dataset.orbitScale = state.exaggerate ? "exaggerated" : "true";
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
  }

  root.querySelectorAll("[data-seasonal-drift-mode]").forEach(button => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.seasonalDriftMode === "split" ? "split" : "total";
      root.querySelectorAll("[data-seasonal-drift-mode]").forEach(item => {
        const active = item.dataset.seasonalDriftMode === state.mode;
        item.setAttribute("aria-pressed",String(active));
      });
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

  root.dataset.ready = "true";
  render();
}
