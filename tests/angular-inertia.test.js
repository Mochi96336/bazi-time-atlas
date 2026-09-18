import test from "node:test";
import assert from "node:assert/strict";

import {
  ANGULAR_INERTIA_DEFAULTS,
  adaptiveAngularTimeConstant,
  createAngularVelocityEstimator,
  shouldLaunchAngularInertia,
  stepAdaptiveAngularInertia,
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

test("rejected timestamps do not contaminate the next valid velocity sample", () => {
  const estimator = createAngularVelocityEstimator();
  estimator.reset(0);
  assert.equal(estimator.add(1, 10), true);
  assert.equal(estimator.add(40, Number.NaN), false);
  assert.equal(estimator.add(40, 5), false);
  assert.equal(estimator.add(1, 20), true);
  const velocity = estimator.velocityAt(20);
  assert.ok(Math.abs(velocity - 0.1) < 1e-12, `velocity was ${velocity}`);
});

test("exponential integration is frame-rate independent", () => {
  function integrate(stepMs) {
    let velocityDegPerMs = 0.12;
    let degrees = 0;
    let elapsed = 0;
    while (elapsed < 500) {
      const deltaTimeMs = Math.min(stepMs, 500 - elapsed);
      const step = stepAngularInertia({
        velocityDegPerMs,
        deltaTimeMs,
        timeConstantMs:ANGULAR_INERTIA_DEFAULTS.timeConstantMs
      });
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


test("adaptive damping keeps low-speed precision and opens smoothly at high speed", () => {
  assert.equal(adaptiveAngularTimeConstant(0.02), 200);
  assert.equal(adaptiveAngularTimeConstant(0.04), 200);
  assert.ok(Math.abs(adaptiveAngularTimeConstant(0.095) - 340) < 1e-9);
  assert.equal(adaptiveAngularTimeConstant(0.15), 480);
  assert.equal(adaptiveAngularTimeConstant(0.2), 480);
  assert.equal(adaptiveAngularTimeConstant(-0.095), adaptiveAngularTimeConstant(0.095));

  const samples = [0.04, 0.06, 0.08, 0.1, 0.12, 0.15]
    .map(speed => adaptiveAngularTimeConstant(speed));
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(samples[index] >= samples[index - 1]);
  }
});

test("adaptive inertia integration remains refresh-rate independent", () => {
  function integrate(stepMs) {
    let velocityDegPerMs = 0.18;
    let degrees = 0;
    let elapsed = 0;
    while (elapsed < 800) {
      const deltaTimeMs = Math.min(stepMs, 800 - elapsed);
      const step = stepAdaptiveAngularInertia({ velocityDegPerMs, deltaTimeMs });
      degrees += step.deltaDegrees;
      velocityDegPerMs = step.velocityDegPerMs;
      elapsed += deltaTimeMs;
    }
    return { degrees, velocityDegPerMs };
  }

  const at30Hz = integrate(1000 / 30);
  const at144Hz = integrate(1000 / 144);
  assert.ok(Math.abs(at30Hz.degrees - at144Hz.degrees) < 1e-8);
  assert.ok(Math.abs(at30Hz.velocityDegPerMs - at144Hz.velocityDegPerMs) < 1e-10);
});

test("release speed maps progressively to coast distance before the emergency fence", () => {
  function coastDistance(releaseSpeedDegPerMs) {
    let velocityDegPerMs = releaseSpeedDegPerMs;
    let degrees = 0;
    while (Math.abs(velocityDegPerMs) > ANGULAR_INERTIA_DEFAULTS.stopSpeedDegPerMs) {
      const step = stepAdaptiveAngularInertia({ velocityDegPerMs, deltaTimeMs:1 });
      degrees += Math.abs(step.deltaDegrees);
      velocityDegPerMs = step.velocityDegPerMs;
    }
    return degrees;
  }

  const thresholdFlick = coastDistance(0.025);
  const lightFlick = coastDistance(0.05);
  const mediumFlick = coastDistance(0.1);
  const fastFlick = coastDistance(0.18);

  assert.ok(thresholdFlick > 3 && thresholdFlick < 6);
  assert.ok(lightFlick > 8 && lightFlick < 11);
  assert.ok(mediumFlick > 20 && mediumFlick < 26);
  assert.ok(fastFlick > 55 && fastFlick < 65);
  assert.ok(fastFlick / lightFlick > 5, "high-speed coast should grow faster than release speed alone");
  assert.ok(fastFlick < ANGULAR_INERTIA_DEFAULTS.maxTravelDegrees);
});

test("adaptive inertia defaults reserve max travel for runaway protection", () => {
  assert.equal(ANGULAR_INERTIA_DEFAULTS.launchSpeedDegPerMs, 0.025);
  assert.equal(ANGULAR_INERTIA_DEFAULTS.stopSpeedDegPerMs, 0.0035);
  assert.equal(ANGULAR_INERTIA_DEFAULTS.timeConstantMs, 280);
  assert.equal(ANGULAR_INERTIA_DEFAULTS.adaptiveLowSpeedDegPerMs, 0.04);
  assert.equal(ANGULAR_INERTIA_DEFAULTS.adaptiveHighSpeedDegPerMs, 0.15);
  assert.equal(ANGULAR_INERTIA_DEFAULTS.adaptiveLowTimeConstantMs, 200);
  assert.equal(ANGULAR_INERTIA_DEFAULTS.adaptiveHighTimeConstantMs, 480);
  assert.equal(ANGULAR_INERTIA_DEFAULTS.maxTravelDegrees, 120);
});
