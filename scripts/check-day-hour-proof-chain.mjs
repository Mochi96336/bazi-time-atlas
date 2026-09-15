import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dumpDom(path) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=2500",
    "--dump-dom",
    url
  ], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function stageTag(dom, id) {
  return dom.match(new RegExp(`<article[^>]*data-proof-stage="${id}"[^>]*>`))?.[0] ?? "";
}

function expectStage(dom, id, expected, label, url) {
  const tag = stageTag(dom, id);
  const actual = attr(tag, "data-status");
  if (actual !== expected) {
    throw new Error(`${label}: expected ${id} status=${expected}, got ${actual}: ${url}`);
  }
}

const zero = dumpDom("recurrence.html?date=2026-09-13&delta=0");
const zeroInstrument = tagById(zero.dom, "recurrence-instrument");
const zeroPanel = tagById(zero.dom, "day-hour-proof-chain");
if (attr(zeroPanel, "data-ready") !== "true" || attr(zeroPanel, "data-identity") !== "true") {
  throw new Error(`zero identity: proof chain did not settle as identity: ${zero.url}`);
}
if (attr(zeroInstrument, "data-day-hour-proof-day-resolved") !== "true" || attr(zeroInstrument, "data-day-hour-proof-hour-resolved") !== "true") {
  throw new Error(`zero identity: Day/Hour identity bypass missing: ${zero.url}`);
}
if (!zero.dom.includes("Δ=0 · identity bypass") || !zero.dom.includes("同一狀態不需要跨時代的絕對時間投影")) {
  throw new Error(`zero identity: identity-bypass explanation missing: ${zero.url}`);
}
expectStage(zero.dom, "absolute-seasonal-epoch", "satisfied", "zero identity", zero.url);
console.log(`[day-hour-proof] PASS identity bypass with current absolute-epoch availability: ${zero.url}`);

const local = dumpDom("recurrence.html?date=2026-09-13&delta=1980");
const localInstrument = tagById(local.dom, "recurrence-instrument");
const localPanel = tagById(local.dom, "day-hour-proof-chain");
const localExact = {
  "data-ready":"true",
  "data-identity":"false",
  "data-first-hard-blocker":"earth-rotation-bridge",
  "data-earth-rotation-estimate-available":"true",
  "data-day-resolved":"false",
  "data-hour-resolved":"false",
  "data-stage-count":"10"
};
for (const [name, expected] of Object.entries(localExact)) {
  const actual = attr(localPanel, name);
  if (actual !== expected) throw new Error(`4006 proof: expected ${name}=${expected}, got ${actual}: ${local.url}`);
}
if (attr(localInstrument, "data-day-hour-proof-first-hard-blocker") !== "earth-rotation-bridge") {
  throw new Error(`4006 proof: instrument first blocker mismatch: ${local.url}`);
}
if (attr(localInstrument, "data-day-hour-proof-earth-rotation-estimate-available") !== "true") {
  throw new Error(`4006 proof: Earth-rotation estimate capability missing from instrument: ${local.url}`);
}
expectStage(local.dom, "relative-term-geometry", "satisfied", "4006 proof", local.url);
expectStage(local.dom, "absolute-seasonal-epoch", "satisfied", "4006 proof", local.url);
expectStage(local.dom, "earth-rotation-bridge", "uncertain-estimate", "4006 proof", local.url);
if (!local.dom.includes("有估計 · 不確定") || !local.dom.includes("deterministic Earth rotation")) {
  throw new Error(`4006 proof: uncertainty-aware Earth-rotation explanation missing: ${local.url}`);
}
console.log(`[day-hour-proof] PASS 4006 TT→UT1 estimate exists but remains uncertainty-blocked: ${local.url}`);

const global = dumpDom("recurrence.html?date=2026-09-13&delta=24000");
const instrument = tagById(global.dom, "recurrence-instrument");
const panel = tagById(global.dom, "day-hour-proof-chain");
const exact = {
  "data-ready":"true",
  "data-identity":"false",
  "data-first-hard-blocker":"absolute-seasonal-epoch",
  "data-earth-rotation-estimate-available":"false",
  "data-day-resolved":"false",
  "data-hour-resolved":"false",
  "data-stage-count":"10"
};
for (const [name, expected] of Object.entries(exact)) {
  const actual = attr(panel, name);
  if (actual !== expected) throw new Error(`24000-year proof: expected ${name}=${expected}, got ${actual}: ${global.url}`);
}
if (attr(instrument, "data-day-hour-proof-first-hard-blocker") !== "absolute-seasonal-epoch") {
  throw new Error(`24000-year proof: instrument first blocker mismatch: ${global.url}`);
}
if (attr(instrument, "data-day-hour-proof-day-resolved") !== "false" || attr(instrument, "data-day-hour-proof-hour-resolved") !== "false") {
  throw new Error(`24000-year proof: instrument should keep Day/Hour blocked: ${global.url}`);
}

const expectedStages = {
  "relative-term-geometry":"satisfied",
  "absolute-seasonal-epoch":"missing-deep-time-model",
  "earth-rotation-bridge":"blocked",
  "civil-zone":"unbound-convention",
  "day-boundary":"unbound-convention",
  "sexagenary-day-arithmetic":"satisfied",
  "clock-basis":"unbound-convention",
  longitude:"conditional",
  "equation-of-time":"conditional",
  "hour-rules":"satisfied"
};
for (const [id, status] of Object.entries(expectedStages)) expectStage(global.dom, id, status, "24000-year proof", global.url);

if (!global.dom.includes("絕對季節 epoch") || !global.dom.includes("先把春分／節氣放回絕對均勻時間軸")) {
  throw new Error(`24000-year proof: first-hard-blocker explanation missing: ${global.url}`);
}
if (!global.dom.includes("民用時區") || !global.dom.includes("日界規則") || !global.dom.includes("時計 basis")) {
  throw new Error(`24000-year proof: convention blockers missing: ${global.url}`);
}
console.log(`[day-hour-proof] PASS 24000-year proof remains blocked at absolute-seasonal-epoch: ${global.url}`);
