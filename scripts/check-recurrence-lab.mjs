import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
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
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

function instrumentTag(dom) {
  return dom.match(/<section[^>]*id="recurrence-instrument"[^>]*>/)?.[0] ?? "";
}

function hasData(dom, name, value) {
  return instrumentTag(dom).includes(`${name}="${value}"`);
}

function expectCase(path, expected, label) {
  const { url, dom } = dumpDom(path);
  for (const [name, value] of Object.entries(expected)) {
    if (!hasData(dom, name, String(value))) {
      throw new Error(`${label}: expected ${name}=${value}: ${url}`);
    }
  }
  return { url, dom };
}

function hasReturnMarker(dom, key, angle) {
  const pattern = new RegExp(`data-return-marker="${key}"[^>]*data-return-angle="${angle.replace(".", "\\.")}"`);
  return pattern.test(dom);
}

const local = expectCase(
  "recurrence.html?date=2026-09-13&delta=1980",
  {
    "data-query-preset": "1",
    "data-base-date": "2026-09-13",
    "data-delta-years": "1980",
    "data-local-year-day-recurrence": "1980",
    "data-gregorian-phase": "380",
    "data-year-phase": "0",
    "data-day-phase": "0",
    "data-gregorian-closed": "false",
    "data-year-closed": "true",
    "data-day-closed": "true",
    "data-global-closed": "false"
  },
  "1980-year local recurrence"
);
if (!/此起點年＋日首次重遇/.test(local.dom) || !/1,980 年/.test(local.dom)) {
  throw new Error(`1980-year local recurrence explanation missing: ${local.url}`);
}
if (!hasReturnMarker(local.dom, "gregorian", "-72.000") ||
    !hasReturnMarker(local.dom, "year", "-90.000") ||
    !hasReturnMarker(local.dom, "day", "-90.000")) {
  throw new Error(`1980-year return markers do not show Gregorian offset vs aligned Year/Day: ${local.url}`);
}
console.log(`[recurrence] PASS local Year+Day recurrence + radial offset markers: ${local.url}`);

const global = expectCase(
  "recurrence.html?date=2026-09-13&delta=24000",
  {
    "data-query-preset": "1",
    "data-base-date": "2026-09-13",
    "data-delta-years": "24000",
    "data-gregorian-phase": "0",
    "data-year-phase": "0",
    "data-day-phase": "0",
    "data-gregorian-closed": "true",
    "data-year-closed": "true",
    "data-day-closed": "true",
    "data-global-closed": "true"
  },
  "24000-year global recurrence"
);
if (!/三層全域閉合/.test(global.dom) || !/26026-09-13/.test(global.dom)) {
  throw new Error(`24000-year global closure explanation missing: ${global.url}`);
}
if (!["gregorian", "year", "day"].every(key => hasReturnMarker(global.dom, key, "-90.000"))) {
  throw new Error(`24000-year return markers are not all aligned to the reference cursor: ${global.url}`);
}
console.log(`[recurrence] PASS global Gregorian+Year+Day closure + radial alignment: ${global.url}`);

const gregorian = expectCase(
  "recurrence.html?date=2026-09-13&delta=400",
  {
    "data-gregorian-phase": "0",
    "data-year-phase": "40",
    "data-day-phase": "57",
    "data-gregorian-closed": "true",
    "data-year-closed": "false",
    "data-day-closed": "false",
    "data-global-closed": "false"
  },
  "400-year Gregorian recurrence"
);
if (!/公曆閏年骨架回原位/.test(gregorian.dom)) {
  throw new Error(`400-year Gregorian-only explanation missing: ${gregorian.url}`);
}
console.log(`[recurrence] PASS Gregorian-only 400-year phase: ${gregorian.url}`);
