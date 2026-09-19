import test from "node:test";
import assert from "node:assert/strict";

import {
  FREE_COMPARE_OFFSET_EPSILON,
  createFreeCompareController,
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

function fakeNode() {
  const listeners = new Map();
  return {
    dataset:{},
    hidden:false,
    textContent:"",
    setAttribute() {},
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type) { listeners.get(type)?.(); },
    appendChild() {},
    prepend() {},
    insertBefore() {},
    dispatchEvent() {}
  };
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

test("single-ring reset clears only the requested Find Time constraint", () => {
  const states = ringStates({ year:6, month:-12 });
  const order = [];
  const instrument = fakeNode();
  const controlGroup = fakeNode();
  const insertBefore = fakeNode();
  const dragController = {
    compareMode:true,
    cancelActiveGesture(options) { order.push(["active", options]); },
    cancelInertia(options) { order.push(["coast", options]); },
    setCompareMode(enabled) { this.compareMode = Boolean(enabled); }
  };
  const controller = createFreeCompareController({
    instrument,
    controlGroup,
    insertBefore,
    rings:RINGS,
    ringStates:states,
    dragController,
    renderAllRingPoses:() => order.push(["render", states.year.manualOffset, states.month.manualOffset]),
    stopPlayback:() => {},
    documentRef:{ createElement:() => fakeNode() }
  });

  assert.equal(controller.resetRingOffset("year"), true);
  assert.equal(states.year.manualOffset, 0);
  assert.equal(states.year.linked, true);
  assert.equal(states.month.manualOffset, -12);
  assert.equal(states.month.linked, undefined);
  assert.deepEqual(order[0], ["active", { detent:false, reason:"free-compare-ring-reset" }]);
  assert.deepEqual(order[1], ["coast", { detent:false, reason:"free-compare-ring-reset" }]);
  assert.deepEqual(order[2], ["render", 0, -12]);
  assert.equal(controller.resetRingOffset("zodiac"), false);
});

test("reset cancels active drag and coast before clearing Free Compare offsets", () => {
  const states = ringStates({ day:4.5, zodiac:7 });
  const order = [];
  const instrument = fakeNode();
  const controlGroup = fakeNode();
  const insertBefore = fakeNode();
  const dragController = {
    compareMode:true,
    cancelActiveGesture(options) {
      order.push(["active", options, states.day.manualOffset]);
    },
    cancelInertia(options) {
      order.push(["coast", options, states.day.manualOffset]);
    },
    setCompareMode(enabled) {
      this.compareMode = Boolean(enabled);
    }
  };
  const documentRef = { createElement:() => fakeNode() };
  const controller = createFreeCompareController({
    instrument,
    controlGroup,
    insertBefore,
    rings:RINGS,
    ringStates:states,
    dragController,
    renderAllRingPoses:() => order.push(["render", states.day.manualOffset]),
    stopPlayback:() => {},
    documentRef
  });

  controller.resetAllOffsets();

  assert.deepEqual(order[0], [
    "active",
    { detent:false, reason:"free-compare-reset" },
    4.5
  ]);
  assert.deepEqual(order[1], [
    "coast",
    { detent:false, reason:"free-compare-reset" },
    4.5
  ]);
  assert.deepEqual(order[2], ["render", 0]);
  assert.equal(states.day.manualOffset, 0);
  assert.equal(states.day.linked, true);
  assert.equal(states.zodiac.manualOffset, 0);
  assert.equal(states.zodiac.linked, true);
});
