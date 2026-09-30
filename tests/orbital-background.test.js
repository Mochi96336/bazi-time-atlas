import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  orbitalRadiiWorld,
  orbitalTargetVelocityDegPerSec,
  orbitalViewportGeometry,
  stepOrbitalVelocityDegPerSec
} from "../src/orbital-background.js";

test("orbital target idles below the quiet threshold and preserves fling direction", () => {
  assert.equal(orbitalTargetVelocityDegPerSec(0), 0.42);
  assert.equal(orbitalTargetVelocityDegPerSec(0.79), 0.42);
  assert.equal(orbitalTargetVelocityDegPerSec(100), 8.5);
  assert.equal(orbitalTargetVelocityDegPerSec(-100), -8.5);
  assert.equal(orbitalTargetVelocityDegPerSec(1000), 32);
  assert.equal(orbitalTargetVelocityDegPerSec(-1000), -32);
});

test("orbital velocity smoothing approaches rather than snaps to target", () => {
  const fast = stepOrbitalVelocityDegPerSec(0.42, 20, 1 / 60, 7.5);
  const released = stepOrbitalVelocityDegPerSec(20, 0.42, 1 / 60, 2.25);
  assert.ok(fast > 0.42 && fast < 20);
  assert.ok(released > 0.42 && released < 20);
  assert.ok((fast - 0.42) > (20 - released));
});

test("orbital geometry maps the canonical wheel center through the SVG meet camera", () => {
  const geometry = orbitalViewportGeometry({
    width:1200,
    height:760,
    viewBoxWidth:1200,
    viewBoxHeight:760,
    wheelCenter:{ x:600, y:1360 }
  });
  assert.equal(geometry.scale, 1);
  assert.equal(geometry.centerX, 600);
  assert.equal(geometry.centerY, 1360);
});



test("B1.1 orbital coordinate rings stay outside the canonical wheel envelope", () => {
  const radii = orbitalRadiiWorld(1182);
  assert.equal(radii.length, 6);
  assert.ok(radii.every(radius => radius > 1182));
  assert.ok(radii.every((radius, index) => index === 0 || radius > radii[index - 1]));
  assert.ok(radii[0] < 1260, "first background orbit should sit just beyond the wheel rim");
});

test("B1 stays decorative and consumes a read-only wheel velocity", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
  const drag = readFileSync(new URL("../src/wheel/ring-drag-controller.js", import.meta.url), "utf8");
  const atlas = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");

  assert.match(html, /id="orbital-background" aria-hidden="true"/);
  assert.match(css, /#orbital-background\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.orbital-field\s*\{[\s\S]*?will-change:\s*auto;/);
  assert.match(css, /data-orbital-kinetic="true"[\s\S]*?will-change:\s*transform;/);
  assert.doesNotMatch(html, /class="orbital-grain"/);
  const orbitalCss = css.slice(
    css.indexOf("/* B1.1"),
    css.indexOf("#kinetic-wheel", css.indexOf("/* B1.1"))
  );
  assert.doesNotMatch(orbitalCss, /repeating-(?:linear|radial)-gradient/);
  assert.doesNotMatch(orbitalCss, /mix-blend-mode:/);
  const orbital = readFileSync(new URL("../src/orbital-background.js", import.meta.url), "utf8");
  assert.match(orbital, /idleTickMs:125/);
  assert.match(orbital, /attributeFilter:\["data-drag-ring"\]/);
  assert.match(orbital, /if \(settledToIdle\)[\s\S]*?scheduleIdleTick\(\)/);
  assert.match(orbital, /function activateIdleMotion\(\)[\s\S]*?idleActivated = true/);
  assert.match(orbital, /addEventListener\?\.\("pointermove", activateIdleMotion/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.orbital-field/);
  assert.match(drag, /get currentAngularVelocityDegPerSec\(\)/);
  assert.match(atlas, /wheelOuterRadius:RADII\.outer/);
  assert.match(atlas, /getWheelAngularVelocityDegPerSec:\(\) => dragController\?\.currentAngularVelocityDegPerSec \?\? 0/);
  assert.doesNotMatch(atlas, /getComputedStyle\([^)]*kinetic-wheel|DOMMatrix.*kinetic-wheel/);
});
