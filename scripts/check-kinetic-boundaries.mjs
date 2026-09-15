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

function attr(tag, name) {
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function tagById(dom, tagName, id) {
  const start = dom.indexOf(`<${tagName}`);
  if (start < 0) return "";
  const candidates = dom.match(new RegExp(`<${tagName}[^>]*>`, "g")) ?? [];
  return candidates.find(tag => attr(tag, "id") === id) ?? "";
}

function elementTextById(dom, id) {
  const match = new RegExp(`<[^>]+id="${id}"[^>]*>([^<]*)<`).exec(dom);
  return match?.[1]?.trim() ?? "";
}

function groupMarkup(dom, id) {
  const openTag = tagById(dom, "g", id);
  if (!openTag) return "";
  const start = dom.indexOf(openTag);
  const end = dom.indexOf("</g>", start);
  return end >= 0 ? dom.slice(start, end + 4) : "";
}

function hasClass(tag, name) {
  return (attr(tag, "class") ?? "").split(/\s+/).includes(name);
}

function firstTagWithClasses(markup, tagName, classNames) {
  const tags = markup.match(new RegExp(`<${tagName}[^>]*>`, "g")) ?? [];
  return tags.find(tag => classNames.every(name => hasClass(tag, name))) ?? "";
}

function textRecordWithClass(markup, className) {
  const matches = [...markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];
  for (const match of matches) {
    const tag = `<text${match[1]}>`;
    if (!hasClass(tag, className)) continue;
    return {
      tag,
      text: match[2].replace(/<[^>]+>/g, "").trim()
    };
  }
  return { tag:"", text:"" };
}

function shortestAngleError(actual, expected) {
  let delta = ((actual - expected) % 360 + 360) % 360;
  if (delta > 180) delta -= 360;
  return Math.abs(delta);
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

// Regression for the exact state that exposed the misleading wheel: the legend,
// active sector, dynamic read-head and shared Selected Instant datum must all
// describe one state. The read-head coordinate is allowed to move continuously
// inside the active 6-degree Ganzhi sector; it must not be forced to its centre.
const screenshotInstant = Date.parse("2026-09-13T23:43:42.000Z");
const screenshot = dumpDom(screenshotInstant);
const instrumentTag = tagById(screenshot.dom, "section", "kinetic-instrument");
const wheelTag = tagById(screenshot.dom, "svg", "kinetic-wheel");
const cursorAngle = Number(attr(wheelTag, "data-reference-cursor-angle"));
if (!Number.isFinite(cursorAngle) || attr(wheelTag, "data-reference-frame") !== "world") {
  throw new Error(`screenshot-alignment: canonical world cursor diagnostics are missing: ${screenshot.url}`);
}

const expectedCycles = [
  ["hour", "data-hour-pillar", "hour-active", "壬辰"],
  ["day", "data-day-pillar", "day-active", "辛卯"],
  ["month", "data-month-pillar", "month-active", "丁酉"],
  ["year", "data-year-pillar", "year-active", "丙午"]
];

for (const [id, instrumentAttr, readoutId, expectedLabel] of expectedCycles) {
  const groupTag = tagById(screenshot.dom, "g", `${id}-track`);
  const markup = groupMarkup(screenshot.dom, `${id}-track`);
  const activeSector = firstTagWithClasses(markup, "path", ["cycle-sector", "is-active"]);
  const readhead = textRecordWithClass(markup, "active-cycle-label");
  const activeIndex = Number(attr(activeSector, "data-cycle-index"));
  const coordinate = Number(attr(readhead.tag, "data-cycle-coordinate"));
  const renderedRotation = Number(attr(groupTag, "data-rendered-rotation"));
  const sectorLabel = attr(activeSector, "data-cycle-label");
  const readheadLabel = attr(readhead.tag, "data-cycle-label");
  const withinSector = ((coordinate - activeIndex * 6) % 360 + 360) % 360;
  const alignmentError = shortestAngleError(coordinate + renderedRotation, cursorAngle);

  if (attr(instrumentTag, instrumentAttr) !== expectedLabel ||
      elementTextById(screenshot.dom, readoutId) !== expectedLabel ||
      sectorLabel !== expectedLabel ||
      readheadLabel !== expectedLabel ||
      readhead.text !== expectedLabel) {
    throw new Error(
      `screenshot-alignment: ${id} identity disagrees ` +
      `(instrument=${attr(instrumentTag, instrumentAttr)}, legend=${elementTextById(screenshot.dom, readoutId)}, ` +
      `sector=${sectorLabel}, readhead=${readheadLabel}/${readhead.text}, expected=${expectedLabel}): ${screenshot.url}`
    );
  }
  if (!Number.isInteger(activeIndex) || !Number.isFinite(coordinate) || !Number.isFinite(renderedRotation) ||
      withinSector < -0.001 || withinSector > 6.001 || alignmentError > 0.002) {
    throw new Error(
      `screenshot-alignment: ${id} read-head is not on the Selected Instant datum ` +
      `(index=${activeIndex}, coordinate=${coordinate}, rotation=${renderedRotation}, ` +
      `cursor=${cursorAngle}, within=${withinSector}, error=${alignmentError}): ${screenshot.url}`
    );
  }
}

const longitude = Number(attr(instrumentTag, "data-solar-longitude"));
const solarGroupTag = tagById(screenshot.dom, "g", "solar-track");
const zodiacGroupTag = tagById(screenshot.dom, "g", "zodiac-track");
const solarMarkup = groupMarkup(screenshot.dom, "solar-track");
const zodiacMarkup = groupMarkup(screenshot.dom, "zodiac-track");
const activeTerm = firstTagWithClasses(solarMarkup, "path", ["term-sector", "is-active"]);
const activeZodiac = firstTagWithClasses(zodiacMarkup, "path", ["zodiac-sector", "is-active"]);
const termReadhead = textRecordWithClass(solarMarkup, "active-annual-label");
const zodiacReadhead = textRecordWithClass(zodiacMarkup, "active-annual-label");
const termReadheadCoordinate = Number(attr(termReadhead.tag, "data-annual-coordinate"));
const zodiacReadheadCoordinate = Number(attr(zodiacReadhead.tag, "data-annual-coordinate"));
const solarRotation = Number(attr(solarGroupTag, "data-rendered-rotation"));
const zodiacRotation = Number(attr(zodiacGroupTag, "data-rendered-rotation"));
const expectedTermIndex = Math.floor((((longitude % 360) + 360) % 360) / 15) % 24;
const expectedZodiacIndex = Math.floor((((longitude % 360) + 360) % 360) / 30) % 12;

if (attr(instrumentTag, "data-term") !== "白露" ||
    attr(instrumentTag, "data-zodiac") !== "處女" ||
    !elementTextById(screenshot.dom, "solar-active").includes("白露 · 處女") ||
    Number(attr(activeTerm, "data-term-index")) !== expectedTermIndex ||
    Number(attr(activeZodiac, "data-zodiac-index")) !== expectedZodiacIndex) {
  throw new Error(`screenshot-alignment: annual classifications disagree with solar longitude ${longitude}: ${screenshot.url}`);
}
if (termReadhead.text !== "白露" ||
    zodiacReadhead.text !== "處女" ||
    Number(attr(termReadhead.tag, "data-annual-index")) !== expectedTermIndex ||
    Number(attr(zodiacReadhead.tag, "data-annual-index")) !== expectedZodiacIndex ||
    attr(termReadhead.tag, "data-annual-label") !== "白露" ||
    attr(zodiacReadhead.tag, "data-annual-label") !== "處女") {
  throw new Error(
    `screenshot-alignment: annual read-head identity disagrees ` +
    `(term=${termReadhead.text}/${attr(termReadhead.tag, "data-annual-label")}, ` +
    `zodiac=${zodiacReadhead.text}/${attr(zodiacReadhead.tag, "data-annual-label")}): ${screenshot.url}`
  );
}
if (!Number.isFinite(longitude) || !Number.isFinite(solarRotation) || !Number.isFinite(zodiacRotation) ||
    !Number.isFinite(termReadheadCoordinate) || !Number.isFinite(zodiacReadheadCoordinate) ||
    shortestAngleError(longitude + solarRotation, cursorAngle) > 0.002 ||
    shortestAngleError(longitude + zodiacRotation, cursorAngle) > 0.002 ||
    shortestAngleError(termReadheadCoordinate + solarRotation, cursorAngle) > 0.002 ||
    shortestAngleError(zodiacReadheadCoordinate + zodiacRotation, cursorAngle) > 0.002 ||
    shortestAngleError(termReadheadCoordinate, longitude) > 0.002 ||
    shortestAngleError(zodiacReadheadCoordinate, longitude) > 0.002) {
  throw new Error(
    `screenshot-alignment: solar/zodiac read-head coordinate missed Selected Instant ` +
    `(longitude=${longitude}, term=${termReadheadCoordinate}, zodiac=${zodiacReadheadCoordinate}, ` +
    `solarRotation=${solarRotation}, zodiacRotation=${zodiacRotation}, cursor=${cursorAngle}): ${screenshot.url}`
  );
}
console.log(
  `[kinetic-boundary] PASS screenshot datum alignment: ` +
  `丙午 / 丁酉 / 辛卯 / 壬辰 / 白露 / 處女 @ ${new Date(screenshotInstant).toISOString()}`
);