import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync(new URL("../src/selected-instant-editor.js", import.meta.url), "utf8");
const editorCss = readFileSync(new URL("../selected-instant-editor.css", import.meta.url), "utf8");
const analysis = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../desktop-tools-workspace.css", import.meta.url), "utf8");

test("desktop ordinary reading and Tools edit Selected Instant at the authoritative read-head", () => {
  assert.match(editor, /querySelector\("#instant-readout"\)/);
  assert.match(editor, /readoutShell\.dataset\.instantEditorAvailable = String\(enabled\)/);
  assert.doesNotMatch(editor, /instrument\.dataset\.analysisOpen === "true"/);
  assert.match(editor, /instrument\.dataset\.inverseTimeSearch !== "active"/);
  assert.match(editorCss, /@media \(min-width: 821px\)/);
  assert.match(editorCss, /#kinetic-instrument:not\(\[data-inverse-time-search="active"\]\)[\s\S]*\.instrument-readout\[data-instant-editor-available="true"\][\s\S]*pointer-events:\s*auto/);
  assert.match(editorCss, /#instant-readout[\s\S]*cursor:\s*pointer/);
  assert.match(workspace, /~ \.timeline-dock \{[\s\S]*display:\s*none\s*!important/);
});

test("read-head editor reuses canonical temporal parsing and command authority", () => {
  assert.match(editor, /instantFromAtlasLocalInput/);
  assert.match(editor, /civilFieldsFromInstant/);
  assert.match(editor, /atlasInputValueFromFields/);
  assert.match(editor, /SELECTED_INSTANT_COMMAND/);
  assert.match(editor, /source:"readout-inline"/);
  assert.doesNotMatch(editor, /instrument\.dataset\.selectedInstantMs\s*=/);
  assert.doesNotMatch(editor, /Date\.now\(\)/);
});

test("invalid local date-time input fails closed before dispatch", () => {
  assert.match(editor, /const roundTrip = atlasInputValueFromFields\(civilFieldsFromInstant\(instantMs, context\)\)/);
  assert.match(editor, /if \(roundTrip !== raw\)/);
  assert.match(editor, /日期或時間無效/);
});

test("inline editor owns Escape before the Tools back-stack", () => {
  assert.match(editor, /event\.key !== "Escape" \|\| !open/);
  assert.match(editor, /event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*closeEditor/);
  assert.match(analysis, /instrument\.dataset\.instantEditorOpen === "true"/);
});

test("selected-instant editor stays desktop-only and yields to Find Time", () => {
  assert.match(editorCss, /@media \(max-width: 820px\)[\s\S]*\.selected-instant-editor\s*\{\s*display:\s*none\s*!important;/);
  assert.match(editor, /atlas-find-time-entering/);
  assert.match(editor, /atlas-tools-closing/);
  assert.match(analysis, /installSelectedInstantEditorStyles\(\)/);
  assert.match(analysis, /installSelectedInstantEditor\(instrument\)/);
});
