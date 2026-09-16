import test from "node:test";
import assert from "node:assert/strict";
import {
  SELECTED_INSTANT_COMMAND,
  selectedInstantFromCommandDetail
} from "../src/interaction/selected-instant-command.js";

test("selected-instant command contract keeps the canonical event name", () => {
  assert.equal(SELECTED_INSTANT_COMMAND, "atlas:set-selected-instant");
});

test("selected-instant command accepts finite numeric epochs including zero", () => {
  assert.equal(selectedInstantFromCommandDetail({ instantMs:0 }), 0);
  assert.equal(selectedInstantFromCommandDetail({ instantMs:1789549604000 }), 1789549604000);
});

test("selected-instant command fails closed instead of coercing malformed payloads", () => {
  for (const detail of [
    null,
    undefined,
    {},
    { instantMs:null },
    { instantMs:"0" },
    { instantMs:"1789549604000" },
    { instantMs:NaN },
    { instantMs:Infinity },
    { instantMs:-Infinity }
  ]) {
    assert.equal(selectedInstantFromCommandDetail(detail), null);
  }
});
