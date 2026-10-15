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
    "--virtual-time-budget=2400",
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

function pillarTag(dom, pillar) {
  return dom.match(new RegExp(`<article[^>]*data-determinacy-pillar="${pillar}"[^>]*>`))?.[0] ?? "";
}

const fixedShapeExpected = {
  "data-four-pillar-year-status":"boundary-resolved",
  "data-four-pillar-month-status":"boundary-resolved",
  "data-four-pillar-day-status":"not-resolved-by-shape-model",
  "data-four-pillar-hour-status":"not-resolved-by-shape-model",
  "data-four-pillar-resolved-count":"2",
  "data-four-pillar-absolute-civil-phase-preserved":"false",
  "data-four-pillar-local-clock-modeled":"false"
};

for (const delta of [0,400,1980,24000]) {
  const fixed = expectState(delta, fixedShapeExpected, `fixed +24k shape-only @ explorer Δ=${delta}`);
  if (attr(fixed.panel, "data-argument-delta-years") !== "24000") {
    throw new Error(`shape-only panel escaped the fixed +24k argument at explorer Δ=${delta}: ${fixed.url}`);
  }
  if (attr(fixed.panel, "data-explorer-delta-years") !== String(delta)) {
    throw new Error(`shape-only panel lost explorer provenance at Δ=${delta}: ${fixed.url}`);
  }
  if (!fixed.dom.includes("shape-only：年／月交界可隔離")) {
    throw new Error(`fixed +24k shape-only summary missing at explorer Δ=${delta}: ${fixed.url}`);
  }
  if (fixed.dom.includes("同一比較狀態 · 4 / 4 相同")) {
    throw new Error(`explorer identity leaked into fixed +24k Research evidence at Δ=${delta}: ${fixed.url}`);
  }
}

const global = expectState(24000, {
  ...fixedShapeExpected,
  "data-global-closed":"true",
  "data-year-sequence-closed":"true",
  "data-day-closed":"true"
}, "24000-year exact discrete closure");
if (!global.dom.includes("+24,000 的 TT/Gregorian reference 節界結果以上方主結果為準")) {
  throw new Error(`24000-year exact discrete closure: TT-reference handoff guard missing: ${global.url}`);
}
if (!global.dom.includes("不能直接升格成未來 civil-time 四柱")) {
  throw new Error(`24000-year exact discrete closure: civil-time claim guard missing: ${global.url}`);
}
if (!global.dom.includes("即使內圈日序顯示 0/60，也不能把它直接升格成此交節窗口內的日柱結論")) {
  throw new Error(`24000-year exact discrete closure: anti-overclaim footnote missing: ${global.url}`);
}
console.log(`[four-pillar] PASS fixed +24k shape-only evidence is independent of explorer Δ and does not overclaim Day/Hour: ${global.url}`);
