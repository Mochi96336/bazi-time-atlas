import { spawnSync } from "node:child_process";
import { SolarTerm } from "tyme4ts";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const HOUR_MS = 3_600_000;
const REFERENCE_OFFSET = 8;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function solarTermInstantMs(year, name) {
  const time = SolarTerm.fromName(year, name).getJulianDay().getSolarTime();
  const date = new Date(0);
  date.setUTCFullYear(time.getYear(), time.getMonth() - 1, time.getDay());
  date.setUTCHours(time.getHour(), time.getMinute(), time.getSecond(), 0);
  return date.getTime() - REFERENCE_OFFSET * HOUR_MS;
}

function dumpDom(instantMs) {
  const browser = findBrowser();
  const url = new URL(`?instant=${encodeURIComponent(new Date(instantMs).toISOString())}`, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=1600",
    "--dump-dom",
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

function instrumentHas(dom, name, value) {
  const tag = dom.match(/<section[^>]*id="kinetic-instrument"[^>]*>/)?.[0] ?? "";
  return tag.includes(`${name}="${value}"`);
}

const liChun = solarTermInstantMs(2024, "立春");
const liBefore = dumpDom(liChun - 1_000);
const liAfter = dumpDom(liChun + 1_000);

if (!instrumentHas(liBefore.dom, "data-year-pillar", "癸卯") ||
    !instrumentHas(liBefore.dom, "data-next-jie", "立春") ||
    !/data-boundary-name="立春"/.test(liBefore.dom)) {
  throw new Error(`Li Chun -1s did not expose the expected exact boundary state: ${liBefore.url}`);
}
if (!instrumentHas(liAfter.dom, "data-year-pillar", "甲辰") ||
    !instrumentHas(liAfter.dom, "data-previous-jie", "立春")) {
  throw new Error(`Li Chun +1s did not flip the year pillar at the exact boundary: ${liAfter.url}`);
}
console.log(`[kinetic-boundary] PASS Li Chun exact year flip: ${new Date(liChun).toISOString()}`);

const jingZhe = solarTermInstantMs(2024, "惊蛰");
const jingBefore = dumpDom(jingZhe - 1_000);
const jingAfter = dumpDom(jingZhe + 1_000);

if (!instrumentHas(jingBefore.dom, "data-month-pillar", "丙寅") ||
    !instrumentHas(jingBefore.dom, "data-next-jie", "驚蟄")) {
  throw new Error(`Jing Zhe -1s did not expose the expected month state: ${jingBefore.url}`);
}
if (!instrumentHas(jingAfter.dom, "data-month-pillar", "丁卯") ||
    !instrumentHas(jingAfter.dom, "data-previous-jie", "驚蟄")) {
  throw new Error(`Jing Zhe +1s did not flip the month pillar at the exact boundary: ${jingAfter.url}`);
}
console.log(`[kinetic-boundary] PASS Jing Zhe exact month flip: ${new Date(jingZhe).toISOString()}`);
