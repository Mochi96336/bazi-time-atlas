import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENES, KEY_STOPS, STEPPED, fmt, holdP, locate, mod, nextSameBazi, pose, stepper, stopUnits, unitsAt
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

test("the solar extension stays in chapter two before Earth rotation and the conclusion", () => {
  assert.deepEqual(SCENES.map(s => s.id), [
    "open0", "open1", "split", "merge", "sun", "c11", "c12", "c13", "c14", "c15",
    "c21", "c22", "c31", "c23", "c24", "x1", "x2", "x3", "c32", "end"
  ]);
  for (const id of ["c31", "x1", "x2", "x3"]) {
    assert.match(SCENES.find(s => s.id === id).state(.9).copy.kicker, /^二 太陽/);
  }
});

test("solar and Earth-rotation stops hold on the stated comparison", () => {
  const scene = id => SCENES.find(sc => sc.id === id);
  const atStops = id => KEY_STOPS[id].map(step => {
    const { p } = locate(unitsAt(id, holdP(STEPPED[id], step)));
    return scene(id).state(p);
  });
  const terms = atStops("c22");
  assert.deepEqual(terms.map(s => s.copy.kicker.split(" · ").at(-1)), ["白露", "寒露", "立冬", "大雪", "小寒", "立春"]);
  assert.ok(terms.every(s => s.band.marks.length === 25 && s.band.arcs.length === 12));
  assert.deepEqual(terms.map(s => s.band.arcs.find(arc => arc.lead === 1)?.label.split("提早")[0]),
    ["白露", "寒露", "立冬", "大雪", "小寒", "立春"]);
  // only the term on the needle is called out at a stop
  assert.ok(terms.every(s => s.band.arcs.filter(arc => arc.lead > 0).length === 1));
  const month = scene("c31").state(.9);
  assert.ok(month.band.view > month.band.window.from && month.band.view < month.band.window.to);
  assert.match(month.copy.title, /丙午年、丁酉月/);
  assert.deepEqual(atStops("x2").map(s => Math.round(s.ladder.upto)), [1, 2, 32, 40]);
  const closest = scene("x3").state(.5);
  assert.equal(closest.ladder.focus, 32);
  assert.match(closest.copy.title, /792,000 年.*10\.4 小時/);
  const rotation = atStops("c32");
  assert.ok(rotation[0].haze.hours < .001);
  assert.match(rotation[1].haze.label, /±1\.7 小時/);
  assert.ok(Math.abs(rotation[2].haze.hours - 21) < .5);
  assert.equal(rotation[3].haze.label, "±7.1 天");
  assert.equal(scene("end").state(.75).haze.hours, rotation[3].haze.hours);
});

test("the conclusion distinguishes the three recurrence claims", () => {
  const end = SCENES.at(-1).state(.75);
  assert.equal(end.end, true);
  assert.match(end.copy.title, /整套曆法回到原點.*24,000 年.*實際算不出/);
  assert.match(end.copy.body, /同一天同一刻，1,980 年/);
  assert.match(end.copy.body, /任何日期的同一組八字，180 年/);
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
