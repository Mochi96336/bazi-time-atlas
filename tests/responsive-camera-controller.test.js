import test from "node:test";
import assert from "node:assert/strict";
import { createResponsiveCameraController } from "../src/wheel/responsive-camera-controller.js";
import { WHEEL_CENTER, RADII } from "../src/wheel/ring-model.js";

function harness(initialBounds = { width:374, height:732 }) {
  let bounds = initialBounds, writes = 0, sequence = 0, resized, disconnected = false;
  const frames = new Map(), observed = [], cameras = [];
  const attributes = new Map([["viewBox", "0 0 1200 760"]]);
  const svg = {
    getBoundingClientRect:() => bounds,
    getAttribute:name => attributes.get(name),
    setAttribute(name, value) { writes++; attributes.set(name, value); }
  };
  const instrument = { dataset:{ selectedInstantMs:"1790987439000", manualOffset:"12.5" } };
  const eventTarget = new EventTarget();
  eventTarget.innerWidth = 390;
  eventTarget.visualViewport = new EventTarget();
  const visibilityTarget = new EventTarget();
  visibilityTarget.hidden = false;
  const controller = createResponsiveCameraController({
    svg, instrument, center:WHEEL_CENTER, outerRadius:RADII.outer,
    eventTarget, visibilityTarget, onCameraChange:camera => cameras.push(camera),
    ResizeObserverCtor:class {
      constructor(callback) { resized = callback; }
      observe(node) { observed.push(node); }
      disconnect() { disconnected = true; }
    },
    requestFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
    cancelFrame:id => frames.delete(id)
  });
  return {
    controller, svg, instrument, eventTarget, visibilityTarget, frames, cameras, observed,
    setBounds:next => { bounds = next; }, resized:() => resized(),
    get writes() { return writes; }, get disconnected() { return disconnected; },
    flush() {
      const pending = [...frames]; frames.clear();
      pending.forEach(([,callback]) => callback());
    }
  };
}

test("an unmeasurable startup defers the camera until the SVG acquires its portrait box", () => {
  const h = harness({ width:0, height:0 });
  assert.equal(h.writes, 0, "a zero-sized box must never install a landscape fallback");
  h.flush();
  assert.equal(h.writes, 0);
  h.setBounds({ width:374, height:732 });
  h.resized(); h.flush();
  assert.equal(h.cameras.at(-1).mode, "mobile");
  assert.equal(h.cameras.at(-1).viewportAspect, 374 / 732);
  assert.ok(h.cameras.at(-1).viewBox.width < 450);
  assert.deepEqual(h.observed, [h.svg, h.instrument]);
  h.controller.destroy();
});

test("element-only resizing changes framing without window resize or time changes", () => {
  const h = harness(); h.flush();
  const state = structuredClone(h.instrument.dataset);
  h.setBounds({ width:374, height:460 });
  h.resized(); h.resized();
  assert.equal(h.frames.size, 1, "resize notifications share one pending frame");
  h.flush();
  assert.equal(h.cameras.at(-1).viewportAspect, 374 / 460);
  assert.deepEqual(h.instrument.dataset, state);
  const writes = h.writes;
  h.resized(); h.flush();
  assert.equal(h.writes, writes, "unchanged geometry must not invalidate material/drag projections");
  h.controller.destroy();
});

test("transient zero sizing retains the last valid camera and page restoration remeasures", () => {
  const h = harness(); h.flush();
  const before = h.svg.getAttribute("viewBox");
  h.setBounds({ width:374, height:0 });
  h.resized(); h.flush();
  assert.equal(h.svg.getAttribute("viewBox"), before);
  h.setBounds({ width:374, height:650 });
  h.eventTarget.dispatchEvent(new Event("pageshow")); h.flush();
  assert.equal(h.cameras.at(-1).viewportAspect, 374 / 650);
  h.controller.destroy();
});

test("visual viewport, rotation and foreground restore remeasure, and destroy removes observers", () => {
  const h = harness(); h.flush();
  h.setBounds({ width:374, height:620 });
  h.eventTarget.visualViewport.dispatchEvent(new Event("resize")); h.flush();
  assert.equal(h.cameras.at(-1).viewportAspect, 374 / 620);
  h.eventTarget.innerWidth = 844;
  h.setBounds({ width:820, height:460 });
  h.eventTarget.dispatchEvent(new Event("resize")); h.flush();
  assert.equal(h.cameras.at(-1).mode, "desktop");
  h.setBounds({ width:820, height:500 });
  h.visibilityTarget.hidden = true;
  h.visibilityTarget.dispatchEvent(new Event("visibilitychange"));
  assert.equal(h.frames.size, 0);
  h.visibilityTarget.hidden = false;
  h.visibilityTarget.dispatchEvent(new Event("visibilitychange")); h.flush();
  assert.equal(h.cameras.at(-1).viewportAspect, 820 / 500);
  h.resized();
  h.controller.destroy();
  assert.equal(h.disconnected, true);
  assert.equal(h.frames.size, 0);
  h.eventTarget.dispatchEvent(new Event("pageshow"));
  h.eventTarget.visualViewport.dispatchEvent(new Event("resize"));
  h.visibilityTarget.dispatchEvent(new Event("visibilitychange"));
  h.resized();
  assert.equal(h.frames.size, 0);
});
