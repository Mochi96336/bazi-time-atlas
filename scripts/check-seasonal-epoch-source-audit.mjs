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
    "--virtual-time-budget=2600",
    "--dump-dom",
    url
  ], { encoding:"utf8", maxBuffer:10 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function sourceTag(dom, id) {
  return dom.match(new RegExp(`<article[^>]*data-epoch-source="${id}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function expectAttr(tag, name, expected, label, url) {
  const actual = attr(tag, name);
  if (actual !== expected) throw new Error(`${label}: expected ${name}=${expected}, got ${actual}: ${url}`);
}

const identity = dumpDom("recurrence.html?date=2026-09-13&delta=0");
const identityPanel = tagById(identity.dom, "seasonal-epoch-source-audit");
expectAttr(identityPanel, "data-ready", "true", "identity audit", identity.url);
expectAttr(identityPanel, "data-target-year", "2026", "identity audit", identity.url);
expectAttr(identityPanel, "data-audit-status", "identity-bypass", "identity audit", identity.url);
expectAttr(identityPanel, "data-seasonal-epoch-solver-required", "false", "identity audit", identity.url);
if (!identity.dom.includes("Δ=0 不需要跨 epoch source")) {
  throw new Error(`identity audit: bypass explanation missing: ${identity.url}`);
}
console.log(`[seasonal-epoch-audit] PASS identity bypass: ${identity.url}`);

const local = dumpDom("recurrence.html?date=2026-09-13&delta=1980");
const localPanel = tagById(local.dom, "seasonal-epoch-source-audit");
const localInstrument = tagById(local.dom, "recurrence-instrument");
expectAttr(localPanel, "data-target-year", "4006", "4006 audit", local.url);
expectAttr(localPanel, "data-audit-status", "qualified-ephemeris-basis-not-integrated", "4006 audit", local.url);
expectAttr(localPanel, "data-qualified-source-count", "1", "4006 audit", local.url);
expectAttr(localPanel, "data-usable-source-count", "0", "4006 audit", local.url);
expectAttr(localPanel, "data-seasonal-epoch-solver-required", "true", "4006 audit", local.url);
expectAttr(localInstrument, "data-seasonal-epoch-de441-covered", "true", "4006 audit", local.url);
expectAttr(localInstrument, "data-seasonal-epoch-de441-basis-capable", "true", "4006 audit", local.url);
expectAttr(localInstrument, "data-seasonal-epoch-qualified-source-count", "1", "4006 audit", local.url);

const localDe441 = sourceTag(local.dom, "jpl-de441");
expectAttr(localDe441, "data-covers-target", "true", "4006 DE441", local.url);
expectAttr(localDe441, "data-ephemeris-basis-capable", "true", "4006 DE441", local.url);
expectAttr(localDe441, "data-qualified-coverage", "true", "4006 DE441", local.url);
if (!local.dom.includes("absolute state ✓ · solver 尚未整合") || !local.dom.includes("crossing root solve")) {
  throw new Error(`4006 audit: state-vs-solver distinction missing: ${local.url}`);
}
console.log(`[seasonal-epoch-audit] PASS 4006 has DE441 state coverage but no integrated seasonal-epoch solver: ${local.url}`);

const global = dumpDom("recurrence.html?date=2026-09-13&delta=24000");
const panel = tagById(global.dom, "seasonal-epoch-source-audit");
const instrument = tagById(global.dom, "recurrence-instrument");
expectAttr(panel, "data-target-year", "26026", "26026 audit", global.url);
expectAttr(panel, "data-audit-status", "absolute-state-coverage-gap", "26026 audit", global.url);
expectAttr(panel, "data-blocker", "ephemeris-source-coverage", "26026 audit", global.url);
expectAttr(panel, "data-qualified-source-count", "0", "26026 audit", global.url);
expectAttr(panel, "data-usable-source-count", "0", "26026 audit", global.url);
expectAttr(panel, "data-nearest-ephemeris-boundary-year", "17191", "26026 audit", global.url);
expectAttr(panel, "data-nearest-ephemeris-gap-years", "8835", "26026 audit", global.url);
expectAttr(instrument, "data-seasonal-epoch-de441-covered", "false", "26026 audit", global.url);
expectAttr(instrument, "data-seasonal-epoch-qualified-source-count", "0", "26026 audit", global.url);
expectAttr(instrument, "data-seasonal-epoch-nearest-ephemeris-gap-years", "8835", "26026 audit", global.url);

const berger = sourceTag(global.dom, "berger-1978-shape");
const de441 = sourceTag(global.dom, "jpl-de441");
const la2004 = sourceTag(global.dom, "la2004-insolation-parameters");
expectAttr(berger, "data-covers-target", "true", "26026 Berger", global.url);
expectAttr(berger, "data-ephemeris-basis-capable", "false", "26026 Berger", global.url);
expectAttr(de441, "data-covers-target", "false", "26026 DE441", global.url);
expectAttr(de441, "data-ephemeris-basis-capable", "true", "26026 DE441", global.url);
expectAttr(la2004, "data-covers-target", "true", "26026 La2004", global.url);
expectAttr(la2004, "data-ephemeris-basis-capable", "false", "26026 La2004", global.url);
if (!global.dom.includes("absolute-state ephemeris coverage gap") || !global.dom.includes("距目標 8,835 年")) {
  throw new Error(`26026 audit: explicit coverage-gap explanation missing: ${global.url}`);
}
if (!global.dom.includes("coverage ✓ · 無 absolute state") || !global.dom.includes("超出 coverage")) {
  throw new Error(`26026 audit: source-level distinction missing: ${global.url}`);
}
console.log(`[seasonal-epoch-audit] PASS 26026 separates shape coverage from absolute-state ephemeris coverage: ${global.url}`);
