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

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function dump() {
  const url = new URL("scripts/fixtures/view-shells.html", baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=6500",
    "--window-size=1700,2200",
    "--dump-dom",
    url
  ], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`cross-view shell probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function requireEqual(actual, expected, message, url) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}: ${url}`);
}

function looksDarkOrTranslucent(token) {
  if (!token || token === "missing") return false;
  const [backgroundColor, backgroundImage] = token.split("|");
  if (backgroundImage && backgroundImage !== "none") return true;
  const rgba = backgroundColor?.match(/rgba?\(([^)]+)\)/);
  if (!rgba) return false;
  const values = rgba[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  const [r, g, b, a = 1] = values;
  if (![r, g, b, a].every(Number.isFinite)) return false;
  if (a < 0.2) return true;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 130;
}

const { url, dom } = dump();
const probe = tagById(dom, "probe");
if (!probe || attr(probe, "data-ready") !== "true") {
  throw new Error(`cross-view shell fixture did not settle: ${url}`);
}

const expectedNav = "時間圖譜|研究";
const navIds = ["atlasmobile", "recurrencemobile", "birthmobile", "sexagenarymobile", "sexagenarydesktop"];
for (const id of navIds) {
  requireEqual(attr(probe, `data-${id}-nav`), expectedNav, `${id} navigation drifted`, url);
  requireEqual(attr(probe, `data-${id}-research-count`), "1", `${id} must expose one research destination`, url);
  requireEqual(attr(probe, `data-${id}-research-last`), "true", `${id} research destination must remain last`, url);
  requireEqual(attr(probe, `data-${id}-research-class`), "true", `${id} research destination lost its secondary role class`, url);
  requireEqual(attr(probe, `data-${id}-research-href`), "./recurrence.html", `${id} research destination changed target`, url);

  const researchSize = Number.parseFloat(attr(probe, `data-${id}-research-font-size`) ?? "");
  const primarySize = Number.parseFloat(attr(probe, `data-${id}-primary-font-size`) ?? "");
  if (!Number.isFinite(researchSize) || !Number.isFinite(primarySize) || !(researchSize < primarySize)) {
    throw new Error(`${id} research destination must be visually subordinate (${researchSize} !< ${primarySize}): ${url}`);
  }
}
requireEqual(attr(probe, "data-all-nav-match"), "true", "cross-view navigation contract failed", url);

for (const id of ["atlasmobile", "recurrencemobile", "birthmobile", "sexagenarymobile"]) {
  requireEqual(attr(probe, `data-${id}-width`), "390", `${id} is not a true 390px viewport`, url);
}
requireEqual(attr(probe, "data-sexagenarydesktop-width"), "1200", "sexagenary desktop fixture width drifted", url);

requireEqual(attr(probe, "data-recurrence-lede-hidden"), "false", "Research question must remain visible in the mobile first-screen flow", url);
requireEqual(attr(probe, "data-recurrence-scope-hidden"), "true", "Recurrence mobile model scope note must stay out of the first-screen instrument flow", url);
requireEqual(attr(probe, "data-recurrence-outline-visible"), "true", "Recurrence mobile lost its compact three-part research outline", url);
requireEqual(attr(probe, "data-recurrence-outline-count"), "3", "Recurrence research outline must expose exactly three existing task owners", url);
requireEqual(attr(probe, "data-recurrence-sexagenary-details-open"), "false", "60-day supporting evidence must stay closed by default", url);
requireEqual(attr(probe, "data-recurrence-task-nav-visible"), "false", "Retired Research task-card navigation returned", url);
requireEqual(attr(probe, "data-recurrence-task-head-before-instrument"), "true", "Recurrence mobile must introduce section 01 before the instrument", url);
requireEqual(attr(probe, "data-recurrence-delta-dock-before-instrument"), "true", "Recurrence displacement controls must precede the result instrument", url);
requireEqual(attr(probe, "data-recurrence-delta-dock-in-first-viewport"), "true", "Recurrence displacement controls must stay fully usable in the first viewport", url);
requireEqual(attr(probe, "data-recurrence-instrument-starts-in-first-viewport"), "true", "Recurrence mobile instrument must still begin in the first viewport", url);
requireEqual(attr(probe, "data-recurrence-candidate-in-delta-dock"), "true", "Recurrence candidates must share the time-displacement owner", url);
requireEqual(attr(probe, "data-recurrence-candidate-in-toolbar"), "false", "Recurrence candidates leaked back into the instrument toolbar", url);
requireEqual(attr(probe, "data-recurrence-delta-number-in-dock"), "true", "Recurrence numeric displacement control left the unified dock", url);
requireEqual(attr(probe, "data-recurrence-delta-slider-in-dock"), "true", "Recurrence slider left the unified dock", url);
requireEqual(attr(probe, "data-recurrence-candidate-count"), "6", "Canonical recurrence candidates changed count", url);
requireEqual(attr(probe, "data-recurrence-question-text"), "離散週期重新對齊，四柱也會回到同一狀態嗎？", "Research question changed", url);
requireEqual(attr(probe, "data-recurrence-spine-discrete"), "基準狀態", "Research discrete spine lost identity state", url);
requireEqual(attr(probe, "data-recurrence-spine-astronomy"), "同一參照", "Research astronomy spine lost identity state", url);
requireEqual(attr(probe, "data-recurrence-spine-evidence"), "4 / 4 同一", "Research evidence spine lost identity state", url);

for (const [label, dataName, minHeight] of [
  ["research outline link", "data-recurrence-outline-link-height", 42],
  ["canonical candidate button", "data-recurrence-candidate-button-height", 42],
  ["numeric displacement input", "data-recurrence-delta-number-height", 42],
  ["base-date input", "data-recurrence-base-date-input-height", 42],
  ["model-boundary disclosure", "data-recurrence-model-boundary-summary-height", 42],
  ["displacement slider", "data-recurrence-delta-slider-height", 32]
]) {
  const height = Number(attr(probe, dataName));
  if (!Number.isFinite(height) || height < minHeight) {
    throw new Error(`Recurrence mobile ${label} fell below its interaction floor (${height}px < ${minHeight}px): ${url}`);
  }
}

const outlineTop = Number(attr(probe, "data-recurrence-outline-top"));
const outlineBottom = Number(attr(probe, "data-recurrence-outline-bottom"));
const outlineHeight = Number(attr(probe, "data-recurrence-outline-height"));
const taskHeadTop = Number(attr(probe, "data-recurrence-task-head-top"));
const taskHeadBottom = Number(attr(probe, "data-recurrence-task-head-bottom"));
const recurrenceTop = Number(attr(probe, "data-recurrence-instrument-top"));
const recurrenceHeight = Number(attr(probe, "data-recurrence-instrument-height"));
const recurrenceVisibleHeight = Number(attr(probe, "data-recurrence-instrument-visible-height"));
const sexagenaryDetailsHeight = Number(attr(probe, "data-recurrence-sexagenary-details-height"));
const astronomyTaskTop = Number(attr(probe, "data-recurrence-astronomy-task-top"));
const deltaDockTop = Number(attr(probe, "data-recurrence-delta-dock-top"));
const deltaDockBottom = Number(attr(probe, "data-recurrence-delta-dock-bottom"));
const deltaDockGap = Number(attr(probe, "data-recurrence-delta-dock-gap"));
if (
  ![outlineTop, outlineBottom, outlineHeight, taskHeadTop, taskHeadBottom, deltaDockTop, deltaDockBottom, recurrenceTop].every(Number.isFinite)
  || !(outlineTop < outlineBottom && outlineBottom <= taskHeadTop && taskHeadTop < taskHeadBottom && taskHeadBottom <= deltaDockTop && deltaDockTop < deltaDockBottom && deltaDockBottom < recurrenceTop)
  || outlineHeight > 46
) {
  throw new Error(
    `Recurrence mobile outline must stay compact and precede section 01 ` +
    `(outline=${outlineTop}..${outlineBottom}/h${outlineHeight}, task=${taskHeadTop}..${taskHeadBottom}, dock=${deltaDockTop}..${deltaDockBottom}, instrument=${recurrenceTop}): ${url}`
  );
}
if (!Number.isFinite(recurrenceHeight) || recurrenceHeight < 600) {
  throw new Error(`Recurrence mobile instrument became too shallow (${recurrenceHeight}px): ${url}`);
}
if (!Number.isFinite(recurrenceVisibleHeight) || recurrenceVisibleHeight < 320) {
  throw new Error(`Recurrence mobile first viewport must still expose a substantial instrument area (${recurrenceVisibleHeight}px): ${url}`);
}
if (
  !Number.isFinite(deltaDockTop)
  || !Number.isFinite(deltaDockBottom)
  || !Number.isFinite(deltaDockGap)
  || deltaDockTop <= taskHeadBottom
  || deltaDockBottom >= recurrenceTop
  || deltaDockGap < 8
  || deltaDockGap > 20
) {
  throw new Error(
    "Recurrence displacement dock must stay directly before the instrument " +
    "(top=" + deltaDockTop + ", bottom=" + deltaDockBottom + ", gap=" + deltaDockGap + "): " + url
  );
}
if (!Number.isFinite(sexagenaryDetailsHeight) || sexagenaryDetailsHeight < 30 || sexagenaryDetailsHeight > 44) {
  throw new Error(`60-day supporting evidence must collapse to one compact rail by default (${sexagenaryDetailsHeight}px): ${url}`);
}
if (!Number.isFinite(astronomyTaskTop) || astronomyTaskTop <= recurrenceTop + recurrenceHeight) {
  throw new Error(`Research section 02 must remain after the primary recurrence instrument (${astronomyTaskTop}px): ${url}`);
}

requireEqual(attr(probe, "data-birth-color-scheme"), "dark", "Birth left the dark instrument color scheme", url);
requireEqual(attr(probe, "data-sex-color-scheme"), "dark", "legacy Ganzhi mobile redirect left the Atlas dark instrument color scheme", url);
requireEqual(attr(probe, "data-sex-desktop-color-scheme"), "dark", "bare legacy Sexagenary redirect left the Atlas dark instrument color scheme", url);
if (!/^#?131915$/i.test(attr(probe, "data-birth-paper") ?? "")) {
  throw new Error(`Birth paper token drifted from the instrument shell (${attr(probe, "data-birth-paper")}): ${url}`);
}

const controlsTop = Number(attr(probe, "data-birth-controls-top"));
const stageTop = Number(attr(probe, "data-birth-stage-top"));
if (!Number.isFinite(controlsTop) || !Number.isFinite(stageTop) || !(controlsTop < stageTop)) {
  throw new Error(`Birth mobile editor must precede the result stage (${controlsTop} !< ${stageTop}): ${url}`);
}
requireEqual(attr(probe, "data-birth-field-hint-hidden"), "true", "Birth mobile verbose field hint returned to primary flow", url);
requireEqual(attr(probe, "data-birth-time-basis-hidden"), "true", "Birth mobile verbose time-basis note returned to primary flow", url);

for (const [name, dataName] of [
  ["solar preview", "data-birth-solar-surface"],
  ["Ten Gods derivation", "data-birth-ten-god-surface"],
  ["relation topology", "data-birth-relation-surface"]
]) {
  const token = attr(probe, dataName);
  if (!looksDarkOrTranslucent(token)) {
    throw new Error(`Birth ${name} regressed to a bright report surface (${token}): ${url}`);
  }
}

requireEqual(attr(probe, "data-sex-legacy-wheel-absent"), "true", "legacy Ganzhi mobile URL still owns an independent Sexagenary wheel", url);
requireEqual(attr(probe, "data-sex-reference-visible"), "true", "legacy Ganzhi mobile URL did not open the Atlas reference inspector", url);
requireEqual(attr(probe, "data-sex-reference-mode"), "reference", "legacy Ganzhi mobile URL was mistaken for contextual pillar inspection", url);
requireEqual(attr(probe, "data-sex-reference-pillar"), "", "standalone Ganzhi reference incorrectly claimed pillar ownership", url);
requireEqual(attr(probe, "data-sex-reference-ganzhi"), "丁卯", "legacy Ganzhi mobile URL resolved the wrong reference item", url);
requireEqual(attr(probe, "data-sex-reference-ready"), "true", "legacy Ganzhi mobile reference failed to resolve", url);
requireEqual(attr(probe, "data-sex-reference-ordinal"), "04 / 60", "legacy Ganzhi mobile ordinal drifted", url);
requireEqual(attr(probe, "data-sex-reference-stem-name"), "丁", "Atlas reference stem did not follow the legacy ?ganzhi=丁卯 selection", url);
requireEqual(attr(probe, "data-sex-reference-stem-meta"), "陰 · 火 · 4 / 10", "Atlas reference stem metadata is stale or incomplete", url);
requireEqual(attr(probe, "data-sex-reference-branch-name"), "卯", "Atlas reference branch did not follow the legacy selection", url);
requireEqual(attr(probe, "data-sex-reference-branch-meta"), "陰 · 木 · 4 / 12", "Atlas reference branch metadata is stale or incomplete", url);
requireEqual(attr(probe, "data-sex-reference-grid-count"), "60", "Atlas standalone reference lost the full 60-item disclosure", url);

requireEqual(attr(probe, "data-sex-desktop-legacy-wheel-absent"), "true", "bare legacy Sexagenary URL still owns an independent wheel", url);
requireEqual(attr(probe, "data-sex-desktop-reference-visible"), "true", "bare legacy Sexagenary URL did not open the Atlas reference inspector", url);
requireEqual(attr(probe, "data-sex-desktop-reference-mode"), "reference", "bare legacy Sexagenary URL was mistaken for contextual pillar inspection", url);
requireEqual(attr(probe, "data-sex-desktop-reference-pillar"), "", "bare legacy Sexagenary default incorrectly claimed pillar ownership", url);
requireEqual(attr(probe, "data-sex-desktop-reference-ganzhi"), "甲子", "bare legacy Sexagenary URL did not preserve its historical default 甲子 selection", url);
requireEqual(attr(probe, "data-sex-desktop-reference-ready"), "true", "bare legacy Sexagenary default reference failed to resolve", url);
requireEqual(attr(probe, "data-sex-desktop-reference-ordinal"), "01 / 60", "bare legacy Sexagenary default ordinal drifted", url);
requireEqual(attr(probe, "data-sex-desktop-reference-stem-name"), "甲", "bare legacy Sexagenary default stem drifted", url);
requireEqual(attr(probe, "data-sex-desktop-reference-branch-name"), "子", "bare legacy Sexagenary default branch drifted", url);
requireEqual(attr(probe, "data-sex-desktop-reference-grid-count"), "60", "bare legacy Sexagenary default lost the full 60-item disclosure", url);

console.log(`[view-shells] PASS two-destination nav + legacy Ganzhi routing + concise first-screen Research: ${url}`);
