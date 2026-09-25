import { inflateSync } from "node:zlib";
import { RADII, FAN, WHEEL_CENTER } from "../src/wheel/ring-model.js";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}

// Chrome screenshot contract: 8-bit, non-interlaced RGB/RGBA. Reject unknown formats.
export function decodePngRgb(bytes) {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error("PNG signature missing");
  let offset = 8, width, height, bpp, idat = [], done = false;
  while (offset + 12 <= bytes.length) {
    const len = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (len > bytes.length - offset - 12) throw new Error("truncated PNG chunk");
    const payload = bytes.subarray(offset + 8, offset + 8 + len);
    offset += len + 12;
    if (type === "IHDR") {
      if (len !== 13 || width !== undefined) throw new Error("invalid PNG IHDR");
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      bpp = payload[9] === 2 ? 3 : payload[9] === 6 ? 4 : 0;
      if (width < 1 || height < 1 || width * height > 8_000_000 || payload[8] !== 8 || !bpp || payload[12] !== 0) {
        throw new Error("unsupported PNG color or dimensions");
      }
    } else if (type === "IDAT") idat.push(payload);
    else if (type === "IEND") { done = true; break; }
  }
  if (!done || !bpp || !idat.length) throw new Error("PNG missing required chunks");
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw new Error("PNG scanline size mismatch");
  const rgb = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride), cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor++];
    if (filter > 4) throw new Error("unsupported PNG filter");
    const line = Buffer.allocUnsafe(stride);
    for (let i = 0; i < stride; i += 1) {
      const encoded = raw[cursor++], left = i >= bpp ? line[i - bpp] : 0;
      const up = prev[i], upperLeft = i >= bpp ? prev[i - bpp] : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up :
        filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      line[i] = (encoded + prediction) & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const source = x * bpp, dest = (y * width + x) * 3;
      rgb[dest] = line[source]; rgb[dest + 1] = line[source + 1]; rgb[dest + 2] = line[source + 2];
      if (bpp === 4 && line[source + 3] !== 255) throw new Error("translucent PNG screenshot is not supported");
    }
    prev = line;
  }
  return { width, height, rgb };
}

// Exact SVG.getScreenCTM() from the screenshot viewport, never hand-picked pixel boxes.
export function materialMasks(width, height, ctm) {
  if (ctm.length !== 6 || ctm.some(v => !Number.isFinite(v))) throw new Error("invalid screen CTM");
  const [a, b, c, d, e, f] = ctm, det = a * d - b * c;
  if (Math.abs(det) < 1e-8) throw new Error("non-invertible screen CTM");
  const names = ["all", "solar", "zodiac", "graphite"];
  const masks = Object.fromEntries(names.map(name => [name, new Uint8Array(width * height)]));
  const counts = Object.fromEntries(names.map(name => [name, 0]));
  const margin = 4; // SVG units; do not measure aliased rims as material surface.
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const sx = x + 0.5 - e, sy = y + 0.5 - f;
    const px = (d * sx - c * sy) / det - WHEEL_CENTER.x;
    const py = (-b * sx + a * sy) / det - WHEEL_CENTER.y;
    const angle = Math.atan2(py, px) * 180 / Math.PI;
    if (angle < FAN.start + 1 || angle > FAN.end - 1) continue;
    const rad = Math.hypot(px, py), i = y * width + x;
    let region = null;
    if (rad > RADII.dayOuter + margin && rad < RADII.solarTermOuter - margin) region = "solar";
    else if (rad > RADII.solarTermOuter + margin && rad < RADII.solarOuter - margin) region = "zodiac";
    else if ((rad > RADII.inner + margin && rad < RADII.dayOuter - margin && Math.abs(rad - RADII.hourOuter) > margin)
      || (rad > RADII.solarOuter + margin && rad < RADII.yearOuter - margin && Math.abs(rad - RADII.monthOuter) > margin)) {
      region = "graphite";
    }
    if (region) {
      masks[region][i] = 1; counts[region] += 1;
      masks.all[i] = 1; counts.all += 1;
    }
  }
  for (const key of ["solar", "zodiac", "graphite"]) if (counts[key] < 1000) {
    throw new Error("material ROI " + key + " is implausibly small: " + counts[key]);
  }
  return { masks, counts };
}

export function compareMaterialPng(a, b, mask) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("material PNG viewport mismatch");
  if (mask.length !== a.width * a.height) throw new Error("material ROI dimensions mismatch");
  let samples = 0, changed = 0, sum = 0, max = 0, lumaA = 0, lumaB = 0;
  let minX = a.width, minY = a.height, maxX = -1, maxY = -1;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    samples += 1;
    let delta = 0;
    for (let c = 0; c < 3; c += 1) {
      const n = i * 3 + c, diff = Math.abs(a.rgb[n] - b.rgb[n]);
      delta = Math.max(delta, diff); sum += diff;
    }
    const offset = i * 3;
    lumaA += a.rgb[offset] * .2126 + a.rgb[offset + 1] * .7152 + a.rgb[offset + 2] * .0722;
    lumaB += b.rgb[offset] * .2126 + b.rgb[offset + 1] * .7152 + b.rgb[offset + 2] * .0722;
    max = Math.max(max, delta);
    if (delta >= 3) {
      changed += 1;
      const x = i % a.width, y = Math.floor(i / a.width);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (!samples) throw new Error("empty material pixel mask");
  return {
    pixels: samples, changedPixels3: changed,
    changedFraction3: Number((changed / samples).toFixed(6)),
    meanAbsoluteRgb8: Number((sum / (samples * 3)).toFixed(5)),
    maxChannelDelta8: max,
    meanDisplayLuma8: [Number((lumaA / samples).toFixed(3)), Number((lumaB / samples).toFixed(3))],
    changedBounds: changed ? { x0: minX, y0: minY, x1: maxX, y1: maxY } : null
  };
}
