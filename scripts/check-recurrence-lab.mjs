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
  if (!dom.includes(`id="year-status">${year}<`)) {
    throw new Error(`${label}: compact Year status does not match signed gauge ${year}: ${url}`);
  }
  if (!dom.includes(`id="day-status">${day}<`)) {
    throw new Error(`${label}: compact Day status does not match signed gauge ${day}: ${url}`);
  }
  if (!dom.includes('class="recurrence-readout research-current-state"')) {
    throw new Error(`${label}: compact current-state rail is missing: ${url}`);
  }
  if (dom.includes("discrete-closure-details") || dom.includes('class="closure-grid"')) {
    throw new Error(`${label}: retired closure card/disclosure UI returned: ${url}`);
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
if (
  !global.dom.includes('data-li-chun-boundary-status="absolute-source-unavailable"') ||
  !global.dom.includes('data-li-chun-projection-status="unavailable"') ||
  !global.dom.includes('data-selected-year-membership-status="unresolved"') ||
  !global.dom.includes("超出目前 absolute seasonal-epoch source")
) {
  throw new Error(`26026 global discrete closure must remain separate from unavailable absolute Li Chun authority: ${global.url}`);
}
console.log(`[recurrence] PASS 26026 keeps exact discrete closure separate from absolute seasonal source coverage: ${global.url}`);

const sourceDerived8000 = expectCase(
  "recurrence.html?date=2026-09-13&delta=8000",
  {
    "data-target-date":"10026-09-13"
  },
  "8000-year source-derived seasonal evidence"
);
const sourceDerivedStrip = tagById(sourceDerived8000.dom, "research-year-strip");
if (
  attr(sourceDerivedStrip, "data-li-chun-boundary-status") !== "resolved-research-evidence" ||
  attr(sourceDerivedStrip, "data-li-chun-authority-class") !== "source-derived-research-evidence" ||
  attr(sourceDerivedStrip, "data-li-chun-production-authority") !== "false" ||
  attr(sourceDerivedStrip, "data-li-chun-independent-target-year-truth") !== "false" ||
  attr(sourceDerivedStrip, "data-li-chun-projection-status") !== "estimated" ||
  attr(sourceDerivedStrip, "data-li-chun-position-status") !== "estimated" ||
  attr(sourceDerivedStrip, "data-selected-year-membership-status") !== "model-estimated" ||
  !sourceDerived8000.dom.includes("DE441-derived · source-derived")
) {
  throw new Error(`10026 must expose pinned DE441-derived Research evidence without presenting it as production truth: ${sourceDerived8000.url}`);
}
if (attr(sourceDerivedStrip, "data-selected-year-pillar") === "unavailable") {
  throw new Error(`10026 September date should resolve a side outside the Li Chun uncertainty band: ${sourceDerived8000.url}`);
}
console.log(`[recurrence] PASS 10026 uses source-derived DE441 TT with explicit non-production labeling: ${sourceDerived8000.url}`);

const liChunBoundaryDay = expectCase(
  "recurrence.html?date=2024-02-04&delta=0",
  {
    "data-target-date":"2024-02-04"
  },
  "date-only Li Chun boundary"
);
if (
  !liChunBoundaryDay.dom.includes('data-selected-li-chun-relation="boundary-day"') ||
  !liChunBoundaryDay.dom.includes('data-selected-year-membership-status="unresolved"') ||
  !liChunBoundaryDay.dom.includes('id="research-year-base-title">選定日 · 立春日需時刻判定<') ||
  !liChunBoundaryDay.dom.includes('id="research-year-li-chun-title">立春 · 癸卯 → 甲辰<')
) {
  throw new Error(`date-only Li Chun selection must remain Ganzhi-year ambiguous until a target time is bound: ${liChunBoundaryDay.url}`);
}
if (
  liChunBoundaryDay.dom.includes('id="research-year-base-title">選定日 · 癸卯年<') ||
  liChunBoundaryDay.dom.includes('id="research-year-base-title">選定日 · 甲辰年<')
) {
  throw new Error(`date-only Li Chun selection incorrectly assigned a Ganzhi year: ${liChunBoundaryDay.url}`);
}
console.log(`[recurrence] PASS date-only Li Chun boundary fails closed until target time is bound: ${liChunBoundaryDay.url}`);

const liChunBefore = expectCase(
  "recurrence.html?date=2024-02-04&delta=0&targetClock=fixed-zone&targetTime=00%3A00%3A00&ut1Offset=8",
  {
    "data-target-date":"2024-02-04",
    "data-selected-target-instant-basis":"fixed-zone-from-ut1",
    "data-selected-target-instant-bound":"true"
  },
  "bound target before 2024 Li Chun"
);
if (
  !liChunBefore.dom.includes('data-selected-civil-li-chun-relation="boundary-day"') ||
  !liChunBefore.dom.includes('data-li-chun-instant-resolution="resolved"') ||
  !liChunBefore.dom.includes('data-selected-li-chun-relation="before"') ||
  !liChunBefore.dom.includes('data-selected-year-membership-status="model-estimated"') ||
  !liChunBefore.dom.includes('id="research-year-base-title">選定日 · 癸卯年 · 模型估計<')
) {
  throw new Error(`bound target before 2024 Li Chun did not resolve to 癸卯 on the shared TT basis: ${liChunBefore.url}`);
}
console.log(`[recurrence] PASS shared target instant resolves pre-Li-Chun 2024 boundary day: ${liChunBefore.url}`);

const liChunAfter = expectCase(
  "recurrence.html?date=2024-02-04&delta=0&targetClock=fixed-zone&targetTime=23%3A59%3A59&ut1Offset=8",
  {
    "data-target-date":"2024-02-04",
    "data-selected-target-instant-basis":"fixed-zone-from-ut1",
    "data-selected-target-instant-bound":"true"
  },
  "bound target after 2024 Li Chun"
);
if (
  !liChunAfter.dom.includes('data-li-chun-instant-resolution="resolved"') ||
  !liChunAfter.dom.includes('data-selected-li-chun-relation="after"') ||
  !liChunAfter.dom.includes('data-selected-year-membership-status="model-estimated"') ||
  !liChunAfter.dom.includes('id="research-year-base-title">選定日 · 甲辰年 · 模型估計<')
) {
  throw new Error(`bound target after 2024 Li Chun did not resolve to 甲辰 on the shared TT basis: ${liChunAfter.url}`);
}
console.log(`[recurrence] PASS shared target instant resolves post-Li-Chun 2024 boundary day: ${liChunAfter.url}`);

const runtimeGap = expectCase(
  "recurrence.html?date=2026-09-13&delta=400",
  {
    "data-target-date":"2426-09-13"
  },
  "2426 seasonal runtime gap"
);
if (
  !runtimeGap.dom.includes('data-li-chun-boundary-status="source-covered-runtime-missing"') ||
  !runtimeGap.dom.includes('data-li-chun-projection-status="unavailable"') ||
  !runtimeGap.dom.includes('data-li-chun-provider="none"') ||
  !runtimeGap.dom.includes('data-selected-year-membership-status="unresolved"') ||
  !runtimeGap.dom.includes('data-selected-year-pillar="unavailable"') ||
  !runtimeGap.dom.includes('id="research-year-li-chun-unavailable-title">立春 · 乙酉 → 丙戌<') ||
  !runtimeGap.dom.includes("DE441 涵蓋此年 · 節氣 epoch 尚未發布")
) {
  throw new Error(`2426 must expose the DE441 source-covered/runtime-missing gap instead of legacy Tyme civil fields: ${runtimeGap.url}`);
}
console.log(`[recurrence] PASS 2426 year strip exposes seasonal runtime gap: ${runtimeGap.url}`);

const de441Estimated = expectCase(
  "recurrence.html?date=4006-09-13&delta=0",
  {
    "data-target-date":"4006-09-13"
  },
  "4006 DE441 estimated Li Chun"
);
if (
  !de441Estimated.dom.includes('data-li-chun-boundary-status="resolved"') ||
  !de441Estimated.dom.includes('data-li-chun-provider="jpl-de441-seasonal-events-v1"') ||
  !de441Estimated.dom.includes('data-li-chun-projection-status="estimated"') ||
  !de441Estimated.dom.includes('data-li-chun-position-status="estimated"') ||
  !de441Estimated.dom.includes('data-selected-year-membership-status="model-estimated"') ||
  !de441Estimated.dom.includes('id="research-year-li-chun-label">≈ ') ||
  !de441Estimated.dom.includes("jpl-de441-seasonal-events-v1")
) {
  throw new Error(`4006 must use reviewed DE441 TT and expose only an estimated civil position: ${de441Estimated.url}`);
}
console.log(`[recurrence] PASS 4006 year strip uses DE441 + estimated civil projection: ${de441Estimated.url}`);

const gregorian = expectCase(
  "recurrence.html?date=2026-09-13&delta=400",
  {
    "data-target-date":"2426-09-13",
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
if (
  !gregorian.dom.includes('id="research-year-base-title">選定日 · 年柱待節氣判定<') ||
  !gregorian.dom.includes('id="research-year-base-label">2426/09/13<') ||
  !gregorian.dom.includes('id="research-year-li-chun-unavailable-title">立春 · 乙酉 → 丙戌<') ||
  !gregorian.dom.includes("DE441 涵蓋此年 · 節氣 epoch 尚未發布")
) {
  throw new Error(`400-year selected target must expose the seasonal authority gap instead of inventing a Ganzhi-year membership: ${gregorian.url}`);
}
expectMarker(gregorian.dom, "gregorian", "-90.000", "0", "400-year Gregorian recurrence", gregorian.url);
expectMarker(gregorian.dom, "year", "-143.333", "-20", "400-year Gregorian recurrence", gregorian.url);
expectMarker(gregorian.dom, "day", "-98.000", "-3", "400-year Gregorian recurrence", gregorian.url);
expectSignedEvidenceCopy(gregorian.dom, { year:"−20", day:"−3" }, "400-year Gregorian recurrence", gregorian.url);
if (gregorian.dom.includes('class="milestone-table"') || gregorian.dom.includes('id="milestone-rows"')) {
  throw new Error(`retired milestone detail table returned: ${gregorian.url}`);
}
console.log(`[recurrence] PASS 400-year case keeps visible signed phase provenance in one compact current-state rail: ${gregorian.url}`);
