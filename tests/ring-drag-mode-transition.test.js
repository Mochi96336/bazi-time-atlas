import test from "node:test";
import assert from "node:assert/strict";

import { WHEEL_CENTER, ringModel } from "../src/wheel/ring-model.js";
import { createRingDragController } from "../src/wheel/ring-drag-controller.js";
import { createRingState } from "../src/wheel/ring-state.js";

function forceSvgPointFallback(t) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "DOMPoint");
  Object.defineProperty(globalThis, "DOMPoint", {
    value: undefined,
    configurable: true,
    writable: true
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "DOMPoint", descriptor);
    else delete globalThis.DOMPoint;
  });
}

class FakeSvg {
  constructor() {
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
  }

  getScreenCTM() {
    return { inverse: () => ({}) };
  }

  createSVGPoint() {
    const point = {
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: point.x, y: point.y };
      }
    };
    return point;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  setPointerCapture() {}
  releasePointerCapture() {}

  dispatchAt(type, ringId, angleDegrees, pointerId = 1, timeStamp = undefined) {
    const ring = ringModel(ringId);
    const radius = (ring.innerRadius + ring.outerRadius) / 2;
    const angle = angleDegrees * Math.PI / 180;
    const event = {
      button: 0,
      pointerId,
      clientX: WHEEL_CENTER.x + Math.cos(angle) * radius,
      clientY: WHEEL_CENTER.y + Math.sin(angle) * radius,
      preventDefault() {}
    };
    if (Number.isFinite(timeStamp)) event.timeStamp = timeStamp;
    this.listeners.get(type)?.(event);
  }
}

function setupController(callbacks = {}) {
  const svg = new FakeSvg();
  const ringStates = { day: createRingState("day") };
  const controller = createRingDragController({ svg, ringStates, ...callbacks });
  return { svg, ringStates, controller };
}

test("enabling Free Compare ends an active linked drag before the mode changes", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason]),
    onModeChange: enabled => events.push(["mode", enabled])
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 1, 0);
  svg.dispatchAt("pointermove", "day", -88, 1, 40);
  assert.equal(controller.activeMode, "linked");

  controller.setCompareMode(true);

  assert.equal(controller.activeMode, null);
  assert.equal(controller.compareMode, true);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.deepEqual(events.slice(-2), [
    ["end", "day", "mode-change"],
    ["mode", true]
  ]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);

  svg.dispatchAt("pointerup", "day", -88, 1, 41);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("disabling Free Compare settles an active free drag before the mode changes", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, ringStates, controller } = setupController({
    onDragStart: id => events.push(["start", id]),
    onPoseChange: (id, _state, delta, detail) => events.push(["pose", id, delta, detail.phase]),
    onDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason]),
    onModeChange: enabled => events.push(["mode", enabled])
  });
  t.after(() => controller.destroy());

  controller.setCompareMode(true);
  events.length = 0;
  svg.dispatchAt("pointerdown", "day", -90, 2, 0);
  svg.dispatchAt("pointermove", "day", -88, 2, 40);
  assert.equal(controller.activeMode, "free");
  assert.notEqual(ringStates.day.manualOffset, 0);

  controller.setCompareMode(false);

  assert.equal(controller.activeMode, null);
  assert.equal(controller.compareMode, false);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.equal(ringStates.day.manualOffset, 0);
  assert.equal(events.some(event => event[0] === "pose" && event[3] === "detent"), true);
  assert.deepEqual(events.slice(-2), [
    ["end", "day", "mode-change"],
    ["mode", false]
  ]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);

  svg.dispatchAt("pointerup", "day", -88, 2, 41);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});
