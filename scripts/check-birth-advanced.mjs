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

function tagByAttr(dom, name, value) {
  return dom.match(new RegExp(`<[^>]+${name}="${value}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function urlAttr(tag, name) {
  const value = attr(tag, name);
  return value ? new URL(value.replaceAll("&amp;", "&")) : null;
}

function requireAtlasLink(url, { instant, inspect = null, utc = null }) {
  if (!url) throw new Error("missing Atlas cross-view URL");
  if (url.pathname !== new URL(baseURL).pathname) {
    throw new Error(`cross-view link did not target Atlas root: ${url.href}`);
  }
  if (url.searchParams.get("instant") !== instant) {
    throw new Error(`cross-view link changed physical instant: ${url.href}`);
  }
  if (url.searchParams.get("inspect") !== inspect) {
    throw new Error(`cross-view link opened wrong inspector state: ${url.href}`);
  }
  if (url.searchParams.get("utc") !== utc) {
    throw new Error(`cross-view link lost UTC context: ${url.href}`);
  }
  for (const legacy of ["lambda", "month", "yearStem"]) {
    if (url.searchParams.has(legacy)) throw new Error(`cross-view link retained legacy ${legacy}: ${url.href}`);
  }
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

for (const pillar of ["year", "month", "day", "hour"]) {
  const cell = tagByAttr(normal.dom, "data-atlas-inspect", pillar);
  requireAtlasLink(urlAttr(cell, "data-href"), {
    instant:"2005-12-23T00:37:00.000Z",
    inspect:pillar
  });
}
const normalProjection = tagByAttr(normal.dom, "data-atlas-cross-view", "selected-instant");
requireAtlasLink(urlAttr(normalProjection, "href"), {
  instant:"2005-12-23T00:37:00.000Z"
});
if (/sexagenary\.html\?ganzhi=/.test(normal.dom)) {
  throw new Error(`Birth still emits detached Sexagenary destination links: ${normal.url}`);
}
console.log(`[birth-advanced] PASS default flow is basic-first and all cross-view links preserve one Atlas instant: ${normal.url}`);

const offset = dump("birth.html?date=2024-06-20&time=08%3A00&utc=5.5");
const offsetPanel = tagById(offset.dom, "birth-advanced-controls");
if (attr(offsetPanel, "data-advanced-open") !== "false") {
  throw new Error(`ordinary UTC deep link should not force Advanced open: ${offset.url}`);
}
if (attr(offsetPanel, "data-advanced-summary") !== "UTC+05:30 · 23:00 換日") {
  throw new Error(`collapsed summary did not reflect UTC+05:30: ${offset.url}`);
}
const offsetHour = tagByAttr(offset.dom, "data-atlas-inspect", "hour");
requireAtlasLink(urlAttr(offsetHour, "data-href"), {
  instant:"2024-06-20T02:30:00.000Z",
  inspect:"hour",
  utc:"5.5"
});
const offsetProjection = tagByAttr(offset.dom, "data-atlas-cross-view", "selected-instant");
requireAtlasLink(urlAttr(offsetProjection, "href"), {
  instant:"2024-06-20T02:30:00.000Z",
  utc:"5.5"
});
console.log(`[birth-advanced] PASS UTC+05:30 deep link stays collapsed and carries exact Atlas context: ${offset.url}`);

const longitude = dump("birth.html?date=2024-06-20&time=08%3A00&utc=8&lon=121.5");
const longitudePanel = tagById(longitude.dom, "birth-advanced-controls");
const longitudeInput = tagById(longitude.dom, "birth-longitude");
if (attr(longitudePanel, "data-advanced-open") !== "true" || !longitudePanel.includes(" open")) {
  throw new Error(`longitude research context must surface Advanced: ${longitude.url}`);
}
if (!longitudeInput || attr(longitudePanel, "data-advanced-longitude") !== "121.5") {
  throw new Error(`longitude input was not preserved as live Advanced state: ${longitude.url}`);
}
console.log(`[birth-advanced] PASS longitude research context surfaces Advanced with bound coordinate: ${longitude.url}`);
