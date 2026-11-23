import test from "node:test";
import assert from "node:assert/strict";
import { createLabelCuller, OFFSCREEN_ATTRIBUTE } from "../src/wheel/label-culling.js";

function fakeNode() {
  const attributes = new Map();
  return {
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    hasAttribute(name) { return attributes.has(name); }
  };
}

const center = { x:600, y:1360 };
const viewBox = { x:400, y:400, width:400, height:400 };

test("a stationary ring refreshes after registration or a camera change while absent", () => {
  const culler = createLabelCuller({ svg:null, center, marginRatio:0, minMargin:0 });
  const poses = new Map([["year", 0]]);
  const node = fakeNode();
  culler.register("year", node, 600, 500);
  assert.equal(culler.update(poses, viewBox), 0);
  culler.register("year", fakeNode(), 600, 2220);
  assert.equal(culler.update(poses, viewBox), 1);
  assert.equal(culler.update(poses, viewBox), 1);
  const shifted = { ...viewBox, x:1000 };
  culler.update(new Map(), shifted);
  assert.equal(culler.update(poses, shifted), 2);
  assert.equal(node.hasAttribute(OFFSCREEN_ATTRIBUTE), true);
});

test("labels follow the SVG rotate() matrix into and out of the camera", () => {
  const culler = createLabelCuller({ svg:null, center, marginRatio:0, minMargin:0 });
  const top = fakeNode();
  const bottom = fakeNode();
  // Anchor straight above the centre, inside the camera at rest.
  culler.register("year", top, 600, 500);
  // Anchor below the centre: far outside the camera at rest.
  culler.register("year", bottom, 600, 2220);

  assert.equal(culler.update(new Map([["year", 0]]), viewBox), 1);
  assert.equal(top.hasAttribute(OFFSCREEN_ATTRIBUTE), false);
  assert.equal(bottom.hasAttribute(OFFSCREEN_ATTRIBUTE), true);

  // Half a turn swaps them.
  assert.equal(culler.update(new Map([["year", 180]]), viewBox), 1);
  assert.equal(top.hasAttribute(OFFSCREEN_ATTRIBUTE), true);
  assert.equal(bottom.hasAttribute(OFFSCREEN_ATTRIBUTE), false);
});

test("positive SVG rotation turns the top anchor clockwise on screen", () => {
  const culler = createLabelCuller({ svg:null, center, marginRatio:0, minMargin:0 });
  const node = fakeNode();
  culler.register("hour", node, 600, 500);
  // rotate(+90) maps (0,-860) → (+860,0): to the right of the centre, so it
  // is visible only in a camera on the right.
  const right = { x:1400, y:1300, width:200, height:200 };
  culler.update(new Map([["hour", 90]]), right);
  assert.equal(node.hasAttribute(OFFSCREEN_ATTRIBUTE), false);
  culler.update(new Map([["hour", -90]]), right);
  assert.equal(node.hasAttribute(OFFSCREEN_ATTRIBUTE), true);
});

test("the margin keeps labels just outside the camera painted", () => {
  const culler = createLabelCuller({ svg:null, center, marginRatio:0, minMargin:80 });
  const node = fakeNode();
  culler.register("day", node, 600, 350);
  culler.update(new Map([["day", 0]]), viewBox);
  assert.equal(node.hasAttribute(OFFSCREEN_ATTRIBUTE), false);
});

test("rings without a finite pose and an unready camera are left alone", () => {
  const culler = createLabelCuller({ svg:null, center });
  const node = fakeNode();
  culler.register("month", node, 600, 2220);
  assert.equal(culler.update(new Map(), viewBox), 0);
  assert.equal(culler.update(new Map([["month", 0]]), { x:0, y:0, width:0, height:0 }), 0);
  assert.equal(node.hasAttribute(OFFSCREEN_ATTRIBUTE), false);
});
