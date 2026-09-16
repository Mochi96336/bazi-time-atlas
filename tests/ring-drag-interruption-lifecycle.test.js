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

  setPointerCapture() {}

  releasePointerCapture(pointerId) {
    this.releasedPointers.push(pointerId);
    this.listeners.get("lostpointercapture")?.({ pointerId });
  }

  dispatchAt(type, angleDegrees, pointerId = 1, timeStamp = undefined) {
    const ring = ringModel("day");
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

function setup(callbacks = {}) {
  const svg = new FakeSvg();
  const controller = createRingDragController({
    svg,
    ringStates: { day: createRingState("day") },
    ...callbacks
  });
  return { svg, controller };
}

test("mode change closes an active linked drag exactly once", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setup({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", -90, 7, 0);
  svg.dispatchAt("pointermove", -89.5, 7, 20);
  assert.equal(controller.activeMode, "linked");
  assert.equal(svg.dataset.activeRing, "day");

  controller.setCompareMode(true);

  assert.equal(controller.activeMode, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.equal(controller.compareMode, true);
  assert.deepEqual(events.at(-1), ["end", "day", "mode-change"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
  assert.deepEqual(svg.releasedPointers, [7]);

  svg.dispatchAt("pointerup", -89.5, 7, 22);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("lost pointer capture cancels an active drag without inertia", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setup({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", -90, 11, 0);
  svg.dispatchAt("pointermove", -89.5, 11, 20);
  svg.dispatchAt("lostpointercapture", -89.5, 11, 21);

  assert.equal(controller.activeMode, null);
  assert.equal(controller.isCoasting, false);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.deepEqual(events.at(-1), ["end", "day", "lost-pointer-capture"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("destroy closes an active drag and removes lost-capture listener", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setup({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  });

  svg.dispatchAt("pointerdown", -90, 13, 0);
  svg.dispatchAt("pointermove", -89.5, 13, 20);
  controller.destroy();

  assert.deepEqual(events.at(-1), ["end", "day", "destroy"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
  assert.equal(svg.listeners.has("lostpointercapture"), false);
  assert.equal(svg.style.cursor, "");
  assert.equal(svg.style.touchAction, "");
});
