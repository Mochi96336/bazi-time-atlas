import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync(candidate, ["--version"], { encoding:"utf8" });
    if (!probe.error && probe.status === 0) return candidate;
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

function textById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>([^<]*)</[^>]+>`))?.[1]?.trim() ?? "";
}

function stageTag(dom, id) {
  return dom.match(new RegExp(`<article[^>]*data-proof-stage="${id}"[^>]*>`))?.[0] ?? "";
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
  || attr(unboundPanel, "data-hour-resolved") !== "false"
  || attr(unboundControls, "data-longitude-degrees") !== "unbound"
  || attr(unboundControls, "data-longitude-valid") !== "true"
) {
  throw new Error(`mean-solar without lon must remain explicitly longitude-blocked: ${unbound.url}`);
}
expectStage(unbound.dom, "longitude", "unbound-convention", "mean-solar without lon", unbound.url);
if (!unbound.dom.includes("fixed-zone offset 不會被推定成地理經度")) {
  throw new Error(`mean-solar without lon: no-inference warning missing: ${unbound.url}`);
}
console.log(`[longitude-ui] PASS UT1 offset does not imply longitude: ${unbound.url}`);

const mean = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar&lon=121.5`);
const meanPanel = tagById(mean.dom, "day-hour-proof-chain");
const meanControls = tagById(mean.dom, "target-instant-controls");
const meanInstrument = tagById(mean.dom, "recurrence-instrument");
if (
  attr(meanPanel, "data-first-hard-blocker") !== "none"
  || attr(meanPanel, "data-longitude-degrees") !== "121.5"
  || attr(meanPanel, "data-longitude-bound") !== "true"
  || attr(meanPanel, "data-longitude-control-valid") !== "true"
  || attr(meanPanel, "data-hour-resolved") !== "true"
  || attr(meanControls, "data-longitude-degrees") !== "121.5"
  || attr(meanControls, "data-longitude-valid") !== "true"
  || attr(meanInstrument, "data-day-hour-proof-longitude-degrees") !== "121.5"
  || attr(meanInstrument, "data-day-hour-proof-longitude-bound") !== "true"
) {
  throw new Error(`mean-solar explicit lon did not propagate through control/panel/instrument: ${mean.url}`);
}
expectStage(mean.dom, "longitude", "satisfied", "mean-solar explicit lon", mean.url);
expectStage(mean.dom, "equation-of-time", "not-required", "mean-solar explicit lon", mean.url);
if (textById(mean.dom, "proof-chain-hour-blockers") !== "無 blocker") {
  throw new Error(`mean-solar explicit lon should resolve Hour: ${mean.url}`);
}
console.log(`[longitude-ui] PASS explicit east-positive lon resolves mean-solar Hour: ${mean.url}`);

const primeMeridian = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar&lon=0`);
const primePanel = tagById(primeMeridian.dom, "day-hour-proof-chain");
if (
  attr(primePanel, "data-first-hard-blocker") !== "none"
  || attr(primePanel, "data-longitude-degrees") !== "0"
  || attr(primePanel, "data-longitude-bound") !== "true"
  || attr(primePanel, "data-hour-resolved") !== "true"
) {
  throw new Error(`0-degree longitude must remain explicitly bound: ${primeMeridian.url}`);
}
expectStage(primeMeridian.dom, "longitude", "satisfied", "prime meridian", primeMeridian.url);
console.log(`[longitude-ui] PASS lon=0 is not mistaken for unbound: ${primeMeridian.url}`);

const apparent = dumpDom(`${fixedZonePath}&clockBasis=local-apparent-solar&lon=-74.006`);
const apparentPanel = tagById(apparent.dom, "day-hour-proof-chain");
const apparentControls = tagById(apparent.dom, "target-instant-controls");
if (
  attr(apparentPanel, "data-first-hard-blocker") !== "equation-of-time"
  || attr(apparentPanel, "data-longitude-degrees") !== "-74.006"
  || attr(apparentPanel, "data-longitude-bound") !== "true"
  || attr(apparentPanel, "data-longitude-control-valid") !== "true"
  || attr(apparentPanel, "data-hour-resolved") !== "false"
  || attr(apparentControls, "data-longitude-degrees") !== "-74.006"
  || attr(apparentControls, "data-longitude-valid") !== "true"
) {
  throw new Error(`apparent-solar explicit lon must advance exactly to EoT: ${apparent.url}`);
}
expectStage(apparent.dom, "longitude", "satisfied", "apparent-solar explicit lon", apparent.url);
expectStage(apparent.dom, "equation-of-time", "missing-deep-time-model", "apparent-solar explicit lon", apparent.url);
if (textById(apparent.dom, "proof-chain-hour-blockers") !== "Equation of Time") {
  throw new Error(`apparent-solar explicit lon should leave only EoT: ${apparent.url}`);
}
console.log(`[longitude-ui] PASS explicit west longitude advances apparent-solar exactly to EoT: ${apparent.url}`);

for (const rawLon of ["181", "-181", "not-a-number", ""]) {
  const suffix = rawLon === "" ? "lon=" : `lon=${encodeURIComponent(rawLon)}`;
  const invalid = dumpDom(`${fixedZonePath}&clockBasis=local-mean-solar&${suffix}`);
  const invalidPanel = tagById(invalid.dom, "day-hour-proof-chain");
  const invalidControls = tagById(invalid.dom, "target-instant-controls");
  if (
    attr(invalidPanel, "data-first-hard-blocker") !== "longitude"
    || attr(invalidPanel, "data-longitude-degrees") !== "unbound"
    || attr(invalidPanel, "data-longitude-bound") !== "false"
    || attr(invalidPanel, "data-longitude-control-valid") !== "false"
    || attr(invalidControls, "data-longitude-degrees") !== "unbound"
    || attr(invalidControls, "data-longitude-valid") !== "false"
  ) {
    throw new Error(`invalid lon=${JSON.stringify(rawLon)} must fail closed to unbound: ${invalid.url}`);
  }
  expectStage(invalid.dom, "longitude", "unbound-convention", `invalid lon=${JSON.stringify(rawLon)}`, invalid.url);
}
console.log("[longitude-ui] PASS invalid/out-of-range/empty lon queries fail closed");
