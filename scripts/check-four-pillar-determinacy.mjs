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

const zero = expectState(0, {
  "data-four-pillar-year-status":"identical-by-definition",
  "data-four-pillar-month-status":"identical-by-definition",
  "data-four-pillar-day-status":"identical-by-definition",
  "data-four-pillar-hour-status":"identical-by-definition",
  "data-four-pillar-resolved-count":"4"
}, "zero identity");
if (!zero.dom.includes("同一比較狀態 · 4 / 4 相同")) {
  throw new Error(`zero identity: identity scope copy missing: ${zero.url}`);
}
console.log(`[four-pillar] PASS zero identity: ${zero.url}`);

const gregorianOnly = expectState(400, {
  "data-gregorian-closed":"true",
  "data-year-closed":"false",
  "data-four-pillar-year-status":"mixed-with-year-sequence",
  "data-four-pillar-month-status":"branch-resolved-stem-mixed",
  "data-four-pillar-day-status":"not-resolved-by-shape-model",
  "data-four-pillar-hour-status":"not-resolved-by-shape-model",
  "data-four-pillar-resolved-count":"0"
}, "400-year Gregorian closure");
if (attr(pillarTag(gregorianOnly.dom, "month"), "data-resolved") !== "false" || !gregorianOnly.dom.includes("月支可判 · 月干混合")) {
  throw new Error(`400-year Gregorian closure: mixed month determinacy not rendered: ${gregorianOnly.url}`);
}
console.log(`[four-pillar] PASS 400-year mixed year/month attribution: ${gregorianOnly.url}`);

const local = expectState(1980, {
  "data-year-closed":"true",
  "data-day-closed":"true",
  "data-four-pillar-year-status":"boundary-resolved",
  "data-four-pillar-month-status":"boundary-resolved",
  "data-four-pillar-day-status":"not-resolved-by-shape-model",
  "data-four-pillar-hour-status":"not-resolved-by-shape-model",
  "data-four-pillar-resolved-count":"2",
  "data-four-pillar-absolute-civil-phase-preserved":"false",
  "data-four-pillar-local-clock-modeled":"false"
}, "1980-year local recurrence");
const localDay = pillarTag(local.dom, "day");
if (attr(localDay, "data-discrete-phase-closed") !== "true" || !local.dom.includes("離散日序雖回到 0，但交節窗口內的民用日相位未被此模型保留")) {
  throw new Error(`1980-year local recurrence: closed-day guard missing: ${local.url}`);
}
console.log(`[four-pillar] PASS 1980-year closed-day guard: ${local.url}`);

const global = expectState(24000, {
  "data-global-closed":"true",
  "data-year-closed":"true",
  "data-day-closed":"true",
  "data-four-pillar-year-status":"boundary-resolved",
  "data-four-pillar-month-status":"boundary-resolved",
  "data-four-pillar-day-status":"not-resolved-by-shape-model",
  "data-four-pillar-hour-status":"not-resolved-by-shape-model",
  "data-four-pillar-resolved-count":"2",
  "data-four-pillar-absolute-civil-phase-preserved":"false",
  "data-four-pillar-local-clock-modeled":"false"
}, "24000-year exact discrete closure");
if (!global.dom.includes("年柱＋月柱可隔離 · 日柱＋時柱未解")) {
  throw new Error(`24000-year exact discrete closure: strongest-claim summary missing: ${global.url}`);
}
if (!global.dom.includes("即使內圈日序顯示 0/60，也不能把它直接升格成此交節窗口內的日柱結論")) {
  throw new Error(`24000-year exact discrete closure: anti-overclaim footnote missing: ${global.url}`);
}
console.log(`[four-pillar] PASS 24000-year exact closure does not overclaim Day/Hour: ${global.url}`);
