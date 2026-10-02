import test from "node:test";
import assert from "node:assert/strict";
import { setAttributeIfChanged, setDatasetIfChanged, setTextIfChanged } from "../src/wheel/svg-renderer.js";

test("unchanged live SVG and readout values do not generate repeated writes", () => {
  const attrs = new Map();
  let writes = 0, text = "", datasetWrites = 0;
  const node = {
    getAttribute:name => attrs.get(name) ?? null,
    setAttribute(name, value) { writes++; attrs.set(name, value); },
    dataset:new Proxy({}, { set(target, key, value) { datasetWrites++; target[key] = value; return true; } }),
    get textContent() { return text; },
    set textContent(value) { writes++; text = value; }
  };
  for (let frame = 0; frame < 120; frame++) {
    setAttributeIfChanged(node, "transform", "rotate(0 600 1360)");
    setDatasetIfChanged(node, "yearPillar", "丙午");
    setTextIfChanged(node, "丙午");
  }
  assert.equal(writes, 2);
  assert.equal(datasetWrites, 1);
  // An independent view may change the live node; a memoized assumption must
  // not prevent the next authoritative frame from restoring its correct state.
  attrs.set("transform", "rotate(1 600 1360)");
  node.dataset.yearPillar = "丁未";
  node.textContent = "丁未";
  assert.equal(setAttributeIfChanged(node, "transform", "rotate(0 600 1360)"), true);
  assert.equal(setDatasetIfChanged(node, "yearPillar", "丙午"), true);
  assert.equal(setTextIfChanged(node, "丙午"), true);
  assert.equal(node.textContent, "丙午");
  assert.equal(setTextIfChanged(null, "丙午"), false);
});
