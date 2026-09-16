import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");

function bodyBetween(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("external time authorities interrupt active drag without making drag-start self-cancel", () => {
  const stopPlayback = bodyBetween("function stopPlayback", "function setSelectedInstant");
  assert.match(stopPlayback, /interruptActiveDrag\s*=\s*false/);
  assert.match(
    stopPlayback,
    /if \(interruptActiveDrag\)[\s\S]*?cancelActiveGesture\?\.\(\{ detent:true, reason \}\)/
  );
  assert.match(stopPlayback, /cancelInertia\?\.\(\{ detent:true, reason \}\)/);

  const externalInterrupts = source.match(
    /stopPlayback\(\{ interruptActiveDrag:true, reason:"external-control" \}\);/g
  ) ?? [];
  assert.equal(externalInterrupts.length, 4);

  const playback = bodyBetween("function installPlayback", "function applyLinkedDragToTime");
  assert.match(
    playback,
    /cancelActiveGesture\?\.\(\{ detent:true, reason:"playback-start" \}\)/
  );
  assert.match(
    playback,
    /cancelInertia\?\.\(\{ detent:true, reason:"playback-start" \}\)/
  );

  const ringDrag = bodyBetween("function installRingDrag", "function bindControls");
  assert.match(ringDrag, /onDragStart\(id\)\s*\{\s*stopPlayback\(\);/);
  assert.match(ringDrag, /onLinkedDragStart\(id\)\s*\{\s*stopPlayback\(\);/);
  assert.doesNotMatch(
    ringDrag,
    /on(?:Linked)?DragStart\(id\)[\s\S]{0,120}?interruptActiveDrag:true/
  );
});
