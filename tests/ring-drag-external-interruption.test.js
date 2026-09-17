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
    return { inverse: () => ({ a:1, b:0, c:0, d:1, e:0, f:0 }) };
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

test("external authority can terminate an active linked drag exactly once", t => {
  forceSvgPointFallback(t);
  const svg = new FakeSvg();
  const events = [];
  const controller = createRingDragController({
    svg,
    ringStates:{ day:createRingState("day") },
    onLinkedDragStart:id => events.push(["start", id]),
    onLinkedDragDelta:(id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd:(id, _state, detail) => events.push(["end", id, detail.reason]),
    inertiaOptions:{ prefersReducedMotion:() => true }
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 1, 0);
  svg.dispatchAt("pointermove", "day", -88, 1, 40);

  assert.equal(controller.activeMode, "linked");
  assert.deepEqual(svg.capturedPointers, [1]);
  assert.deepEqual(events[0], ["start", "day"]);

  assert.equal(
    controller.cancelActiveGesture({ detent:true, reason:"external-control" }),
    true
  );
  assert.equal(controller.activeMode, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.deepEqual(svg.releasedPointers, [1]);
  assert.deepEqual(events.at(-1), ["end", "day", "external-control"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);

  const eventCount = events.length;
  svg.dispatchAt("pointermove", "day", -84, 1, 60);
  svg.dispatchAt("pointerup", "day", -84, 1, 80);

  assert.equal(events.length, eventCount);
  assert.equal(controller.cancelActiveGesture({ reason:"external-control" }), false);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});
