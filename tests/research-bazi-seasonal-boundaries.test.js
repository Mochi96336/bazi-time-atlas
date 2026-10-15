import test from "node:test";
import assert from "node:assert/strict";
import {
  BAZI_JIE_BOUNDARIES,
  baziJieDriftSummary,
  baziMonthContextAtLongitude
} from "../src/research/bazi-seasonal-boundaries.js";
import {
  SEASONAL_DRIFT_26026_RESEARCH as evidence,
  indexForLongitude
} from "../src/research/seasonal-drift-26026-research-data.js";

test("Research 02 uses the canonical twelve BaZi Jie boundaries", () => {
  assert.equal(BAZI_JIE_BOUNDARIES.length,12);
  assert.deepEqual(
    BAZI_JIE_BOUNDARIES.map(item => item.termName),
    ["立春","驚蟄","清明","立夏","芒種","小暑","立秋","白露","寒露","立冬","大雪","小寒"]
  );
  assert.deepEqual(
    BAZI_JIE_BOUNDARIES.map(item => item.branch),
    ["寅","卯","辰","巳","午","未","申","酉","戌","亥","子","丑"]
  );
  assert.equal(BAZI_JIE_BOUNDARIES.filter(item => item.yearBoundary).length,1);
  assert.equal(BAZI_JIE_BOUNDARIES.find(item => item.yearBoundary)?.termName,"立春");
});

test("BaZi month context switches exactly on Jie longitudes", () => {
  assert.equal(baziMonthContextAtLongitude(314).branch,"丑");
  assert.equal(baziMonthContextAtLongitude(314).endTerm,"立春");
  assert.equal(baziMonthContextAtLongitude(315).branch,"寅");
  assert.equal(baziMonthContextAtLongitude(315).boundary?.yearBoundary,true);
  assert.equal(baziMonthContextAtLongitude(344).branch,"寅");
  assert.equal(baziMonthContextAtLongitude(345).branch,"卯");
  assert.equal(baziMonthContextAtLongitude(14).branch,"卯");
  assert.equal(baziMonthContextAtLongitude(15).branch,"辰");
});

test("all twelve BaZi Jie boundaries miss the +24k Gregorian time phase", () => {
  const summary=baziJieDriftSummary(evidence.driftDays,indexForLongitude);
  assert.equal(summary.count,12);
  assert.equal(summary.displacedCount,12);
  assert.equal(summary.minAdvanceDays.toFixed(3),"10.235");
  assert.equal(summary.maxAdvanceDays.toFixed(3),"14.177");
  assert.ok(summary.rows.every(row => row.driftDays < 0));
});
