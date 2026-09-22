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

function expectSignedEvidenceCopy(dom, { year, day }, label, url) {
  if (!dom.includes(`40 / 60 · 最短 ${year}`) || !dom.includes(`57 / 60 · 最短 ${day}`)) {
    throw new Error(`${label}: visible raw/signed legend provenance is inconsistent: ${url}`);
  }
  if (!dom.includes(`id="year-status">偏移 ${year}<`)) {
    throw new Error(`${label}: disclosed Year status does not match signed gauge ${year}: ${url}`);
  }
  if (!dom.includes(`id="day-status">偏移 ${day}<`)) {
    throw new Error(`${label}: disclosed Day status does not match signed gauge ${day}: ${url}`);
  }

  const details = tagById(dom, "discrete-closure-details");
  if (!details) throw new Error(`${label}: closure disclosure is missing: ${url}`);
  if (/\sopen(?:\s|=|>)/.test(details)) throw new Error(`${label}: closure disclosure must be closed by default: ${url}`);
  if (!dom.includes("research-local-recurrence-rail")) {
    throw new Error(`${label}: local Year+Day recurrence must remain visible outside the disclosure: ${url}`);
  }
}

function expectDiscreteComprehension(dom, url) {
  if (!dom.includes('class="phase-gauge-caption"') || !dom.includes("0 = 閉合 · 左右為距 0 的最短循環位移")) {
    throw new Error(`phase gauge does not explain its zero / signed-shortest semantics: ${url}`);
  }
  if (!dom.includes(">閉合 · 0</text>")) {
    throw new Error(`phase gauge zero reference is not labeled as closure: ${url}`);
  }
  for (const delta of ["400", "1200", "8000", "24000"]) {
    if (!new RegExp(`class="discrete-derivation-step[^"]*"[^>]*data-delta-years="${delta}"`).test(dom)) {
      throw new Error(`visible discrete derivation is missing +${delta}: ${url}`);
    }
  }
  if (!dom.includes("400 年＝146,097 日；公曆結構先回到 0")) {
    throw new Error(`400-year Gregorian/day bridge is not visible: ${url}`);
  }
  if (!dom.includes("三個離散相位同時歸零，只建立四柱重現候選")) {
    throw new Error(`discrete result is overclaiming beyond candidate closure: ${url}`);
  }
}

function expectConsolidatedGlobalPeriod(dom, url) {
  const preset = dom.match(/<button[^>]*data-delta-years="24000"[^>]*>[^<]*<\/button>/)?.[0] ?? "";
  if (!preset.includes(">全域 24,000</button>")) {
    throw new Error(`24000-year preset does not own the global-period label: ${url}`);
  }
  if (!preset.includes('aria-label="三個離散相位同時歸零 24,000 年"')) {
    throw new Error(`24000-year preset is missing global-closure aria semantics: ${url}`);
  }
  if (!preset.includes('data-research-global-period-preset="1"')) {
    throw new Error(`24000-year preset is missing presentation ownership marker: ${url}`);
  }
  if (/class="global-period"/.test(dom)) {
    throw new Error(`duplicate static global-period readout is still rendered: ${url}`);
  }
  const dock = dom.match(/<section[^>]*class="[^"]*delta-dock[^"]*"[^>]*>/)?.[0] ?? "";
  if (!dock.includes("research-delta-consolidated")) {
    throw new Error(`delta dock did not reclaim the removed global-period column: ${url}`);
  }
}

const local = expectCase(
  "recurrence.html?date=2026-09-13&delta=1980",
  {
    "data-query-preset":"1",
    "data-base-date":"2026-09-13",
    "data-delta-years":"1980",
    "data-local-year-sequence-day-recurrence":"1980",
    "data-gregorian-phase":"380",
    "data-gregorian-phase-signed":"-20",
    "data-year-sequence-phase":"0",
    "data-year-sequence-phase-signed":"0",
    "data-day-phase":"0",
    "data-day-phase-signed":"0",
    "data-gregorian-closed":"false",
    "data-year-sequence-closed":"true",
    "data-day-closed":"true",
    "data-global-closed":"false"
  },
  "1980-year local recurrence"
);
expectFixedGauge(local.dom, local.url);
expectDiscreteComprehension(local.dom, local.url);
if (!/此起點 60 年序＋60 日序首次重遇/.test(local.dom) || !/1,980 年/.test(local.dom)) {
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
    "data-year-sequence-phase":"0",
    "data-year-sequence-phase-signed":"0",
    "data-day-phase":"0",
    "data-day-phase-signed":"0",
    "data-gregorian-closed":"true",
    "data-year-sequence-closed":"true",
    "data-day-closed":"true",
    "data-global-closed":"true"
  },
  "24000-year global recurrence"
);
expectFixedGauge(global.dom, global.url);
expectDiscreteComprehension(global.dom, global.url);
expectConsolidatedGlobalPeriod(global.dom, global.url);
if (!/三個離散相位同時歸零/.test(global.dom) || !/26026-09-13/.test(global.dom)) {
  throw new Error(`24000-year global closure explanation missing: ${global.url}`);
}
for (const key of ["gregorian", "year", "day"]) expectMarker(global.dom, key, "-90.000", "0", "24000-year global recurrence", global.url);
console.log(`[recurrence] PASS global closure stacks every discrete marker on the same reference and owns one labeled preset: ${global.url}`);

const gregorian = expectCase(
  "recurrence.html?date=2026-09-13&delta=400",
  {
    "data-gregorian-phase":"0",
    "data-gregorian-phase-signed":"0",
    "data-year-sequence-phase":"40",
    "data-year-sequence-phase-signed":"-20",
    "data-day-phase":"57",
    "data-day-phase-signed":"-3",
    "data-gregorian-closed":"true",
    "data-year-sequence-closed":"false",
    "data-day-closed":"false",
    "data-global-closed":"false"
  },
  "400-year Gregorian recurrence"
);
expectFixedGauge(gregorian.dom, gregorian.url);
expectDiscreteComprehension(gregorian.dom, gregorian.url);
if (!/公曆結構回原位/.test(gregorian.dom)) {
  throw new Error(`400-year Gregorian-only explanation missing: ${gregorian.url}`);
}
expectMarker(gregorian.dom, "gregorian", "-90.000", "0", "400-year Gregorian recurrence", gregorian.url);
expectMarker(gregorian.dom, "year", "-143.333", "-20", "400-year Gregorian recurrence", gregorian.url);
expectMarker(gregorian.dom, "day", "-98.000", "-3", "400-year Gregorian recurrence", gregorian.url);
expectSignedEvidenceCopy(gregorian.dom, { year:"−20", day:"−3" }, "400-year Gregorian recurrence", gregorian.url);
if (!/data-phase-raw="40" data-phase-signed="-20" data-phase-modulus="60">−20<\/span>/.test(gregorian.dom) ||
    !/data-phase-raw="57" data-phase-signed="-3" data-phase-modulus="60">−3<\/span>/.test(gregorian.dom)) {
  throw new Error(`400-year milestone rows do not use signed shortest phase copy: ${gregorian.url}`);
}
console.log(`[recurrence] PASS 400-year case keeps visible signed phase provenance while closure interpretation stays disclosed: ${gregorian.url}`);
