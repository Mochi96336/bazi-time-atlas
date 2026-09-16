import test from "node:test";
import assert from "node:assert/strict";

import {
  createAngularVelocityEstimator,
  shouldLaunchAngularInertia,
  stepAngularInertia
} from "../src/wheel/angular-inertia.js";

test("velocity estimator recovers constant speed with irregular samples", () => {
  const estimator = createAngularVelocityEstimator();
  estimator.reset(0);
  estimator.add(1.7, 17);
  estimator.add(2.4, 41);
  estimator.add(3.2, 73);
  estimator.add(2.7, 100);
  const velocity = estimator.velocityAt(102);
  assert.ok(Math.abs(velocity - 0.1) < 1e-12, `velocity was ${velocity}`);
});

test("stale release does not fling", () => {
  const estimator = createAngularVelocityEstimator();
  estimator.reset(0);
  estimator.add(5, 40);
  assert.equal(estimator.velocityAt(100), 0);
});

test("exponential integration is frame-rate independent", () => {
  function integrate(stepMs) {
    let velocityDegPerMs = 0.12;
    let degrees = 0;
    let elapsed = 0;
    while (elapsed < 500) {
      const deltaTimeMs = Math.min(stepMs, 500 - elapsed);
      const step = stepAngularInertia({ velocityDegPerMs, deltaTimeMs, timeConstantMs:220 });
      degrees += step.deltaDegrees;
      velocityDegPerMs = step.velocityDegPerMs;
      elapsed += deltaTimeMs;
    }
    return { degrees, velocityDegPerMs };
  }

  const at30Hz = integrate(1000 / 30);
  const at144Hz = integrate(1000 / 144);
  assert.ok(Math.abs(at30Hz.degrees - at144Hz.degrees) < 1e-10);
  assert.ok(Math.abs(at30Hz.velocityDegPerMs - at144Hz.velocityDegPerMs) < 1e-12);
});

test("launch threshold and reduced motion suppress unwanted coasting", () => {
  assert.equal(shouldLaunchAngularInertia(0.024), false);
  assert.equal(shouldLaunchAngularInertia(0.025), true);
  assert.equal(shouldLaunchAngularInertia(-0.1, { reducedMotion:true }), false);
});
