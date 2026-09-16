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
    this.capturedPointers = [];
    this.releasedPointers = [];
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

  setPointerCapture(pointerId) {
    this.capturedPointers.push(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.releasedPointers.push(pointerId);
  }

  dispatchAt(type, ringId, angleDegrees, pointerId, timeStamp) {
    const ring = ringModel(ringId);
    const radius = (ring.innerRadius + ring.outerRadius) / 2;
    const angle = angleDegrees * Math.PI / 180;
    const event = {
      button: 0,
      pointerId,
      timeStamp,
      clientX: WHEEL_CENTER.x + Math.cos(angle) * radius,
      clientY: WHEEL_CENTER.y + Math.sin(angle) * radius,
      preventDefault() {}
    };
    this.listeners.get(type)?.(event);
  }
}

test("secondary pointerdown cannot steal an active linked drag", t => {
  forceSvgPointFallback(t);
  const svg = new FakeSvg();
  const ringStates = {
    day: createRingState("day"),
    hour: createRingState("hour")
  };
  const events = [];
  const controller = createRingDragController({
    svg,
    ringStates,
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason]),
    inertiaOptions:{ prefersReducedMotion:() => true }
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 1, 0);
  svg.dispatchAt("pointermove", "day", -88, 1, 40);

  assert.equal(controller.activeMode, "linked");
  assert.equal(svg.dataset.activeRing, "day");
  assert.deepEqual(svg.capturedPointers, [1]);
  assert.deepEqual(events[0], ["start", "day"]);

  svg.dispatchAt("pointerdown", "hour", -90, 2, 41);
  svg.dispatchAt("pointermove", "hour", -86, 2, 60);
  svg.dispatchAt("pointerup", "hour", -86, 2, 61);

  assert.equal(controller.activeMode, "linked");
  assert.equal(svg.dataset.activeRing, "day");
  assert.deepEqual(svg.capturedPointers, [1]);
  assert.equal(events.some(event => event[1] === "hour"), false);
  assert.equal(events.filter(event => event[0] === "end").length, 0);

  svg.dispatchAt("pointermove", "day", -86, 1, 80);
  svg.dispatchAt("pointerup", "day", -86, 1, 100);

  assert.equal(controller.activeMode, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.deepEqual(svg.releasedPointers, [1]);
  assert.deepEqual(events.at(-1), ["end", "day", "release"]);
  assert.equal(events.filter(event => event[0] === "start").length, 1);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
  assert.equal(events.some(event => event[1] === "hour"), false);
});
