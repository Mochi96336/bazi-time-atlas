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
  const browser = findBrowser();
  const url = new URL(path, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=1400",
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

function instrumentTag(dom) {
  return tagById(dom, "recurrence-instrument");
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function hasData(dom, name, value) {
  return instrumentTag(dom).includes(`${name}="${value}"`);
}

function expectCase(path, expected, label) {
  const { url, dom } = dumpDom(path);
  for (const [name, value] of Object.entries(expected)) {
    if (!hasData(dom, name, String(value))) throw new Error(`${label}: expected ${name}=${value}: ${url}`);
  }
  return { url, dom };
}

function markerTag(dom, key) {
  return dom.match(new RegExp(`<line[^>]*data-return-marker="${key}"[^>]*>`))?.[0] ?? "";
}

function expectMarker(dom, key, angle, signed, label, url) {
  const tag = markerTag(dom, key);
  if (!tag) throw new Error(`${label}: ${key} marker missing: ${url}`);
  if (attr(tag, "data-return-angle") !== angle) {
    throw new Error(`${label}: ${key} expected angle ${angle}, got ${attr(tag, "data-return-angle")}: ${url}`);
  }
  if (attr(tag, "data-phase-signed") !== signed) {
    throw new Error(`${label}: ${key} expected signed ${signed}, got ${attr(tag, "data-phase-signed")}: ${url}`);
  }
}

function expectFixedGauge(dom, url) {
  const instrument = instrumentTag(dom);
  if (attr(instrument, "data-phase-geometry") !== "signed-shortest-fan") {
    throw new Error(`recurrence instrument is not using signed-shortest fan geometry: ${url}`);
  }
  if (attr(instrument, "data-phase-radial-order") !== "day,year,gregorian,astronomy") {
    throw new Error(`recurrence radial scale order is wrong: ${url}`);
  }
  if (attr(instrument, "data-phase-display") !== "signed-shortest") {
    throw new Error(`recurrence visible phase copy is not signed-shortest: ${url}`);
  }
  for (const id of ["day-ring", "year-ring", "gregorian-ring"]) {
    const tag = tagById(dom, id);
    if (attr(tag, "data-phase-geometry") !== "signed-shortest-fan") {
      throw new Error(`${id} missing fixed fan gauge semantics: ${url}`);
    }
    if (/\stransform=/.test(tag)) throw new Error(`${id} must not rotate to hide its phase error: ${url}`);
  }
}

function expectVisibleSignedCopy(dom, { year, day }, label, url) {
  if (!dom.includes(`id="year-status">偏移 ${year}<`)) {
    throw new Error(`${label}: visible Year status does not match signed gauge ${year}: ${url}`);
  }
  if (!dom.includes(`id="day-status">偏移 ${day}<`)) {
    throw new Error(`${label}: visible Day status does not match signed gauge ${day}: ${url}`);
  }
  if (!dom.includes(`40 / 60 · 最短 ${year}`) || !dom.includes(`57 / 60 · 最短 ${day}`)) {
    throw new Error(`${label}: raw/signed legend provenance is inconsistent: ${url}`);
  }
}

const local = expectCase(
  "recurrence.html?date=2026-09-13&delta=1980",
  {
    "data-query-preset":"1",
    "data-base-date":"2026-09-13",
    "data-delta-years":"1980",
    "data-local-year-day-recurrence":"1980",
    "data-gregorian-phase":"380",
    "data-gregorian-phase-signed":"-20",
    "data-year-phase":"0",
    "data-year-phase-signed":"0",
    "data-day-phase":"0",
    "data-day-phase-signed":"0",
    "data-gregorian-closed":"false",
    "data-year-closed":"true",
    "data-day-closed":"true",
    "data-global-closed":"false"
  },
  "1980-year local recurrence"
);
expectFixedGauge(local.dom, local.url);
if (!/此起點年＋日首次重遇/.test(local.dom) || !/1,980 年/.test(local.dom)) {
  throw new Error(`1980-year local recurrence explanation missing: ${local.url}`);
}
expectMarker(local.dom, "gregorian", "-98.000", "-20", "1980-year local recurrence", local.url);
expectMarker(local.dom, "year", "-90.000", "0", "1980-year local recurrence", local.url);
expectMarker(local.dom, "day", "-90.000", "0", "1980-year local recurrence", local.url);
console.log(`[recurrence] PASS local Year+Day recurrence + fixed signed phase gauges: ${local.url}`);

const global = expectCase(
  "recurrence.html?date=2026-09-13&delta=24000",
  {
    "data-query-preset":"1",
    "data-base-date":"2026-09-13",
    "data-delta-years":"24000",
    "data-gregorian-phase":"0",
    "data-gregorian-phase-signed":"0",
    "data-year-phase":"0",
    "data-year-phase-signed":"0",
    "data-day-phase":"0",
    "data-day-phase-signed":"0",
    "data-gregorian-closed":"true",
    "data-year-closed":"true",
    "data-day-closed":"true",
    "data-global-closed":"true"
  },
  "24000-year global recurrence"
);
expectFixedGauge(global.dom, global.url);
if (!/三層全域閉合/.test(global.dom) || !/26026-09-13/.test(global.dom)) {
  throw new Error(`24000-year global closure explanation missing: ${global.url}`);
}
for (const key of ["gregorian", "year", "day"]) expectMarker(global.dom, key, "-90.000", "0", "24000-year global recurrence", global.url);
console.log(`[recurrence] PASS global closure stacks every discrete marker on the same reference: ${global.url}`);

const gregorian = expectCase(
  "recurrence.html?date=2026-09-13&delta=400",
  {
    "data-gregorian-phase":"0",
    "data-gregorian-phase-signed":"0",
    "data-year-phase":"40",
    "data-year-phase-signed":"-20",
    "data-day-phase":"57",
    "data-day-phase-signed":"-3",
    "data-gregorian-closed":"true",
    "data-year-closed":"false",
    "data-day-closed":"false",
    "data-global-closed":"false"
  },
  "400-year Gregorian recurrence"
);
expectFixedGauge(gregorian.dom, gregorian.url);
if (!/公曆閏年骨架回原位/.test(gregorian.dom)) {
  throw new Error(`400-year Gregorian-only explanation missing: ${gregorian.url}`);
}
expectMarker(gregorian.dom, "gregorian", "-90.000", "0", "400-year Gregorian recurrence", gregorian.url);
expectMarker(gregorian.dom, "year", "-143.333", "-20", "400-year Gregorian recurrence", gregorian.url);
expectMarker(gregorian.dom, "day", "-98.000", "-3", "400-year Gregorian recurrence", gregorian.url);
expectVisibleSignedCopy(gregorian.dom, { year:"−20", day:"−3" }, "400-year Gregorian recurrence", gregorian.url);
if (!/data-phase-raw="40" data-phase-signed="-20" data-phase-modulus="60">−20<\/span>/.test(gregorian.dom) ||
    !/data-phase-raw="57" data-phase-signed="-3" data-phase-modulus="60">−3<\/span>/.test(gregorian.dom)) {
  throw new Error(`400-year milestone rows do not use signed shortest phase copy: ${gregorian.url}`);
}
console.log(`[recurrence] PASS 400-year case keeps Gregorian closed while Year/Day signed offsets stay visible and text-consistent: ${gregorian.url}`);
