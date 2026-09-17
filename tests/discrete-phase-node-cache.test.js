import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/discrete-phase-view.js", import.meta.url), "utf8");

function bodyBetween(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("discrete phase caches only stable SVG slots", () => {
  assert.match(source, /const phaseNodeCache = new Map\(\);/);
  const nodes = bodyBetween("function phaseNodes", "function activeIndex");
  assert.match(nodes, /const cached = phaseNodeCache\.get\(id\);/);
  assert.match(nodes, /phaseNodeCache\.set\(id, nodes\);/);
  assert.doesNotMatch(nodes, /cycle-sector\.is-active/);
});

test("active sector remains live and gates initialization", () => {
  const active = bodyBetween("function activeIndex", "function readyActiveIndices");
  assert.match(active, /group\?\.querySelector\("\.cycle-sector\.is-active"\)/);

  const readiness = bodyBetween("function readyActiveIndices", "function clearBoundaryGate");
  assert.match(readiness, /const index = activeIndex\(group\);/);
  assert.match(readiness, /index === null\) return null;/);

  const refresh = bodyBetween("function refresh", "function scheduleRefresh");
  assert.match(refresh, /const activeIndices = readyActiveIndices\(\);/);
  assert.match(refresh, /!activeIndices/);
  assert.match(refresh, /renderPhase\(id, activeIndices\.get\(id\), phases\[id\], peers\.get\(id\)\)/);
});


test("discrete phase reuses refresh scratch collections", () => {
  assert.match(source, /const EMPTY_SHARED_PEERS = Object\.freeze\(\[\]\);/);
  assert.match(source, /const activeIndexScratch = new Map\(\);/);
  assert.match(source, /const sharedPeersScratch = new Map\(RING_IDS\.map\(id => \[id, EMPTY_SHARED_PEERS\]\)\);/);

  const readiness = bodyBetween("function readyActiveIndices", "function clearBoundaryGate");
  assert.match(readiness, /activeIndexScratch\.clear\(\);/);
  assert.match(readiness, /activeIndexScratch\.set\(id, index\);/);
  assert.match(readiness, /return activeIndexScratch;/);
  assert.doesNotMatch(readiness, /new Map\(/);

  const peers = bodyBetween("function sharedPeersByRing", "function finishInitialization");
  assert.match(peers, /for \(const id of RING_IDS\) sharedPeersScratch\.set\(id, EMPTY_SHARED_PEERS\);/);
  assert.match(peers, /sharedPeersScratch\.set\(id, group\.ringIds\.filter\(peer => peer !== id\)\);/);
  assert.match(peers, /return sharedPeersScratch;/);
  assert.doesNotMatch(peers, /new Map\(/);
});
