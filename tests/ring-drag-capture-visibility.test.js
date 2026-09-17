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
  constructor({ capture = "ok" } = {}) {
    this.capture = capture;
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.capturedPointerId = null;
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
    if (this.capture === "throw") throw new Error("capture failed");
    if (this.capture === "missing") return;
    this.capturedPointerId = pointerId;
  }

  hasPointerCapture(pointerId) {
    return this.capturedPointerId === pointerId;
  }

  releasePointerCapture(pointerId) {
    if (this.capturedPointerId === pointerId) this.capturedPointerId = null;
  }

  dispatchAt(type, ringId, angleDegrees, pointerId = 1, timeStamp = undefined, isTrusted = undefined) {
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
    if (typeof isTrusted === "boolean") event.isTrusted = isTrusted;
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

function setup({ svg = new FakeSvg(), visibilityTarget = null, callbacks = {} } = {}) {
  const controller = createRingDragController({
    svg,
    ringStates:{ day:createRingState("day") },
    ...callbacks,
    inertiaOptions:{
      prefersReducedMotion:() => true,
      ...(visibilityTarget ? { visibilityTarget } : {})
    }
  });
  return { svg, controller };
}

for (const capture of ["throw", "missing"]) {
  test(`pointer capture ${capture} fails closed before gesture ownership starts`, t => {
    forceSvgPointFallback(t);
    const events = [];
    const { svg, controller } = setup({
      svg:new FakeSvg({ capture }),
      callbacks:{
        onLinkedDragStart:id => events.push(["start", id]),
        onLinkedDragDelta:(id, delta) => events.push(["delta", id, delta]),
        onLinkedDragEnd:(id, _state, detail) => events.push(["end", id, detail.reason])
      }
    });
    t.after(() => controller.destroy());

    svg.dispatchAt("pointerdown", "day", -90, 7, 0, true);

    assert.equal(controller.activeMode, null);
    assert.equal(svg.dataset.activeRing, undefined);
    assert.equal(controller.hoverRingId, "day");
    assert.equal(svg.dataset.hoverRing, "day");

    svg.dispatchAt("pointermove", "day", -82, 7, 40, true);
    svg.dispatchAt("pointerup", "day", -82, 7, 50, true);

    assert.deepEqual(events, []);
    assert.equal(controller.activeMode, null);
  });
}

test("synthetic pointer events keep best-effort drag behavior when native capture is unavailable", t => {
  forceSvgPointFallback(t);
  const events = [];
  const { svg, controller } = setup({
    svg:new FakeSvg({ capture:"throw" }),
    callbacks:{
      onLinkedDragStart:id => events.push(["start", id]),
      onLinkedDragDelta:(id, delta) => events.push(["delta", id, delta]),
      onLinkedDragEnd:(id, _state, detail) => events.push(["end", id, detail.reason])
    }
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 10, 0, false);
  svg.dispatchAt("pointermove", "day", -88, 10, 40, false);

  assert.equal(controller.activeMode, "linked");
  assert.equal(svg.dataset.activeRing, "day");
  assert.deepEqual(events[0], ["start", "day"]);

  svg.dispatchAt("pointerup", "day", -88, 10, 50, false);

  assert.equal(controller.activeMode, null);
  assert.equal(controller.isCoasting, false);
  assert.deepEqual(events.at(-1), ["end", "day", "release"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("document hidden clears hover ownership together with an active gesture", t => {
  forceSvgPointFallback(t);
  const visibilityTarget = new FakeVisibilityTarget();
  const events = [];
  const { svg, controller } = setup({
    visibilityTarget,
    callbacks:{
      onLinkedDragStart:id => events.push(["start", id]),
      onLinkedDragDelta:(id, delta) => events.push(["delta", id, delta]),
      onLinkedDragEnd:(id, _state, detail) => events.push(["end", id, detail.reason])
    }
  });
  t.after(() => controller.destroy());

  svg.dispatchAt("pointerdown", "day", -90, 8, 0, true);
  svg.dispatchAt("pointermove", "day", -88, 8, 40, true);
  assert.equal(controller.activeMode, "linked");
  assert.equal(controller.hoverRingId, "day");

  visibilityTarget.setHidden(true);

  assert.equal(controller.activeMode, null);
  assert.equal(controller.hoverRingId, null);
  assert.equal(svg.dataset.activeRing, undefined);
  assert.equal(svg.dataset.hoverRing, undefined);
  assert.deepEqual(events.at(-1), ["end", "day", "document-hidden"]);
  assert.equal(events.filter(event => event[0] === "end").length, 1);
});

test("destroy clears passive hover ownership from both internal state and dataset", t => {
  forceSvgPointFallback(t);
  const { svg, controller } = setup();

  svg.dispatchAt("pointermove", "day", -90, 9, 0, true);
  assert.equal(controller.hoverRingId, "day");
  assert.equal(svg.dataset.hoverRing, "day");

  controller.destroy();

  assert.equal(controller.hoverRingId, null);
  assert.equal(svg.dataset.hoverRing, undefined);
  assert.equal(svg.style.cursor, "");
  assert.equal(svg.style.touchAction, "");
});
