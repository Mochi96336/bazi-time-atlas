import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { decodePngRgb, materialMasks, compareMaterialPng } from "../scripts/material-png-metrics.mjs";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) {
    crc ^= value;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const header = Buffer.from(type, "ascii");
  const size = Buffer.alloc(4); size.writeUInt32BE(payload.length);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc32(Buffer.concat([header, payload])));
  return Buffer.concat([size, header, payload, sum]);
}
function makePng(width, height, scanlines, { rgba = false } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = rgba ? 6 : 2;
  return Buffer.concat([signature, chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(scanlines))), chunk("IEND", Buffer.alloc(0))]);
}

test("H2.0 decodes reproducible PNG RGB with distinct row filters", () => {
  const baseline = makePng(2, 1, [0, 10, 20, 30, 40, 50, 60]);
  const sameWithSubFilter = makePng(2, 1, [1, 10, 20, 30, 30, 30, 30]);
  const expected = [10, 20, 30, 40, 50, 60];
  assert.deepEqual([...decodePngRgb(baseline).rgb], expected);
  assert.deepEqual([...decodePngRgb(sameWithSubFilter).rgb], expected);
  const rgba = makePng(1, 1, [0, 12, 25, 33, 255], { rgba: true });
  assert.deepEqual([...decodePngRgb(rgba).rgb], [12, 25, 33]);
  assert.throws(() => decodePngRgb(Buffer.from("not png")), /PNG signature/);
  assert.throws(() => decodePngRgb(makePng(1, 1, [0, 12, 25, 33, 1], { rgba: true })), /translucent/);
});

test("H2.0 reports actual sampled delta, not a subjective quality score", () => {
  const a = decodePngRgb(makePng(2, 1, [0, 10, 20, 30, 40, 50, 60]));
  const b = decodePngRgb(makePng(2, 1, [0, 13, 25, 29, 40, 50, 60]));
  const mask = Uint8Array.of(1, 1);
  const delta = compareMaterialPng(a, b, mask);
  assert.equal(delta.pixels, 2);
  assert.equal(delta.changedPixels3, 1);
  assert.equal(delta.changedFraction3, 0.5);
  assert.equal(delta.meanAbsoluteRgb8, 1.5);
  assert.equal(delta.maxChannelDelta8, 5);
  assert.deepEqual(delta.changedBounds, { x0: 0, y0: 0, x1: 0, y1: 0 });
  assert.equal(compareMaterialPng(a, a, mask).changedPixels3, 0);
  assert.throws(() => compareMaterialPng(a, b, Uint8Array.of(1)), /dimensions/);
});

test("H2.0 surface ROIs come from canonical SVG geometry and a measured CTM", () => {
  const { masks, counts } = materialMasks(1440, 900, [1, 0, 0, 1, 0, 0]);
  for (const region of ["solar", "zodiac", "graphite"]) assert.ok(counts[region] > 1000);
  assert.equal(counts.all, counts.solar + counts.zodiac + counts.graphite);
  assert.equal(masks.solar.length, 1440 * 900);
  assert.throws(() => materialMasks(1440, 900, [0, 0, 0, 0, 0, 0]), /non-invertible/);
  assert.throws(() => materialMasks(1440, 900, [1, 2]), /invalid screen CTM/);
});
