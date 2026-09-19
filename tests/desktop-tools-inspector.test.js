import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const visible = readFileSync(new URL("../src/atlas-visible-ten-gods.js", import.meta.url), "utf8");
const inspector = readFileSync(new URL("../src/ganzhi-inspector.js", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../desktop-tools-workspace.css", import.meta.url), "utf8");

test("desktop Four Pillars summary opens the existing structure inspector", () => {
  assert.match(visible, /document\.createElement\("button"\)/);
  assert.match(visible, /atlas-ganzhi-inspect/);
  assert.match(visible, /source:"tools-right-rail"/);
  assert.match(inspector, /document\.addEventListener\("atlas-ganzhi-inspect"/);
  assert.match(inspector, /openInspector\(pillar, \{ trigger:null \}\)/);
});

test("inspector open state is projected back to the instrument without gaining time authority", () => {
  assert.match(inspector, /instrument\.dataset\.ganzhiInspectorOpen = "true"/);
  assert.match(inspector, /instrument\.dataset\.ganzhiInspectorOpen = "false"/);
  assert.doesNotMatch(visible, /selectedInstantMs|dispatchEvent\(new CustomEvent\("atlas-selected/);
});

test("desktop detailed inspector replaces the summary in the same faded right rail", () => {
  assert.match(workspace, /data-ganzhi-inspector-open="true"\] \.atlas-visible-ten-gods[\s\S]*?visibility: hidden;/);
  assert.match(workspace, /~ #ganzhi-inspector \{[\s\S]*?right: 0;[\s\S]*?width: 380px;[\s\S]*?linear-gradient\(to left,/);
  assert.match(workspace, /~ #ganzhi-inspector \.ganzhi-inspector-head/);
});

test("inspector Escape closes only the inspector layer", () => {
  assert.match(inspector, /event\.key === "Escape" && !inspector\.hidden/);
  assert.match(inspector, /event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*closeInspector/);
  assert.match(inspector, /document\.addEventListener\("atlas-tools-closing"/);
  assert.match(inspector, /document\.addEventListener\("atlas-find-time-entering"/);
});
