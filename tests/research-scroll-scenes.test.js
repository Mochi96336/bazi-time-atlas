import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENES, KEY_STOPS, STEPPED, fmt, locate, mod, nextSameBazi, pose, stepper, stopUnits, unitsAt
} from "../src/research/scroll-scenes.js";

test("the same four pillars appear again 180 years later, on another date", () => {
  assert.deepEqual(nextSameBazi(), { year: 2206, month: 9, day: 30, after: 180 });
});

test("the calendar returns ring by ring as the narrative claims", () => {
  const back = (d, ring, n) => mod(Math.round(pose(d)[ring] / (360 / n)), n) === 0;
  // 1,980 years: year and day sequences back, the 400-year Gregorian cycle 20 years off
  assert.ok(back(1980, "year", 60) && back(1980, "day", 60));
  assert.equal(Math.abs(pose(1980).state.phases.gregorian % 400), 380);
  // 1,200 years: year and Gregorian together; 8,000 years: day back on the 400-year grid
  assert.ok(back(1200, "year", 60) && back(1200, "greg", 400));
  assert.ok(back(8000, "day", 60) && back(8000, "greg", 400));
  // 24,000 years: all three
  for (const ring of ["year", "day"]) assert.ok(back(24000, ring, 60), ring);
  assert.ok(back(24000, "greg", 400));
});

test("a stepped scene holds on its last step", () => {
  const deltas = [0, 60, 120];
  const st = stepper(deltas, pose(0), 1);
  assert.equal(st.pose.delta, 120);
  assert.equal(st.done.length, 3);
});

test("every stop shows a settled caption, and stops are ordered", () => {
  const all = stopUnits(true), keys = stopUnits(false);
  assert.ok(keys.length > 10);
  for (const list of [all, keys]) for (let i = 1; i < list.length; i++) assert.ok(list[i] > list[i - 1]);
  for (const u of keys) assert.ok(all.some(a => Math.abs(a - u) < 1e-9), `key stop ${u} is also a settle stop`);
  for (const u of all) {
    const { index, p } = locate(u);
    const st = SCENES[index].state(p);
    assert.ok(st.copy?.title, `${SCENES[index].id} at ${p.toFixed(2)} has a title`);
  }
  for (const id of Object.keys(STEPPED)) assert.ok(KEY_STOPS[id], id);
});

test("scroll units and scene progress convert both ways", () => {
  for (const sc of SCENES) for (const p of [0, .5, .9]) {
    const { index, p: q } = locate(unitsAt(sc.id, p));
    assert.equal(SCENES[index].id, sc.id);
    assert.ok(Math.abs(q - p) < 1e-9);
  }
});

test("numbers are grouped without Intl", () => {
  assert.equal(fmt(792000), "792,000");
  assert.equal(fmt(24), "24");
  assert.equal(fmt(1980), "1,980");
});
