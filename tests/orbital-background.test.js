import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createOrbitalSourceVelocityTracker,
  orbitalKineticIntensity,
  orbitalOcclusionRadiusWorld,
  orbitalRadiiWorld,
  orbitalTargetVelocityDegPerSec,
  orbitalVeilPresentation,
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

test("B1.3 source velocity tracker follows the rendered hour rotation and expires stale motion", () => {
  let now = 0;
  const tracker = createOrbitalSourceVelocityTracker({ nowMs:() => now, staleAfterMs:90 });
  assert.equal(tracker.observe(10, 0), 0);
  now = 20;
  assert.equal(tracker.observe(14, 20), 200);
  now = 70;
  assert.equal(tracker.current(), 200);
  now = 111;
  assert.equal(tracker.current(), 0);
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



test("B1.2 orbital coordinate rings and mask stay outside the canonical wheel envelope", () => {
  const radii = orbitalRadiiWorld(1182);
  const maskRadius = orbitalOcclusionRadiusWorld(1182);
  assert.equal(radii.length, 6);
  assert.equal(maskRadius, 1200);
  assert.ok(radii.every(radius => radius > maskRadius));
  assert.ok(radii.every((radius, index) => index === 0 || radius > radii[index - 1]));
  assert.ok(radii[0] < 1240, "first background orbit should remain close to the wheel rim");
});

test("B1.2 kinetic energy makes a hard fling substantially thicker and brighter", () => {
  assert.equal(orbitalKineticIntensity(0), 0);
  assert.equal(orbitalKineticIntensity(25), 0);
  assert.equal(orbitalKineticIntensity(220), 1);
  assert.equal(orbitalKineticIntensity(-220), 1);
  assert.ok(orbitalKineticIntensity(150) > 0.65);

  const idle = orbitalVeilPresentation(0, 0);
  const hot = orbitalVeilPresentation(0, 1);
  assert.equal(idle.strokeWidth, 0.85);
  assert.equal(hot.strokeWidth, 5.2);
  assert.ok(hot.strokeWidth > idle.strokeWidth * 6);
  assert.ok(hot.opacity > idle.opacity * 3);
});

test("B1 stays decorative and consumes only rendered hour-ring velocity", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
  const drag = readFileSync(new URL("../src/wheel/ring-drag-controller.js", import.meta.url), "utf8");
  const atlas = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");

  assert.match(html, /id="orbital-background" aria-hidden="true"/);
  assert.match(html, /class="orbital-space"[^>]*viewBox="0 0 1200 760"/);
  assert.match(html, /id="orbital-wheel-occlusion"/);
  assert.match(html, /class="orbital-occlusion-disc"/);
  assert.match(html, /class="orbital-static-rings"/);
  assert.equal((html.match(/class="orbital-static-ring orbital-static-ring-/g) ?? []).length, 6);
  assert.match(css, /#orbital-background\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.orbital-field\s*\{[\s\S]*?will-change:\s*auto;/);
  assert.match(css, /data-orbital-kinetic="true"[\s\S]*?will-change:\s*transform;/);
  assert.doesNotMatch(html, /class="orbital-grain"/);
  const orbitalCss = css.slice(
    css.indexOf("/* B1.2"),
    css.indexOf("#kinetic-wheel", css.indexOf("/* B1.2"))
  );
  assert.doesNotMatch(orbitalCss, /repeating-(?:linear|radial)-gradient/);
  assert.doesNotMatch(orbitalCss, /mix-blend-mode:/);
  assert.doesNotMatch(orbitalCss, /orbital-rings-primary|orbital-rings-secondary/);
  const orbital = readFileSync(new URL("../src/orbital-background.js", import.meta.url), "utf8");
  assert.match(orbital, /idleTickMs:125/);
  assert.match(orbital, /setCircleGeometry\(occlusionDisc, occlusionRadiusWorld\)/);
  assert.match(orbital, /const targetIntensity = orbitalKineticIntensity\\(sourceVelocity, config\\)/);
  assert.match(orbital, /veil\.style\.strokeWidth/);
  assert.match(orbital, /veil\.style\.opacity/);
  assert.match(orbital, /attributeFilter:\["data-drag-ring"\]/);
  assert.match(orbital, /if \(settledToIdle\)[\s\S]*?scheduleIdleTick\(\)/);
  assert.match(orbital, /function activateIdleMotion\(\)[\s\S]*?idleActivated = true/);
  assert.match(orbital, /addEventListener\?\.\("pointermove", activateIdleMotion/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.orbital-field/);
  assert.match(drag, /get currentAngularVelocityDegPerSec\(\)/);
  assert.match(atlas, /wheelOuterRadius:RADII\.outer/);
  assert.match(atlas, /hourOrbitalVelocity\.observe\(rotation\)/);
  assert.match(atlas, /orbitalBackground\?\.sourceMotionChanged\(\)/);
  assert.match(atlas, /getSourceAngularVelocityDegPerSec:\(\) => hourOrbitalVelocity\.current\(\)/);
  assert.doesNotMatch(atlas, /getWheelAngularVelocityDegPerSec:[\s\S]*?dragController/);
  assert.doesNotMatch(atlas, /getComputedStyle\([^)]*kinetic-wheel|DOMMatrix.*kinetic-wheel/);
});
