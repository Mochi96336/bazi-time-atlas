import test from "node:test";
import assert from "node:assert/strict";

import {
  FREE_COMPARE_OFFSET_EPSILON,
  detachedCompareRings,
  freeCompareViewState
} from "../src/interaction/free-compare-controller.js";

const RINGS = [
  { id:"hour" },
  { id:"day" },
  { id:"solar" },
  { id:"month" },
  { id:"year" }
];

function ringStates(offsets = {}) {
  return Object.fromEntries([
    ...RINGS.map(ring => [ring.id, { manualOffset:offsets[ring.id] ?? 0 }]),
    ["zodiac", { manualOffset:offsets.zodiac ?? 0 }]
  ]);
}

test("detached compare rings preserve primary radial order and ignore zodiac", () => {
  const states = ringStates({ day:1.2, solar:-2.4, zodiac:9 });
  assert.deepEqual(
    detachedCompareRings({ rings:RINGS, ringStates:states }).map(ring => ring.id),
    ["day", "solar"]
  );
});

test("the detach threshold preserves the existing strict greater-than rule", () => {
  const states = ringStates({
    hour:FREE_COMPARE_OFFSET_EPSILON,
    day:FREE_COMPARE_OFFSET_EPSILON + 1e-6
  });
  assert.deepEqual(
    detachedCompareRings({ rings:RINGS, ringStates:states }).map(ring => ring.id),
    ["day"]
  );
});

test("linked mode projects the original compare UI contract", () => {
  assert.deepEqual(freeCompareViewState({
    compareMode:false,
    rings:RINGS,
    ringStates:ringStates({ day:4 })
  }), {
    compareMode:false,
    buttonLabel:"比較",
    buttonPressed:"false",
    resetHidden:false,
    scrubMode:"linked-time",
    detachedIds:["day"],
    statusHidden:true,
    statusText:""
  });
});

test("empty Free Compare mode makes fixed-time ownership explicit", () => {
  assert.deepEqual(freeCompareViewState({
    compareMode:true,
    rings:RINGS,
    ringStates:ringStates()
  }), {
    compareMode:true,
    buttonLabel:"比較中",
    buttonPressed:"true",
    resetHidden:true,
    scrubMode:"free-compare",
    detachedIds:[],
    statusHidden:false,
    statusText:"時間固定 · 拖動任一圓環"
  });
});

test("Free Compare status preserves fixed-time ownership and signed one-decimal offsets", () => {
  const view = freeCompareViewState({
    compareMode:true,
    rings:RINGS,
    ringStates:ringStates({ day:1.24, solar:-2.04 })
  });
  assert.equal(view.resetHidden, false);
  assert.deepEqual(view.detachedIds, ["day", "solar"]);
  assert.equal(view.statusText, "時間固定 · 日 +1.2° · 節氣 −2.0°");
});
