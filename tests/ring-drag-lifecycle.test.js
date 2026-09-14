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

  dispatchAt(type, ringId, angleDegrees, pointerId = 1) {
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
    this.listeners.get(type)?.(event);
  }
}

function setupController(callbacks = {}) {
  const svg = new FakeSvg();
  const ringStates = { day: createRingState("day") };
  const controller = createRingDragController({ svg, ringStates, ...callbacks });
  return { svg, ringStates, controller };
}

test("sub-threshold linked gesture has no drag lifecycle side effects", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: id => events.push(["end", id])
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90);
  assert.equal(svg.dataset.activeRing, "day");
  assert.equal(controller.activeMode, "linked");
  assert.deepEqual(events, []);

  svg.dispatchAt("pointermove", "day", -89.9);
  assert.deepEqual(events, []);

  svg.dispatchAt("pointerup", "day", -89.9);
  assert.deepEqual(events, []);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.equal(controller.activeMode, null);
});

test("linked drag starts on activation and keeps the complete first delta", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: id => events.push(["end", id])
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90);
  svg.dispatchAt("pointermove", "day", -89.75);

  assert.equal(events.length, 2);
  assert.deepEqual(events[0], ["start", "day"]);
  assert.equal(events[1][0], "delta");
  assert.equal(events[1][1], "day");
  assert.ok(Math.abs(events[1][2] - 0.25) < 1e-9, `first delta was ${events[1][2]}`);

  svg.dispatchAt("pointerup", "day", -89.75);
  assert.deepEqual(events.at(-1), ["end", "day"]);
});

test("free compare start and end are also deferred until activation", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, ringStates, controller } = setupController({
    onDragStart: id => events.push(["start", id]),
    onPoseChange: (id, _state, delta, detail) => events.push(["pose", id, delta, detail.phase]),
    onDragEnd: id => events.push(["end", id])
  });
  t.after(() => controller.destroy());
  controller.setCompareMode(true);

  svg.dispatchAt("pointerdown", "day", -90, 2);
  svg.dispatchAt("pointermove", "day", -89.9, 2);
  svg.dispatchAt("pointerup", "day", -89.9, 2);
  assert.deepEqual(events, []);
  assert.equal(ringStates.day.manualOffset, 0);
  assert.equal(ringStates.day.linked, true);

  svg.dispatchAt("pointerdown", "day", -90, 3);
  svg.dispatchAt("pointermove", "day", -89.75, 3);
  assert.deepEqual(events[0], ["start", "day"]);
  assert.equal(events[1][0], "pose");
  assert.equal(events[1][1], "day");
  assert.ok(Math.abs(events[1][2] - 0.25) < 1e-9, `free first delta was ${events[1][2]}`);
  assert.equal(events[1][3], "drag");

  svg.dispatchAt("pointerup", "day", -89.75, 3);
  assert.equal(events.at(-1)[0], "end");
  assert.equal(ringStates.day.manualOffset, 0);
  assert.equal(ringStates.day.linked, true);
});
