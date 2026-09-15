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

function dump(path) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=2500", "--window-size=390,844", "--dump-dom", url
  ], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });
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

const normal = dump("birth.html");
const normalPanel = tagById(normal.dom, "birth-advanced-controls");
if (attr(normalPanel, "data-advanced-open") !== "false") {
  throw new Error(`default Birth must keep conventions collapsed: ${normal.url}`);
}
if (attr(normalPanel, "data-advanced-summary") !== "UTC+08:00 · 23:00 換日") {
  throw new Error(`default Birth must expose its active convention in the collapsed summary: ${normal.url}`);
}
if (normalPanel.includes(" open")) throw new Error(`default Birth advanced panel unexpectedly open: ${normal.url}`);
console.log(`[birth-advanced] PASS default flow is basic-first with visible convention summary: ${normal.url}`);

const offset = dump("birth.html?date=2024-06-20&time=08%3A00&utc=5.5");
const offsetPanel = tagById(offset.dom, "birth-advanced-controls");
if (attr(offsetPanel, "data-advanced-open") !== "false") {
  throw new Error(`ordinary UTC deep link should not force Advanced open: ${offset.url}`);
}
if (attr(offsetPanel, "data-advanced-summary") !== "UTC+05:30 · 23:00 換日") {
  throw new Error(`collapsed summary did not reflect UTC+05:30: ${offset.url}`);
}
console.log(`[birth-advanced] PASS ordinary UTC deep link stays collapsed but explicit: ${offset.url}`);

const longitude = dump("birth.html?date=2024-06-20&time=08%3A00&utc=8&lon=121.5");
const longitudePanel = tagById(longitude.dom, "birth-advanced-controls");
const longitudeInput = tagById(longitude.dom, "birth-longitude");
if (attr(longitudePanel, "data-advanced-open") !== "true" || !longitudePanel.includes(" open")) {
  throw new Error(`longitude research context must surface Advanced: ${longitude.url}`);
}
if (attr(longitudeInput, "value") !== "121.5") {
  throw new Error(`longitude input was not preserved inside Advanced: ${longitude.url}`);
}
console.log(`[birth-advanced] PASS longitude research context surfaces Advanced with bound coordinate: ${longitude.url}`);
