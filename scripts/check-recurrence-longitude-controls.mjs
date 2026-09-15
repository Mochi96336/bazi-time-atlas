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

function textById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>([^<]*)</[^>]+>`))?.[1]?.trim() ?? "";
}

function expectStage(dom, id, expected, label, url) {
  const actual = attr(stageTag(dom, id), "data-status");
  if (actual !== expected) {
    throw new Error(`${label}: expected ${id} status=${expected}, got ${actual}: ${url}`);
  }
}

const fixedZonePath = "recurrence.html?date=2026-09-13&delta=1980&targetClock=fixed-zone&targetTime=12%3A34%3A56&ut1Offset=8&dayBoundary=zi-initial-next-day";

const unbound = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar`);
const unboundPanel = tagById(unbound.dom, "day-hour-proof-chain");
const unboundControls = tagById(unbound.dom, "target-instant-controls");
if (
  attr(unboundPanel, "data-first-hard-blocker") !== "longitude"
  || attr(unboundPanel, "data-longitude-degrees") !== "unbound"
  || attr(unboundPanel, "data-longitude-bound") !== "false"
  || attr(unboundPanel, "data-longitude-control-valid") !== "true"
  || attr(unboundControls, "data-longitude") !== "unbound"
  || attr(unboundControls, "data-longitude-valid") !== "true"
) {
  throw new Error(`unbound longitude must remain explicit and block mean solar Hour: ${unbound.url}`);
}
expectStage(unbound.dom, "longitude", "unbound-convention", "unbound mean solar", unbound.url);
console.log(`[recurrence-longitude] PASS unbound longitude remains a typed blocker: ${unbound.url}`);

const meanSolar = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar&lon=121.5`);
const meanPanel = tagById(meanSolar.dom, "day-hour-proof-chain");
const meanControls = tagById(meanSolar.dom, "target-instant-controls");
const meanInstrument = tagById(meanSolar.dom, "recurrence-instrument");
if (
  attr(meanPanel, "data-first-hard-blocker") !== "none"
  || attr(meanPanel, "data-longitude-degrees") !== "121.5"
  || attr(meanPanel, "data-longitude-bound") !== "true"
  || attr(meanPanel, "data-longitude-control-valid") !== "true"
  || attr(meanPanel, "data-hour-resolved") !== "true"
  || attr(meanControls, "data-longitude") !== "121.5"
  || attr(meanControls, "data-longitude-valid") !== "true"
  || attr(meanInstrument, "data-day-hour-proof-longitude-degrees") !== "121.5"
  || attr(meanInstrument, "data-day-hour-proof-longitude-bound") !== "true"
) {
  throw new Error(`mean-solar longitude did not propagate through query/control/proof/instrument: ${meanSolar.url}`);
}
expectStage(meanSolar.dom, "longitude", "satisfied", "bound mean solar", meanSolar.url);
expectStage(meanSolar.dom, "equation-of-time", "not-required", "bound mean solar", meanSolar.url);
if (textById(meanSolar.dom, "proof-chain-hour-blockers") !== "無 blocker") {
  throw new Error(`bound mean-solar Hour should resolve without Equation of Time: ${meanSolar.url}`);
}
if (!meanSolar.dom.includes("E121.5°") || !meanSolar.dom.includes("east-positive")) {
  throw new Error(`bound mean-solar longitude detail missing canonical sign convention: ${meanSolar.url}`);
}
console.log(`[recurrence-longitude] PASS lon=121.5 resolves local mean solar Hour: ${meanSolar.url}`);

const zeroLongitude = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar&lon=0`);
const zeroPanel = tagById(zeroLongitude.dom, "day-hour-proof-chain");
const zeroControls = tagById(zeroLongitude.dom, "target-instant-controls");
if (
  attr(zeroPanel, "data-first-hard-blocker") !== "none"
  || attr(zeroPanel, "data-longitude-degrees") !== "0"
  || attr(zeroPanel, "data-longitude-bound") !== "true"
  || attr(zeroPanel, "data-longitude-control-valid") !== "true"
  || attr(zeroPanel, "data-hour-resolved") !== "true"
  || attr(zeroControls, "data-longitude") !== "0"
  || attr(zeroControls, "data-longitude-valid") !== "true"
) {
  throw new Error(`lon=0 must remain a valid bound Greenwich coordinate rather than becoming unbound: ${zeroLongitude.url}`);
}
expectStage(zeroLongitude.dom, "longitude", "satisfied", "zero longitude mean solar", zeroLongitude.url);
console.log(`[recurrence-longitude] PASS lon=0 remains a valid bound longitude: ${zeroLongitude.url}`);

const apparent = dumpDom(`${fixedZonePath}&clockBasis=local-apparent-solar&lon=-74.006`);
const apparentPanel = tagById(apparent.dom, "day-hour-proof-chain");
const apparentControls = tagById(apparent.dom, "target-instant-controls");
if (
  attr(apparentPanel, "data-first-hard-blocker") !== "equation-of-time"
  || attr(apparentPanel, "data-longitude-degrees") !== "-74.006"
  || attr(apparentPanel, "data-longitude-bound") !== "true"
  || attr(apparentPanel, "data-needs-longitude") !== "true"
  || attr(apparentPanel, "data-needs-equation-of-time") !== "true"
  || attr(apparentPanel, "data-hour-resolved") !== "false"
  || attr(apparentControls, "data-longitude") !== "-74.006"
) {
  throw new Error(`apparent-solar longitude must advance exactly to Equation of Time: ${apparent.url}`);
}
expectStage(apparent.dom, "longitude", "satisfied", "bound apparent solar", apparent.url);
expectStage(apparent.dom, "equation-of-time", "missing-deep-time-model", "bound apparent solar", apparent.url);
const apparentBlockers = textById(apparent.dom, "proof-chain-hour-blockers");
if (!apparentBlockers.includes("Equation of Time") || apparentBlockers.includes("經度")) {
  throw new Error(`apparent-solar blocker ownership did not advance past longitude: ${apparent.url}`);
}
console.log(`[recurrence-longitude] PASS west longitude advances apparent solar to Equation of Time: ${apparent.url}`);

for (const rawLongitude of ["181", "-181", "abc"]) {
  const invalid = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar&lon=${encodeURIComponent(rawLongitude)}`);
  const invalidPanel = tagById(invalid.dom, "day-hour-proof-chain");
  const invalidControls = tagById(invalid.dom, "target-instant-controls");
  if (
    attr(invalidPanel, "data-first-hard-blocker") !== "longitude"
    || attr(invalidPanel, "data-longitude-degrees") !== "unbound"
    || attr(invalidPanel, "data-longitude-bound") !== "false"
    || attr(invalidPanel, "data-longitude-control-valid") !== "false"
    || attr(invalidControls, "data-longitude") !== "unbound"
    || attr(invalidControls, "data-longitude-valid") !== "false"
  ) {
    throw new Error(`invalid lon=${rawLongitude} query must fail closed to unbound longitude: ${invalid.url}`);
  }
  expectStage(invalid.dom, "longitude", "unbound-convention", `invalid longitude ${rawLongitude}`, invalid.url);
}
console.log("[recurrence-longitude] PASS positive/negative overflow and non-numeric longitudes fail closed");

const cleared = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar&lon=`);
const clearedPanel = tagById(cleared.dom, "day-hour-proof-chain");
const clearedControls = tagById(cleared.dom, "target-instant-controls");
if (
  attr(clearedPanel, "data-first-hard-blocker") !== "longitude"
  || attr(clearedPanel, "data-longitude-degrees") !== "unbound"
  || attr(clearedPanel, "data-longitude-bound") !== "false"
  || attr(clearedPanel, "data-longitude-control-valid") !== "true"
  || attr(clearedControls, "data-longitude") !== "unbound"
  || attr(clearedControls, "data-longitude-valid") !== "true"
) {
  throw new Error(`empty lon= must behave as an explicitly cleared, valid unbound control: ${cleared.url}`);
}
console.log(`[recurrence-longitude] PASS empty lon= clears the optional coordinate without inventing an error: ${cleared.url}`);
