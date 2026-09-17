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
    this.ctmCalls = 0;
    this.inverseCalls = 0;
  }

  getScreenCTM() {
    this.ctmCalls += 1;
    return {
      inverse: () => {
        this.inverseCalls += 1;
        return {};
      }
    };
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

  pointAt(angleDegrees, timeStamp) {
    const ring = ringModel("day");
    const radius = (ring.innerRadius + ring.outerRadius) / 2;
    const angle = angleDegrees * Math.PI / 180;
    return {
      clientX: WHEEL_CENTER.x + Math.cos(angle) * radius,
      clientY: WHEEL_CENTER.y + Math.sin(angle) * radius,
      timeStamp
    };
  }

  dispatchAt(type, angleDegrees, pointerId, timeStamp) {
    this.listeners.get(type)?.({
      button: 0,
      pointerId,
      ...this.pointAt(angleDegrees, timeStamp),
      preventDefault() {}
    });
  }

  dispatchCoalesced(type, angleDegrees, pointerId, timeStamp, samples) {
    this.listeners.get(type)?.({
      button: 0,
      pointerId,
      ...this.pointAt(angleDegrees, timeStamp),
      getCoalescedEvents: () => samples.map(({ angle, at }) => ({
        pointerId,
        ...this.pointAt(angle, at)
      })),
      preventDefault() {}
    });
  }

  resetTransformCounters() {
    this.ctmCalls = 0;
    this.inverseCalls = 0;
  }
}

test("coalesced pointer samples share one screen transform per pointer event", t => {
  forceSvgPointFallback(t);
  const svg = new FakeSvg();
  const deltas = [];
  const controller = createRingDragController({
    svg,
    ringStates: { day: createRingState("day") },
    onLinkedDragDelta: (_id, delta) => deltas.push(delta),
    inertiaOptions: {
      requestFrame: () => 1,
      cancelFrame: () => {},
      prefersReducedMotion: () => true
    }
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", -90, 1, 0);
  svg.resetTransformCounters();

  svg.dispatchCoalesced("pointermove", -88, 1, 40, [
    { angle:-89.75, at:10 },
    { angle:-89, at:25 },
    { angle:-88, at:40 }
  ]);

  assert.equal(svg.ctmCalls, 1);
  assert.equal(svg.inverseCalls, 1);
  assert.ok(Math.abs(deltas.reduce((sum, delta) => sum + delta, 0) - 2) < 1e-9);

  svg.resetTransformCounters();
  svg.dispatchCoalesced("pointerup", -87, 1, 80, [
    { angle:-87.5, at:60 },
    { angle:-87, at:80 }
  ]);

  assert.equal(svg.ctmCalls, 1);
  assert.equal(svg.inverseCalls, 1);
  assert.ok(Math.abs(deltas.reduce((sum, delta) => sum + delta, 0) - 3) < 1e-9);
});
