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

function dump(width, height) {
  const url = new URL("?instant=2027-03-15T13%3A20%3A09.000Z", baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=2600",
    `--window-size=${width},${height}`,
    "--dump-dom",
    url
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

const desktop = dump(1440, 900);
const instrument = tagById(desktop.dom, "kinetic-instrument");
if (attr(instrument, "data-master-geometry") !== "shared-fan" || attr(instrument, "data-fan-clip") !== "active") {
  throw new Error(`desktop: shared master fan clip was not installed: ${desktop.url}`);
}
if (!desktop.dom.includes('id="kinetic-master-fan-clip"') || !desktop.dom.includes('id="kinetic-fan-layer"')) {
  throw new Error(`desktop: fan clip/wrapper missing from SVG DOM: ${desktop.url}`);
}
for (const id of ["year-track", "month-track", "day-track", "solar-track", "zodiac-track"]) {
  const tag = tagById(desktop.dom, id);
  if (attr(tag, "data-fan-clipped") !== "true") {
    throw new Error(`desktop: ${id} is not under the shared fan guard: ${desktop.url}`);
  }
}
console.log(`[kinetic-composition] PASS desktop shared fan geometry: ${desktop.url}`);

const mobile = dump(390, 844);
const mobileInstrument = tagById(mobile.dom, "kinetic-instrument");
const fit = attr(mobileInstrument, "data-mobile-viewport-fit");
const hidden = attr(mobileInstrument, "data-mobile-secondary-hidden");
const share = Number(attr(mobileInstrument, "data-mobile-instrument-share"));
const scrollHeight = Number(attr(mobileInstrument, "data-mobile-scroll-height"));
const viewportHeight = Number(attr(mobileInstrument, "data-mobile-viewport-height"));
if (fit !== "true") throw new Error(`mobile: page still scrolls (${scrollHeight} > ${viewportHeight}): ${mobile.url}`);
if (hidden !== "true") throw new Error(`mobile: secondary dashboard sections were not collapsed: ${mobile.url}`);
if (!Number.isFinite(share) || share < 0.70) {
  throw new Error(`mobile: instrument occupies too little of first viewport (${share}): ${mobile.url}`);
}
if (attr(mobileInstrument, "data-fan-clip") !== "active") {
  throw new Error(`mobile: fan clip inactive: ${mobile.url}`);
}
console.log(`[kinetic-composition] PASS mobile first viewport; instrument share=${share}, scroll=${scrollHeight}/${viewportHeight}: ${mobile.url}`);
