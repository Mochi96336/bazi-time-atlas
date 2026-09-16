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

  dispatchAt(type, angleDegrees, pointerId, timeStamp) {
    const ring = ringModel("day");
    const radius = (ring.innerRadius + ring.outerRadius) / 2;
    const angle = angleDegrees * Math.PI / 180;
    this.listeners.get(type)?.({
      button: 0,
      pointerId,
      timeStamp,
      clientX: WHEEL_CENTER.x + Math.cos(angle) * radius,
      clientY: WHEEL_CENTER.y + Math.sin(angle) * radius,
      preventDefault() {}
    });
  }
}

class FakeFrames {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
  }

  request = callback => {
    const id = this.nextId++;
    this.pending.set(id, callback);
    return id;
  };

  cancel = id => this.pending.delete(id);
}

function setup(callbacks = {}) {
  const svg = new FakeSvg();
  const frames = new FakeFrames();
  const controller = createRingDragController({
    svg,
    ringStates: { day: createRingState("day") },
    ...callbacks,
    inertiaOptions: {
      requestFrame: frames.request,
      cancelFrame: frames.cancel,
      prefersReducedMotion: () => false
    }
  });
  return { svg, frames, controller };
}

test("pointerup consumes final motion before estimating inertia", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, frames, controller } = setup({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", -90, 1, 0);
  svg.dispatchAt("pointerup", -88, 1, 40);

  assert.deepEqual(events[0], ["start", "day"]);
  assert.equal(events[1][0], "delta");
  assert.ok(Math.abs(events[1][2] - 2) < 1e-9, `release delta was ${events[1][2]}`);
  assert.equal(controller.isCoasting, true);
  assert.equal(frames.pending.size, 1);
  assert.equal(events.some(event => event[0] === "end"), false);
});

test("pointercancel ignores cancellation coordinates", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, frames, controller } = setup({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", -90, 2, 0);
  svg.dispatchAt("pointermove", -89.75, 2, 40);
  svg.dispatchAt("pointercancel", -87, 2, 42);

  const deltas = events.filter(event => event[0] === "delta");
  assert.equal(deltas.length, 1);
  assert.ok(Math.abs(deltas[0][2] - 0.25) < 1e-9, `cancel changed drag by ${deltas[0][2]}`);
  assert.deepEqual(events.at(-1), ["end", "day", "pointer-cancel"]);
  assert.equal(controller.isCoasting, false);
  assert.equal(frames.pending.size, 0);
});
