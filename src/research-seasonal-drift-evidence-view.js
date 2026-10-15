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
      const labelPoint = orbitDirectionXY(boundary.longitudeDegrees,ORBIT.baseRadius+38);
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