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
    "--virtual-time-budget=3000",
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

function expectState(delta, exact, label) {
  const result = dumpDom(`recurrence.html?date=2026-09-13&delta=${delta}`);
  const instrument = tagById(result.dom, "recurrence-instrument");
  const panel = tagById(result.dom, "four-pillar-determinacy");
  if (attr(panel, "data-ready") !== "true") {
    throw new Error(`${label}: determinacy panel did not settle: ${result.url}`);
  }
  for (const [name, expected] of Object.entries(exact)) {
    const actual = attr(instrument, name);
    if (actual !== String(expected)) {
      throw new Error(`${label}: expected ${name}=${expected}, got ${actual}: ${result.url}`);
    }
  }
  return { ...result, instrument, panel };
}

const fixedSeasonalExpected = {
  "data-four-pillar-year-status":"research-resolved",
  "data-four-pillar-month-status":"research-resolved",
  "data-four-pillar-day-status":"unresolved",
  "data-four-pillar-hour-status":"unresolved",
  "data-four-pillar-resolved-count":"2",
  "data-four-pillar-absolute-civil-phase-preserved":"false",
  "data-four-pillar-local-clock-modeled":"false"
};

for (const delta of [0,400,1980,24000]) {
  const fixed = expectState(delta, fixedSeasonalExpected, `fixed +24k selected crossing @ explorer Δ=${delta}`);
  if (attr(fixed.panel, "data-mode") !== "shared-seasonal") {
    throw new Error(`03 stopped reading the shared seasonal state at explorer Δ=${delta}: ${fixed.url}`);
  }
  if (attr(fixed.panel, "data-argument-delta-years") !== "24000") {
    throw new Error(`03 escaped the fixed +24k argument at explorer Δ=${delta}: ${fixed.url}`);
  }
  if (attr(fixed.panel, "data-explorer-delta-years") !== String(delta)) {
    throw new Error(`03 lost explorer provenance at Δ=${delta}: ${fixed.url}`);
  }
  if (attr(fixed.panel, "data-selected-longitude") !== "315") {
    throw new Error(`03 did not initialize from the default Li Chun crossing at Δ=${delta}: ${fixed.url}`);
  }
  for (const expected of [
    "年／月可回同柱 · 日／時未能判定",
    "立春 · 315°",
    "24,000 年不是完整「時間 → 八字」映射的精確週期"
  ]) {
    if (!fixed.dom.includes(expected)) {
      throw new Error(`fixed +24k selected-crossing conclusion missing "${expected}" at Δ=${delta}: ${fixed.url}`);
    }
  }
  if (fixed.dom.includes("同一比較狀態 · 4 / 4 相同")) {
    throw new Error(`explorer identity leaked into fixed +24k Research evidence at Δ=${delta}: ${fixed.url}`);
  }
  if (fixed.dom.includes("shape-only 輔助判定")) {
    throw new Error(`retired shape-only primary result returned at Δ=${delta}: ${fixed.url}`);
  }
}

const global = expectState(24000, {
  ...fixedSeasonalExpected,
  "data-global-closed":"true",
  "data-year-sequence-closed":"true",
  "data-day-closed":"true"
}, "24000-year exact discrete closure");

for (const expected of [
  "同一太陽位置的年／月柱可重現",
  "相隔固定 24,000 年的所有時間都回到同一八字",
  "日／時仍不能由帶不確定性的深時間 UT1／地方鐘面唯一決定"
]) {
  if (!global.dom.includes(expected)) {
    throw new Error(`24000-year conclusion lost guard "${expected}": ${global.url}`);
  }
}

console.log(`[four-pillar] PASS fixed +24k selected seasonal state resolves Year/Month, withholds Day/Hour, and stays independent of explorer Δ: ${global.url}`);
