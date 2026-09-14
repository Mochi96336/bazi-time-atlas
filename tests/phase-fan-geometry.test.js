import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizedPhase,
  phaseAngleOnFan,
  phaseFanCells,
  signedShortestPhase
} from "../src/recurrence/phase-fan-geometry.js";

test("cyclic phases use shortest signed displacement around zero", () => {
  assert.equal(normalizedPhase(400, 400), 0);
  assert.equal(signedShortestPhase(0, 60), 0);
  assert.equal(signedShortestPhase(29, 60), 29);
  assert.equal(signedShortestPhase(30, 60), 30);
  assert.equal(signedShortestPhase(40, 60), -20);
  assert.equal(signedShortestPhase(57, 60), -3);
  assert.equal(signedShortestPhase(380, 400), -20);
});

test("the whole cyclic phase domain remains visible inside the fixed 160-degree fan", () => {
  assert.equal(phaseAngleOnFan({ phase:0, modulus:60 }), -90);
  assert.ok(Math.abs(phaseAngleOnFan({ phase:40, modulus:60 }) - (-143.3333333333)) < 1e-9);
  assert.equal(phaseAngleOnFan({ phase:57, modulus:60 }), -98);
  assert.equal(phaseAngleOnFan({ phase:380, modulus:400 }), -98);
  assert.equal(phaseAngleOnFan({ phase:30, modulus:60 }), -10);
  for (let phase = 0; phase < 400; phase += 1) {
    const angle = phaseAngleOnFan({ phase, modulus:400 });
    assert.ok(angle >= -170 && angle <= -10, `phase ${phase} escaped fan at ${angle}`);
  }
});

test("fan cells divide the visible gauge rather than constructing a hidden full circle", () => {
  const year = phaseFanCells({ modulus:60, sectors:60 });
  assert.equal(year.length, 60);
  assert.equal(year[0].startAngle, -170);
  assert.equal(year[30].startAngle, -90);
  assert.equal(year.at(-1).endAngle, -10);
  assert.equal(year[0].signedStart, -30);
  assert.equal(year[30].signedStart, 0);

  const gregorian = phaseFanCells({ modulus:400, sectors:40 });
  assert.equal(gregorian[0].signedStart, -200);
  assert.equal(gregorian[20].signedStart, 0);
  assert.equal(gregorian[0].phasePerSector, 10);
});
