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
const boundaryProofSvg = document.querySelector("#seasonal-boundary-proof-svg");
const orbitSvg = document.querySelector("#seasonal-drift-orbit");
const scrub = document.querySelector("#seasonal-drift-scrub");
const instrument = document.querySelector("#recurrence-instrument");
const secondaryTools = document.querySelector("#secondary-astronomy-tools");
const secondaryToolsMeta = document.querySelector("#secondary-astronomy-tools-meta");
const decomposition = document.querySelector("#seasonal-drift-decomposition");
const JIE_SUMMARY = baziJieDriftSummary(DATA.driftDays,indexForLongitude);
const JIE_BY_LONGITUDE = new Map(JIE_SUMMARY.rows.map(row => [row.longitudeDegrees,row]));
const compactProofMedia = window.matchMedia("(max-width:680px)");
const pairedProofMedia = window.matchMedia("(min-width:1020px)");

if (root && curveSvg && orbitSvg && scrub && boundaryProofSvg) {
  const initialParams = new URLSearchParams(location.search);
  const state = {
    index:indexForLongitude(315),
    mode:initialParams.get("seasonalView") === "split" ? "split" : "total",
    exaggerate:initialParams.get("seasonalOrbitScale") !== "true"
  };

  // One longitude axis and one day-scale ruler. The mean is a reference, not a second wave.
  const CURVE = { width:960,height:296,left:65,right:30,top:45,bottom:254,plotWidth:865,plotHeight:183 };

  const ORBIT = Object.freeze({
    width:470,
    height:420,
    cx:235,
    cy:205,
    baseRadius:112,
    labelRadius:151,
    timeRadius:178
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
    return DATA.meanDriftDays - selectedDrift();
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

  function activateBoundary(longitude,source="boundary-proof") {
    setIndex(indexForLongitude(longitude),source);
  }

  function drawBoundaryProofDesktop() {
    boundaryProofSvg.setAttribute("viewBox","0 0 1080 390");
    const left=72,right=28,top=52,bottom=82,max=15;
    const width=1080-left-right;
    const plotHeight=390-top-bottom;

    for (const tick of [0,5,10,15]) {
      const y=top+(tick/max)*plotHeight;
      svgEl("line",{
        x1:left,x2:1080-right,y1:y,y2:y,
        class:tick===0?"seasonal-proof-zero":"seasonal-proof-grid"
      },boundaryProofSvg);
      const label=svgEl("text",{
        x:left-12,y:y+4,"text-anchor":"end",class:"seasonal-proof-axis"
      },boundaryProofSvg);
      label.textContent=tick===0?"0 = 重合":tick+" d";
    }

    JIE_SUMMARY.rows.forEach((row,index)=>{
      const advance=-row.driftDays;
      const x=left+(index+.5)/JIE_SUMMARY.rows.length*width;
      const y=top+(advance/max)*plotHeight;
      const selected=indexForLongitude(row.longitudeDegrees)===state.index;
      const group=svgEl("g",{
        class:"seasonal-proof-group"+(selected?" is-selected":"")+(row.yearBoundary?" is-year":""),
        "data-longitude":row.longitudeDegrees
      },boundaryProofSvg);
      svgEl("line",{x1:x,x2:x,y1:top,y2:y,class:"seasonal-proof-stem"},group);
      svgEl("circle",{cx:x,cy:y,r:row.yearBoundary?7:5,class:"seasonal-proof-dot"},group);
      const value=svgEl("text",{x,y:y+19,"text-anchor":"middle",class:"seasonal-proof-value"},group);
      value.textContent=advance.toFixed(1);
      const term=svgEl("text",{x,y:390-bottom+38,"text-anchor":"middle",class:"seasonal-proof-label"},group);
      term.textContent=row.termName;
      const hit=svgEl("rect",{
        x:x-width/JIE_SUMMARY.rows.length/2,y:top-12,
        width:width/JIE_SUMMARY.rows.length,height:plotHeight+64,class:"seasonal-proof-hit"
      },group);
      hit.addEventListener("pointerdown",()=>activateBoundary(row.longitudeDegrees));
    });
  }

  // In the desktop paired plate, keep all twelve Jie readable in the
  // narrower left column. Evidence and click semantics stay unchanged.
  function drawBoundaryProofPaired() {
    const W=560,H=474,left=59,right=55,top=43,bottom=17,max=15;
    boundaryProofSvg.setAttribute("viewBox","0 0 "+W+" "+H);
    const width=W-left-right;
    const rowHeight=(H-top-bottom)/JIE_SUMMARY.rows.length;
    const xFor=value=>left+(value/max)*width;

    for(const tick of [0,5,10,15]){
      const x=xFor(tick);
      svgEl("line",{
        x1:x,x2:x,y1:top-12,y2:H-bottom,
        class:tick===0?"seasonal-proof-zero":"seasonal-proof-grid"
      },boundaryProofSvg);
      const label=svgEl("text",{
        x,y:20,"text-anchor":"middle",class:"seasonal-proof-axis"
      },boundaryProofSvg);
      label.textContent=tick===0?"0":tick+" d";
    }

    JIE_SUMMARY.rows.forEach((row,index)=>{
      const advance=-row.driftDays;
      const y=top+(index+.5)*rowHeight;
      const end=xFor(advance);
      const selected=indexForLongitude(row.longitudeDegrees)===state.index;
      const group=svgEl("g",{
        class:"seasonal-proof-group"+(selected?" is-selected":"")+(row.yearBoundary?" is-year":""),
        "data-longitude":row.longitudeDegrees
      },boundaryProofSvg);
      const term=svgEl("text",{
        x:left-12,y:y+4,"text-anchor":"end",class:"seasonal-proof-label"
      },group);
      term.textContent=row.termName;
      svgEl("line",{x1:left,x2:end,y1:y,y2:y,class:"seasonal-proof-stem"},group);
      svgEl("circle",{
        cx:end,cy:y,r:row.yearBoundary?6:4.5,class:"seasonal-proof-dot"
      },group);
      const value=svgEl("text",{
        x:end+10,y:y+4,"text-anchor":"start",class:"seasonal-proof-value"
      },group);
      value.textContent=advance.toFixed(1);
      const hit=svgEl("rect",{
        x:0,y:y-rowHeight/2,width:W,height:rowHeight,class:"seasonal-proof-hit"
      },group);
      hit.addEventListener("pointerdown",()=>activateBoundary(row.longitudeDegrees));
    });
  }

  function drawBoundaryProofMobile() {
    boundaryProofSvg.setAttribute("viewBox","0 0 390 430");
    const left=58,right=34,top=42,bottom=18,max=15;
    const width=390-left-right;
    const rowHeight=(430-top-bottom)/JIE_SUMMARY.rows.length;
    const xFor=value=>left+(value/max)*width;

    for (const tick of [0,5,10,15]) {
      const x=xFor(tick);
      svgEl("line",{
        x1:x,x2:x,y1:top-12,y2:430-bottom,
        class:tick===0?"seasonal-proof-zero":"seasonal-proof-grid"
      },boundaryProofSvg);
      const label=svgEl("text",{x,y:22,"text-anchor":"middle",class:"seasonal-proof-axis"},boundaryProofSvg);
      label.textContent=tick===0?"0":tick+" d";
    }

    JIE_SUMMARY.rows.forEach((row,index)=>{
      const advance=-row.driftDays;
      const y=top+(index+.5)*rowHeight;
      const end=xFor(advance);
      const selected=indexForLongitude(row.longitudeDegrees)===state.index;
      const group=svgEl("g",{
        class:"seasonal-proof-group"+(selected?" is-selected":"")+(row.yearBoundary?" is-year":""),
        "data-longitude":row.longitudeDegrees
      },boundaryProofSvg);
      const term=svgEl("text",{x:left-8,y:y+3,"text-anchor":"end",class:"seasonal-proof-label"},group);
      term.textContent=row.termName;
      svgEl("line",{x1:xFor(0),x2:end,y1:y,y2:y,class:"seasonal-proof-stem"},group);
      svgEl("circle",{cx:end,cy:y,r:row.yearBoundary?6:4,class:"seasonal-proof-dot"},group);
      const value=svgEl("text",{
        x:end>342?end-7:end+7,y:y+3,
        "text-anchor":end>342?"end":"start",class:"seasonal-proof-value"
      },group);
      value.textContent=advance.toFixed(1);
      const hit=svgEl("rect",{x:0,y:y-rowHeight/2,width:390,height:rowHeight,class:"seasonal-proof-hit"},group);
      hit.addEventListener("pointerdown",()=>activateBoundary(row.longitudeDegrees));
    });
  }

  function drawBoundaryProof() {
    clear(boundaryProofSvg);
    if (compactProofMedia.matches) drawBoundaryProofMobile();
    else if (pairedProofMedia.matches) drawBoundaryProofPaired();
    else drawBoundaryProofDesktop();
    boundaryProofSvg.dataset.ready="true";
  }


  function curveX(index) {
    return CURVE.left+(index/359)*CURVE.plotWidth;
  }

  function totalY(advanceDays) {
    // Single ruler: 0 is exact coincidence, all advance values use days.
    return CURVE.top+(advanceDays/15)*CURVE.plotHeight;
  }

  function drawCurve() {
    clear(curveSvg);
    const mobile=compactProofMedia.matches;
    Object.assign(CURVE,mobile
      ? {width:390,height:275,left:43,right:18,top:43,bottom:235,plotHeight:171}
      : {width:960,height:296,left:65,right:30,top:45,bottom:254,plotHeight:183});
    CURVE.plotWidth=CURVE.width-CURVE.left-CURVE.right;
    curveSvg.setAttribute("viewBox","0 0 "+CURVE.width+" "+CURVE.height);
    curveSvg.dataset.mode=state.mode;
    curveSvg.dataset.ready="true";
    curveSvg.dataset.grammar="single-advance-mean";

    // The sole plotted curve is the 360-point absolute advance. Its mean is
    // a constant level on exactly the same y axis, not a normalized waveform.
    const advances=DATA.driftDays.map(value=>-value);
    const meanAdvance=-DATA.meanDriftDays;
    const meanY=totalY(meanAdvance);
    const curvePath=advances.map((value,index)=>
      (index===0?"M ":"L ")+curveX(index).toFixed(2)+" "+totalY(value).toFixed(2)
    ).join(" ");

    for(const tick of [0,5,10,15]){
      const y=totalY(tick);
      svgEl("line",{x1:CURVE.left,x2:CURVE.width-CURVE.right,y1:y,y2:y,
        class:tick===0?"seasonal-drift-zero":"seasonal-drift-grid"},curveSvg);
      const axis=svgEl("text",{
        x:CURVE.left-10,y:y+4,"text-anchor":"end",class:"seasonal-drift-axis-label"
      },curveSvg);
      axis.textContent=tick+" d";
    }
    const zeroCaption=svgEl("text",{
      x:CURVE.left,y:CURVE.top-21,class:"seasonal-drift-zero-caption"
    },curveSvg);
    zeroCaption.textContent="0 = 完全重合";

    // A horizontal mean reference, on the very same day scale.
    svgEl("line",{x1:CURVE.left,x2:CURVE.width-CURVE.right,
      y1:meanY,y2:meanY,class:"seasonal-drift-mean-line"},curveSvg);

    svgEl("path",{d:curvePath,class:"seasonal-drift-curve-path"},curveSvg);
    BAZI_JIE_BOUNDARIES.forEach(boundary=>{
      const i=indexForLongitude(boundary.longitudeDegrees);
      const selected=i===state.index;
      svgEl("circle",{
        cx:curveX(i),cy:totalY(advances[i]),r:selected?4.7:2.5,
        class:"seasonal-drift-jie-dot"+(selected?" is-selected":"")
      },curveSvg);
    });

    const cursorX=curveX(state.index);
    const selectedY=totalY(advances[state.index]);
    const deviation=advances[state.index]-meanAdvance;
    // Deviation is the vertical distance between the selected value and its
    // mean reference; it must never create another y ruler or plotted wave.
    svgEl("line",{x1:cursorX,x2:cursorX,y1:CURVE.top,y2:CURVE.bottom,
      class:"seasonal-drift-cursor-line"},curveSvg);
    const bracketX=cursorX+(cursorX>CURVE.width-CURVE.right-25?-12:12);
    // A short bracket links the mean and selected point without obscuring the
    // dotted 0-to-15-day cursor. The two ends remain on the same day scale.
    svgEl("path",{
      d:"M "+cursorX+" "+meanY+" H "+bracketX+" V "+selectedY+" H "+cursorX,
      class:"seasonal-drift-deviation-stick"
    },curveSvg);
    svgEl("circle",{cx:cursorX,cy:selectedY,r:5.8,
      class:"seasonal-drift-cursor-dot"},curveSvg);
    svgEl("circle",{cx:cursorX,cy:meanY,r:3.8,
      class:"seasonal-drift-mean-cursor"},curveSvg);

    const gapLabel=svgEl("text",{
      x:cursorX>CURVE.width-155?cursorX-10:cursorX+10,
      y:Math.max(CURVE.top+18,selectedY-16),
      "text-anchor":cursorX>CURVE.width-155?"end":"start",
      class:"seasonal-drift-gap-label"},curveSvg);
    gapLabel.textContent=humanDrift(selectedDrift(),2);

    const ticks=[
      {longitude:270,label:"冬至"},{longitude:0,label:"春分"},
      {longitude:90,label:"夏至"},{longitude:180,label:"秋分"}
    ];
    for(const {longitude,label} of ticks){
      const xx=curveX(indexForLongitude(longitude));
      const axis=svgEl("text",{x:xx,y:CURVE.height-14,
        "text-anchor":"middle",class:"seasonal-drift-axis-label seasonal-drift-term-axis"},curveSvg);
      axis.textContent=label;
    }

    const hit=svgEl("rect",{
      x:CURVE.left,y:CURVE.top-6,width:CURVE.plotWidth,
      height:CURVE.bottom-CURVE.top+12,class:"seasonal-drift-hit"
    },curveSvg);
    hit.addEventListener("pointerdown",event=>{
      hit.setPointerCapture?.(event.pointerId);
      updateFromCurvePointer(event);
    });
    hit.addEventListener("pointermove",event=>{
      if(event.buttons===1||event.pointerType==="touch")updateFromCurvePointer(event);
    });
  }

  function updateFromCurvePointer(event) {
    const rect=curveSvg.getBoundingClientRect();
    const localX=(event.clientX-rect.left)/rect.width*CURVE.width;
    const fraction=Math.max(0,Math.min(1,(localX-CURVE.left)/CURVE.plotWidth));
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

    for (const [index,boundary] of BAZI_JIE_BOUNDARIES.entries()) {
      const selected = boundary.longitudeDegrees === longitude;
      const showLabel = boundary.yearBoundary || selected || index%3===0;
      const rayEnd = orbitDirectionXY(boundary.longitudeDegrees,ORBIT.baseRadius+30);
      const labelPoint = orbitDirectionXY(boundary.longitudeDegrees,ORBIT.labelRadius);
      svgEl("line", {
        x1:ORBIT.cx,
        y1:ORBIT.cy,
        x2:rayEnd.x,
        y2:rayEnd.y,
        class:`seasonal-orbit-bazi-boundary${selected ? " is-selected" : ""}`
      }, orbitSvg);
      if (showLabel) {
        const label = svgEl("text", {
          x:labelPoint.x,
          y:labelPoint.y+3,
          class:`seasonal-orbit-bazi-label${selected ? " is-selected" : ""}`,
          "text-anchor":Math.abs(labelPoint.x-ORBIT.cx)<12 ? "middle" : labelPoint.x<ORBIT.cx ? "end" : "start"
        }, orbitSvg);
        label.textContent = `${boundary.termName} · ${boundary.branch}`;
      }
    }
  }

  function arrivalTimeArcPath(startLongitude,endLongitude,radius) {
    const span=endLongitude-startLongitude;
    const steps=Math.max(2,Math.ceil(Math.abs(span)/2));
    const points=[];
    for (let step=0; step<=steps; step+=1) {
      const longitude=startLongitude+span*(step/steps);
      const p=orbitDirectionXY(longitude,radius);
      points.push((step===0?"M":"L")+" "+p.x.toFixed(2)+" "+p.y.toFixed(2));
    }
    return points.join(" ");
  }

  function drawArrivalTimeRing(longitude) {
    const defs=svgEl("defs",{},orbitSvg);
    const arrow=svgEl("marker",{
      id:"seasonal-orbit-time-arrow",
      markerWidth:8,markerHeight:8,refX:6,refY:4,
      orient:"auto",markerUnits:"userSpaceOnUse"
    },defs);
    svgEl("path",{d:"M 0 0 L 7 4 L 0 8 Z",class:"seasonal-orbit-time-arrowhead"},arrow);
    svgEl("circle",{
      cx:ORBIT.cx,cy:ORBIT.cy,r:ORBIT.timeRadius,class:"seasonal-orbit-time-ring"
    },orbitSvg);

    for (const boundary of BAZI_JIE_BOUNDARIES) {
      const evidence=JIE_BY_LONGITUDE.get(boundary.longitudeDegrees);
      if (!evidence) continue;
      const advanceDays=-evidence.driftDays;
      const advanceDegrees=advanceDays*(360/365.2425);
      const arrivalLongitude=boundary.longitudeDegrees-advanceDegrees;
      const selected=boundary.longitudeDegrees===longitude;
      const group=svgEl("g",{
        class:"seasonal-orbit-time-group"+(selected?" is-selected":"")+(boundary.yearBoundary?" is-year":""),
        "data-longitude":boundary.longitudeDegrees,
        "data-advance-days":advanceDays.toFixed(6)
      },orbitSvg);

      const baseA=orbitDirectionXY(boundary.longitudeDegrees,ORBIT.timeRadius-6);
      const baseB=orbitDirectionXY(boundary.longitudeDegrees,ORBIT.timeRadius+6);
      svgEl("line",{
        x1:baseA.x,y1:baseA.y,x2:baseB.x,y2:baseB.y,class:"seasonal-orbit-time-base"
      },group);
      svgEl("path",{
        d:arrivalTimeArcPath(arrivalLongitude,boundary.longitudeDegrees,ORBIT.timeRadius),
        class:"seasonal-orbit-time-arc"
      },group);
      const target=orbitDirectionXY(arrivalLongitude,ORBIT.timeRadius);
      svgEl("circle",{
        cx:target.x,cy:target.y,r:boundary.yearBoundary?5.5:3.5,class:"seasonal-orbit-time-target"
      },group);

      // Only the selected advance receives a strong direction arrow.
      // Every other Jie remains a subdued position reference around the dial.
      if (selected) {
        svgEl("path",{
          d:arrivalTimeArcPath(boundary.longitudeDegrees,arrivalLongitude,ORBIT.timeRadius),
          class:"seasonal-orbit-time-selection-arc",
          "marker-end":"url(#seasonal-orbit-time-arrow)"
        },group);
      }
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

    drawArrivalTimeRing(longitude);

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
      r:ORBIT.timeRadius+18,
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
    set("seasonal-drift-wave-active-name",namedTerm ?? "λ "+longitude+"°");
    set("seasonal-drift-wave-active-total",humanDrift(drift,2));
    set("seasonal-drift-wave-active-residual","全年平均提前 "+(-DATA.meanDriftDays).toFixed(2)+" 天 · 相對平均 "+signedDays(shape,2));
    set("seasonal-drift-phase-value",signedDays(DATA.meanDriftDays,3));
    set("seasonal-drift-shape-span",`${DATA.peakToPeakDays.toFixed(3)} d`);
    set("seasonal-residual-mean",humanDrift(DATA.meanDriftDays,3));
    set("seasonal-residual-span",`${(JIE_SUMMARY.maxAdvanceDays-JIE_SUMMARY.minAdvanceDays).toFixed(3)} d`);
    set("seasonal-orbit-active-term",namedTerm ?? `λ ${longitude}°`);
    set("seasonal-orbit-active-days",(-drift).toFixed(2));
    set("seasonal-drift-orbit-base-e",DATA.baseEllipse.eccentricity.toFixed(5));
    set("seasonal-drift-orbit-target-e",DATA.targetEllipse.eccentricity.toFixed(5));
    set("seasonal-drift-scale-label",state.exaggerate ? "形變 ×10" : "真實比例");

    scrub.value = String(state.index);
    root.dataset.selectedLongitude = String(longitude);
    root.dataset.baziMonthBranch = month.branch;
    root.dataset.baziBoundary = month.boundary?.termName ?? "";
    root.dataset.mode = state.mode;
    root.dataset.orbitScale = state.exaggerate ? "exaggerated" : "true";
    syncModeButtons();
    syncSecondaryDeltaLabel();
  }

  function render() {
    updateReadout();
    drawBoundaryProof();
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
      if (state.mode === "split" && decomposition) decomposition.open = true;
      render();
    });
  });

  decomposition?.addEventListener("toggle", () => {
    if (decomposition.open) return;
    if (state.mode !== "total") {
      state.mode = "total";
      render();
    }
  });

  if (state.mode === "split" && decomposition) decomposition.open = true;

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

  compactProofMedia.addEventListener?.("change",render);
  pairedProofMedia.addEventListener?.("change",render);

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