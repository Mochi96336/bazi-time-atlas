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

function requireEqual(actual, expected, message, url) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}: ${url}`);
}

function requirePositiveInteger(actual, message, url) {
  const value = Number(actual);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${message}: expected positive integer, got ${actual}: ${url}`);
  }
}

function dumpDom(path, virtualTimeBudget = 8000) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    `--virtual-time-budget=${virtualTimeBudget}`,
    "--window-size=1260,980",
    "--dump-dom",
    url
  ], { encoding:"utf8", maxBuffer:12 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Ganzhi inspector probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

const fixture = dumpDom("scripts/fixtures/ganzhi-inspector-contract.html");
const probe = tagById(fixture.dom, "probe");
if (!probe || attr(probe, "data-ready") !== "true") {
  throw new Error(`Ganzhi inspector fixture did not settle: ${fixture.url}`);
}

requireEqual(attr(probe, "data-closed-cell-count"), "5", "closed Atlas summary no longer has exactly five comparable cells", fixture.url);
requireEqual(attr(probe, "data-closed-cell-height-aligned"), "true", "pillar reference buttons changed the closed state-strip row height", fixture.url);
requireEqual(attr(probe, "data-closed-cell-top-aligned"), "true", "pillar reference buttons no longer share the Solar cell baseline", fixture.url);
requireEqual(attr(probe, "data-open-visible"), "true", "pillar click did not open inspector", fixture.url);
requireEqual(attr(probe, "data-open-position"), "fixed", "inspector must not participate in Atlas document flow", fixture.url);
requireEqual(attr(probe, "data-strip-top-stable"), "true", "opening inspector shifted state strip top", fixture.url);
requireEqual(attr(probe, "data-strip-height-stable"), "true", "opening inspector changed state strip height", fixture.url);
requireEqual(attr(probe, "data-selected-stable"), "true", "opening inspector mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-url-inspect"), "year", "year inspector state was not persisted in URL", fixture.url);
requireEqual(attr(probe, "data-url-instant"), "2026-09-13T23:43:42.000Z", "inspector rewrote the Selected Instant deep link", fixture.url);
requireEqual(attr(probe, "data-inspector-pillar"), "year", "year inspector selected wrong pillar", fixture.url);
requireEqual(attr(probe, "data-inspector-ganzhi"), attr(probe, "data-state-year"), "year inspector drifted from Atlas pillar identity", fixture.url);
requireEqual(attr(probe, "data-inspector-ready"), "true", "year inspector failed to resolve sexagenary reference", fixture.url);

requireEqual(attr(probe, "data-structure-ready"), "true", "pillar inspector did not resolve structure model", fixture.url);
requireEqual(attr(probe, "data-structure-tab-count"), "3", "pillar inspector must expose exactly Basic / Ten Gods / Relations tabs", fixture.url);
requireEqual(attr(probe, "data-structure-default-tab"), "basic", "pillar inspector did not default to Basic structure tab", fixture.url);
requireEqual(attr(probe, "data-structure-basic-visible"), "true", "Basic structure panel was not visible on open", fixture.url);
requireEqual(attr(probe, "data-keyboard-initial-stops"), "0,-1,-1", "Structure tabs did not start with one roving keyboard stop", fixture.url);
requireEqual(attr(probe, "data-keyboard-left-wrap-tab"), "relations", "ArrowLeft did not wrap Basic to Relations", fixture.url);
requireEqual(attr(probe, "data-keyboard-left-wrap-focus"), "true", "ArrowLeft did not move focus with Structure activation", fixture.url);
requireEqual(attr(probe, "data-keyboard-left-wrap-stops"), "-1,-1,0", "ArrowLeft broke roving tabindex ownership", fixture.url);
requireEqual(attr(probe, "data-selected-after-keyboard-left"), "true", "ArrowLeft Structure navigation mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-keyboard-right-wrap-tab"), "basic", "ArrowRight did not wrap Relations to Basic", fixture.url);
requireEqual(attr(probe, "data-keyboard-right-wrap-focus"), "true", "ArrowRight did not move focus with Structure activation", fixture.url);
requireEqual(attr(probe, "data-keyboard-right-wrap-stops"), "0,-1,-1", "ArrowRight broke roving tabindex ownership", fixture.url);
requireEqual(attr(probe, "data-selected-after-keyboard-right"), "true", "ArrowRight Structure navigation mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-keyboard-end-tab"), "relations", "End did not activate the last Structure tab", fixture.url);
requireEqual(attr(probe, "data-keyboard-end-focus"), "true", "End did not focus the last Structure tab", fixture.url);
requireEqual(attr(probe, "data-keyboard-home-tab"), "basic", "Home did not activate the first Structure tab", fixture.url);
requireEqual(attr(probe, "data-keyboard-home-focus"), "true", "Home did not focus the first Structure tab", fixture.url);
requireEqual(attr(probe, "data-keyboard-home-stops"), "0,-1,-1", "Home did not restore the roving keyboard stop", fixture.url);
requireEqual(attr(probe, "data-selected-after-keyboard-home"), "true", "Home/End Structure navigation mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-structure-ten-god-tab"), "ten-gods", "Ten Gods tab did not become active", fixture.url);
requireEqual(attr(probe, "data-ten-god-row-count"), "4", "Ten Gods tab must retain all four visible pillars", fixture.url);
requirePositiveInteger(attr(probe, "data-ten-god-hidden-count"), "Ten Gods tab lost hidden-stem structure", fixture.url);
requireEqual(attr(probe, "data-selected-after-ten-god"), "true", "switching to Ten Gods mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-structure-relations-tab"), "relations", "Relations tab did not become active", fixture.url);
requireEqual(attr(probe, "data-relation-families"), "3", "Relations tab must keep pair / complete-group / punishment families distinct", fixture.url);
requireEqual(attr(probe, "data-relations-visible"), "true", "Relations panel was not visible after selection", fixture.url);
requireEqual(attr(probe, "data-selected-after-relations"), "true", "switching to Relations mutated Selected Instant", fixture.url);

requireEqual(attr(probe, "data-pillar-switch-count"), "4", "pillar inspector must keep four direct switch targets", fixture.url);
requireEqual(attr(probe, "data-pillar-switch-visible"), "true", "pillar switch rail was not visible in pillar mode", fixture.url);
requireEqual(attr(probe, "data-pillar-switch-initial-stops"), "0,-1,-1,-1", "pillar switch rail did not start with one roving keyboard stop", fixture.url);
requireEqual(attr(probe, "data-pillar-switch-initial-active"), "true", "year pillar did not own the initial switch state", fixture.url);

requireEqual(attr(probe, "data-grid-count"), "60", "sexagenary reference data must retain all 60 entries", fixture.url);
requireEqual(attr(probe, "data-grid-button-count"), "0", "sexagenary grid must stay reference-only, not create an independent selection state", fixture.url);
requireEqual(attr(probe, "data-month-pillar"), "month", "switching pillar reference failed", fixture.url);
requireEqual(attr(probe, "data-month-ganzhi"), attr(probe, "data-state-month"), "month inspector drifted from Atlas pillar identity", fixture.url);
requireEqual(attr(probe, "data-tab-after-pillar-switch"), "relations", "switching pillar unexpectedly reset the active Structure tab", fixture.url);
requireEqual(attr(probe, "data-selected-after-switch"), "true", "switching inspector pillar mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-month-switch-stops"), "-1,0,-1,-1", "clicking Month did not transfer the roving pillar stop", fixture.url);
requireEqual(attr(probe, "data-keyboard-pillar"), "day", "ArrowRight did not move Month to Day", fixture.url);
requireEqual(attr(probe, "data-keyboard-pillar-ganzhi"), attr(probe, "data-state-day"), "keyboard pillar switch drifted from current Day identity", fixture.url);
requireEqual(attr(probe, "data-keyboard-pillar-focus"), "true", "keyboard pillar switching did not move focus", fixture.url);
requireEqual(attr(probe, "data-keyboard-pillar-stops"), "-1,-1,0,-1", "keyboard pillar switching broke roving tabindex ownership", fixture.url);
requireEqual(attr(probe, "data-keyboard-pillar-tab"), "relations", "keyboard pillar switching reset the active Structure tab", fixture.url);
requireEqual(attr(probe, "data-keyboard-pillar-url"), "day", "keyboard pillar switching did not update inspector URL state", fixture.url);
requireEqual(attr(probe, "data-selected-after-pillar-keyboard"), "true", "keyboard pillar switching mutated Selected Instant", fixture.url);
requireEqual(attr(probe, "data-closed-hidden"), "true", "close control did not hide inspector", fixture.url);
requireEqual(attr(probe, "data-closed-inspect-missing"), "true", "close control did not clear only the inspector URL state", fixture.url);
requireEqual(attr(probe, "data-selected-after-close"), "true", "closing inspector mutated Selected Instant", fixture.url);

requireEqual(attr(probe, "data-deep-visible"), "true", "?inspect=day did not reproduce the open inspector", fixture.url);
requireEqual(attr(probe, "data-deep-pillar"), "day", "?inspect=day opened the wrong pillar", fixture.url);
requireEqual(attr(probe, "data-deep-ganzhi"), attr(probe, "data-deep-state-day"), "deep-linked inspector drifted from current Day pillar", fixture.url);
requireEqual(attr(probe, "data-deep-ready"), "true", "deep-linked inspector failed to resolve sexagenary reference", fixture.url);
requireEqual(attr(probe, "data-deep-structure-ready"), "true", "?inspect=day did not resolve Structure data", fixture.url);
requireEqual(attr(probe, "data-deep-structure-tab"), "basic", "deep-linked pillar inspector did not start on Basic", fixture.url);

const mobileFixture = dumpDom("scripts/fixtures/mobile-ganzhi-inspector-390.html", 5000);
const mobileProbe = tagById(mobileFixture.dom, "probe");
if (!mobileProbe || attr(mobileProbe, "data-ready") !== "true") {
  throw new Error(`Mobile Ganzhi inspector fixture did not settle: ${mobileFixture.url}`);
}
requireEqual(attr(mobileProbe, "data-inner-width"), "390", "mobile inspector fixture did not produce a 390px child viewport", mobileFixture.url);
requireEqual(attr(mobileProbe, "data-inspector-visible"), "true", "mobile inspector deep link did not open", mobileFixture.url);
requireEqual(attr(mobileProbe, "data-tab-count"), "3", "mobile inspector lost Structure tabs", mobileFixture.url);
requireEqual(attr(mobileProbe, "data-switch-count"), "4", "mobile inspector lost pillar switches", mobileFixture.url);

const mobileCloseHeight = Number(attr(mobileProbe, "data-close-height"));
const mobileTabHeight = Number(attr(mobileProbe, "data-tab-min-height"));
const mobileSwitchHeight = Number(attr(mobileProbe, "data-switch-min-height"));
const mobileHeaderHeight = Number(attr(mobileProbe, "data-header-height"));
const mobileLeft = Number(attr(mobileProbe, "data-inspector-left"));
const mobileRight = Number(attr(mobileProbe, "data-inspector-right"));
const mobileBottom = Number(attr(mobileProbe, "data-inspector-bottom"));
if (
  !Number.isFinite(mobileCloseHeight) || mobileCloseHeight < 35
  || !Number.isFinite(mobileTabHeight) || mobileTabHeight < 37
  || !Number.isFinite(mobileSwitchHeight) || mobileSwitchHeight < 37
  || !Number.isFinite(mobileHeaderHeight) || mobileHeaderHeight > 52
) {
  throw new Error(
    `Mobile Ganzhi inspector touch geometry failed ` +
    `(close=${mobileCloseHeight}, tab=${mobileTabHeight}, switch=${mobileSwitchHeight}, header=${mobileHeaderHeight}): ${mobileFixture.url}`
  );
}
if (
  !Number.isFinite(mobileLeft) || mobileLeft < 10
  || !Number.isFinite(mobileRight) || mobileRight > 380
  || !Number.isFinite(mobileBottom) || mobileBottom > 834
) {
  throw new Error(
    `Mobile Ganzhi inspector escaped viewport bounds ` +
    `(left=${mobileLeft}, right=${mobileRight}, bottom=${mobileBottom}): ${mobileFixture.url}`
  );
}

const instant = "2026-09-13T23:43:42.000Z";
const standalone = dumpDom(`?instant=${encodeURIComponent(instant)}&reference=${encodeURIComponent("乙酉")}`, 3000);
const standaloneInspector = tagById(standalone.dom, "ganzhi-inspector");
const standaloneInstrument = tagById(standalone.dom, "kinetic-instrument");
requireEqual(attr(standaloneInspector, "data-open"), "true", "standalone reference deep link did not open inspector", standalone.url);
requireEqual(attr(standaloneInspector, "data-mode"), "reference", "standalone target was mistaken for a pillar inspector", standalone.url);
requireEqual(attr(standaloneInspector, "data-pillar"), "", "standalone reference incorrectly claimed a current pillar", standalone.url);
requireEqual(attr(standaloneInspector, "data-ganzhi"), "乙酉", "standalone reference resolved wrong Ganzhi", standalone.url);
requireEqual(attr(standaloneInspector, "data-ready"), "true", "standalone reference failed to resolve", standalone.url);
requireEqual(attr(standaloneInspector, "data-structure-ready"), "false", "standalone reference incorrectly activated current-pillar Structure data", standalone.url);
requireEqual(attr(standaloneInstrument, "data-selected-instant-ms"), String(Date.parse(instant)), "standalone reference mutated Selected Instant", standalone.url);
if (!/id="ganzhi-inspector-title"[^>]*>乙酉<\/strong>/.test(standalone.dom)) {
  throw new Error(`standalone reference title did not render 乙酉: ${standalone.url}`);
}
if (!/id="ganzhi-inspector-ordinal"[^>]*>22 \/ 60<\/b>/.test(standalone.dom)) {
  throw new Error(`standalone reference ordinal did not render 22 / 60: ${standalone.url}`);
}

console.log(`[ganzhi-inspector] PASS continuous pillar switching + contextual Structure tabs + keyboard ownership without Selected-Instant mutation: ${fixture.url}`);