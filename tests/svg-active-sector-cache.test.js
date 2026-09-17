import test from "node:test";
import assert from "node:assert/strict";

import { setActiveSector } from "../src/wheel/svg-renderer.js";

class FakeClassList {
  constructor() {
    this.values = new Set();
    this.operations = [];
  }

  toggle(name, force) {
    this.operations.push(["toggle", name, force]);
    if (force) this.values.add(name);
    else this.values.delete(name);
    return force;
  }

  add(name) {
    this.operations.push(["add", name]);
    this.values.add(name);
  }

  remove(name) {
    this.operations.push(["remove", name]);
    this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }

  clearOperations() {
    this.operations.length = 0;
  }
}

function fakeNodes(count) {
  return Array.from({ length:count }, () => ({ classList:new FakeClassList() }));
}

function operationCount(nodes) {
  return nodes.reduce((sum, node) => sum + node.classList.operations.length, 0);
}

function clearOperations(nodes) {
  nodes.forEach(node => node.classList.clearOperations());
}

test("active-sector updates skip same-index sweeps and only touch changed nodes", () => {
  const nodes = fakeNodes(60);

  setActiveSector(nodes, 12);
  assert.equal(operationCount(nodes), 60);
  assert.equal(nodes[12].classList.contains("is-active"), true);
  assert.equal(nodes.filter(node => node.classList.contains("is-active")).length, 1);

  clearOperations(nodes);
  setActiveSector(nodes, 12);
  assert.equal(operationCount(nodes), 0);

  setActiveSector(nodes, 13);
  assert.equal(operationCount(nodes), 2);
  assert.deepEqual(nodes[12].classList.operations, [["remove", "is-active"]]);
  assert.deepEqual(nodes[13].classList.operations, [["add", "is-active"]]);
  assert.equal(nodes[12].classList.contains("is-active"), false);
  assert.equal(nodes[13].classList.contains("is-active"), true);

  clearOperations(nodes);
  setActiveSector(nodes, -1);
  assert.equal(operationCount(nodes), 1);
  assert.deepEqual(nodes[13].classList.operations, [["remove", "is-active"]]);
  assert.equal(nodes.some(node => node.classList.contains("is-active")), false);

  clearOperations(nodes);
  setActiveSector(nodes, -1);
  assert.equal(operationCount(nodes), 0);

  setActiveSector(nodes, 4);
  assert.equal(operationCount(nodes), 1);
  assert.deepEqual(nodes[4].classList.operations, [["add", "is-active"]]);
  assert.equal(nodes[4].classList.contains("is-active"), true);
});
