import test from "node:test";
import assert from "node:assert/strict";

import { WHEEL_CENTER, ringModel } from "../src/wheel/ring-model.js";
import { createRingDragController } from "../src/wheel/ring-drag-controller.js";
import { createRingState } from "../src/wheel/ring-state.js";
import { RING_VISIBILITY_EVENT } from "../src/wheel/ring-visibility.js";

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

  setPointerCapture() {}
  releasePointerCapture() {}

  dispatch(type, detail = {}) {
    this.listeners.get(type)?.({ detail });
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

class FakeVisibilityTarget {
  constructor() {
    this.hidden = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  setHidden(hidden) {
    this.hidden = hidden;
    this.listeners.get("visibilitychange")?.();
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

function setupController(callbacks = {}, inertiaOptions = {}) {
  const svg = new FakeSvg();
  const ringStates = { day: createRingState("day") };
  const controller = createRingDragController({ svg, ringStates, ...callbacks, inertiaOptions });
  return { svg, ringStates, controller };
}

test("lost pointer capture settles an active gesture without launching inertia", t => {
  forceSvgPointFallback(t);
  const frames = new FakeFrames();
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  }, {
    requestFrame:frames.request,
    cancelFrame:frames.cancel
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 1, 0);
  svg.dispatchAt("pointermove", "day", -88, 1, 40);
  assert.equal(controller.activeMode, "linked");

  svg.dispatchAt("lostpointercapture", "day", -88, 1, 41);

  assert.equal(controller.activeMode, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.equal(controller.isCoasting, false);
  assert.equal(frames.pending.size, 0);
  assert.deepEqual(events.at(-1), ["end", "day", "lost-pointer-capture"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("document hidden settles an active free gesture and clears pointer ownership", t => {
  forceSvgPointFallback(t);
  const visibilityTarget = new FakeVisibilityTarget();
  const events = [];
  const { svg, ringStates, controller } = setupController({
    onDragStart: id => events.push(["start", id]),
    onPoseChange: (id, _state, delta, detail) => events.push(["pose", id, delta, detail.phase]),
    onDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  }, { visibilityTarget });
  t.after(() => controller.destroy());
  controller.setCompareMode(true);

  svg.dispatchAt("pointerdown", "day", -90, 2, 0);
  svg.dispatchAt("pointermove", "day", -88, 2, 40);
  assert.equal(controller.activeMode, "free");
  assert.notEqual(ringStates.day.manualOffset, 0);

  visibilityTarget.setHidden(true);

  assert.equal(controller.activeMode, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.equal(controller.isCoasting, false);
  assert.equal(ringStates.day.manualOffset, 0);
  assert.deepEqual(events.at(-1), ["end", "day", "document-hidden"]);
  assert.equal(events.some(event => event[0] === "pose" && event[3] === "detent"), true);
});

test("document hidden still cancels an already coasting gesture exactly once", t => {
  forceSvgPointFallback(t);
  const visibilityTarget = new FakeVisibilityTarget();
  const frames = new FakeFrames();
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  }, {
    visibilityTarget,
    requestFrame:frames.request,
    cancelFrame:frames.cancel,
    prefersReducedMotion:() => false
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 3, 0);
  svg.dispatchAt("pointermove", "day", -88, 3, 40);
  svg.dispatchAt("pointerup", "day", -88, 3, 42);
  assert.equal(controller.isCoasting, true);
  assert.equal(frames.pending.size, 1);

  visibilityTarget.setHidden(true);

  assert.equal(controller.isCoasting, false);
  assert.equal(frames.pending.size, 0);
  assert.deepEqual(events.at(-1), ["end", "day", "document-hidden"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("destroy ends an active linked gesture exactly once before removing listeners", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  }, {
    prefersReducedMotion:() => true
  });

  svg.dispatchAt("pointerdown", "day", -90, 4, 0);
  svg.dispatchAt("pointermove", "day", -88, 4, 40);
  assert.equal(controller.activeMode, "linked");

  controller.destroy();

  assert.equal(controller.activeMode, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.deepEqual(events.at(-1), ["end", "day", "destroy"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);

  svg.dispatchAt("pointerup", "day", -88, 4, 50);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("hiding the active ring ends only that gesture and stale pointer events cannot resume it", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  }, {
    prefersReducedMotion:() => true
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 5, 0);
  svg.dispatchAt("pointermove", "day", -88, 5, 40);
  assert.equal(controller.activeMode, "linked");

  svg.dispatch(RING_VISIBILITY_EVENT, { ringId:"month", visible:false });
  assert.equal(controller.activeMode, "linked");

  svg.dispatch(RING_VISIBILITY_EVENT, { ringId:"day", visible:false });
  assert.equal(controller.activeMode, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.deepEqual(events.at(-1), ["end", "day", "ring-hidden"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);

  svg.dispatchAt("pointermove", "day", -82, 5, 50);
  svg.dispatchAt("pointerup", "day", -82, 5, 60);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("hiding a coasting ring cancels inertia and ends it exactly once", t => {
  forceSvgPointFallback(t);
  const frames = new FakeFrames();
  const events = [];
  const { svg, controller } = setupController({
    onLinkedDragStart: id => events.push(["start", id]),
    onLinkedDragDelta: (id, delta) => events.push(["delta", id, delta]),
    onLinkedDragEnd: (id, _state, detail) => events.push(["end", id, detail.reason])
  }, {
    requestFrame:frames.request,
    cancelFrame:frames.cancel,
    prefersReducedMotion:() => false
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 6, 0);
  svg.dispatchAt("pointermove", "day", -88, 6, 40);
  svg.dispatchAt("pointerup", "day", -88, 6, 42);
  assert.equal(controller.isCoasting, true);
  assert.equal(frames.pending.size, 1);

  svg.dispatch(RING_VISIBILITY_EVENT, { ringId:"day", visible:false });

  assert.equal(controller.isCoasting, false);
  assert.equal(frames.pending.size, 0);
  assert.deepEqual(events.at(-1), ["end", "day", "ring-hidden"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});
