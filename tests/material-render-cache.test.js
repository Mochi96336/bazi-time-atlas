import test from "node:test";
import assert from "node:assert/strict";
import { createWheelMaterialPrototype } from "../src/wheel/material-prototype.js";

function setup(t, search = "?material=roughness") {
  let now = 0;
  const timers = new Map(), observers = {}, draws = [], uniforms = {};
  const reads = { canvas:0, svg:0, ctm:0 };
  const documentRef = new EventTarget();
  documentRef.hidden = false;
  const globals = {
    innerWidth:390, devicePixelRatio:3,
    performance:{ now:() => now }, document:documentRef,
    matchMedia:() => ({ matches:false }),
    setTimeout(callback) { const id = {}; timers.set(id, callback); return id; },
    clearTimeout:id => timers.delete(id),
    ResizeObserver:class {
      constructor(callback) { observers.resize = callback; }
      observe() {} disconnect() {}
    },
    MutationObserver:class {
      constructor(callback) { observers.camera = callback; }
      observe() {} disconnect() {}
    }
  };
  for (const [name, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable:true, writable:true, value });
    t.after(() => descriptor
      ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  }
  let projectionScale = 2;
  const matrix = { a:0.5, b:0, c:0, d:0.5, e:0, f:0,
    inverse:() => ({ a:projectionScale, b:0, c:0, d:projectionScale, e:0, f:0 }) };
  const shell = { dataset:{}, removeAttribute() {} };
  const gl = new Proxy({
    getShaderParameter:() => true, getProgramParameter:() => true,
    createShader:() => ({}), createProgram:() => ({}),
    createBuffer:() => ({}), createTexture:() => ({}),
    getAttribLocation:() => 0, getUniformLocation:(_program, name) => name,
    uniform4fv:(name, values) => { uniforms[name] = Array.from(values); },
    uniform4f:(name, ...values) => { uniforms[name] = values; },
    uniform1f:(name, value) => { uniforms[name] = value; },
    drawArrays:() => draws.push(structuredClone(uniforms))
  }, { get(target, key) { return target[key] ?? (/^[A-Z_]+$/.test(key) ? 1 : () => {}); } });
  const bounds = { left:0, top:0, width:390, height:740 };
  const canvas = { width:1, height:1, addEventListener() {}, getContext:() => gl,
    getBoundingClientRect() { reads.canvas++; return bounds; } };
  const svg = {
    closest:() => shell,
    getBoundingClientRect() { reads.svg++; return bounds; },
    getScreenCTM() { reads.ctm++; return matrix; }
  };
  const material = createWheelMaterialPrototype({ canvas, svg, search });
  return { material, canvas, reads, draws, observers, documentRef, timers,
    advance(value) { now = value; for (const [id, callback] of timers) { timers.delete(id); callback(); } },
    set projectionScale(value) { projectionScale = value; } };
}

test("material keeps the initial pose through idle activation, caches projection and flushes the final pose", t => {
  const h = setup(t);
  const pose = new Map([["hour", 12], ["solar", 24]]);
  h.material.updateFrame(pose);
  assert.equal(h.material.initialize(), true);
  assert.deepEqual([h.canvas.width, h.canvas.height], [390, 740]);
  assert.deepEqual(h.draws[0].u_rotations, [12, 0, 0, 0]);
  assert.equal(h.draws[0].u_solar_rotation, 24);
  const reads = { ...h.reads };
  for (let n = 1; n <= 10; n++) {
    pose.set("hour", n);
    h.material.updateFrame(pose);
  }
  assert.equal(h.timers.size, 1);
  h.advance(34);
  assert.equal(h.draws.length, 2);
  assert.equal(h.draws.at(-1).u_rotations[0], 10);
  assert.deepEqual(h.reads, reads, "rotating the rings must not re-read page layout");
  h.material.updateFrame(pose);
  h.advance(70);
  assert.equal(h.draws.length, 2, "identical poses must not redraw the shader");

  h.projectionScale = 3;
  h.observers.camera();
  assert.equal(h.draws.at(-1).u_canvas_to_svg[0], 3);
  assert.equal(h.reads.ctm, reads.ctm + 1);
  globalThis.innerWidth = 1440;
  h.observers.resize();
  assert.deepEqual([h.canvas.width, h.canvas.height], [780, 1480]);
});

test("hidden material submits nothing and resumes once with the latest retained pose", t => {
  const h = setup(t);
  h.material.initialize();
  h.documentRef.hidden = true;
  h.documentRef.dispatchEvent(new Event("visibilitychange"));
  h.material.updateFrame(new Map([["hour", 80], ["solar", 160]]));
  h.advance(1000);
  assert.equal(h.draws.length, 1);
  assert.equal(h.timers.size, 0);
  h.documentRef.hidden = false;
  h.documentRef.dispatchEvent(new Event("visibilitychange"));
  assert.equal(h.draws.length, 2);
  assert.equal(h.draws.at(-1).u_rotations[0], 80);
  assert.equal(h.draws.at(-1).u_solar_rotation, 160);
});
