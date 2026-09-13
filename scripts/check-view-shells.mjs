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

const expectedNav = "時間圖譜|回歸|出生|六十甲子";
for (const id of ["atlasmobile", "recurrencemobile", "birthmobile", "sexagenarymobile", "sexagenarydesktop"]) {
  requireEqual(attr(probe, `data-${id}-nav`), expectedNav, `${id} navigation drifted`, url);
}
requireEqual(attr(probe, "data-all-nav-match"), "true", "cross-view navigation contract failed", url);

for (const id of ["atlasmobile", "recurrencemobile", "birthmobile", "sexagenarymobile"]) {
  requireEqual(attr(probe, `data-${id}-width`), "390", `${id} is not a true 390px viewport`, url);
}
requireEqual(attr(probe, "data-sexagenarydesktop-width"), "1200", "sexagenary desktop fixture width drifted", url);

requireEqual(attr(probe, "data-birth-color-scheme"), "dark", "Birth left the dark instrument color scheme", url);
requireEqual(attr(probe, "data-sex-color-scheme"), "dark", "Sexagenary left the dark instrument color scheme", url);
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

requireEqual(attr(probe, "data-sex-inspector-hidden"), "true", "Sexagenary mobile duplicate inspector is visible", url);
requireEqual(attr(probe, "data-sex-explainer-hidden"), "true", "Sexagenary mobile duplicate explainer is visible", url);
requireEqual(attr(probe, "data-sex-wheel-visible"), "true", "Sexagenary mobile wheel disappeared", url);
requireEqual(attr(probe, "data-sex-neighbors-visible"), "true", "Sexagenary mobile neighbor navigation disappeared", url);
requireEqual(attr(probe, "data-sex-index-visible"), "true", "Sexagenary mobile full-cycle disclosure disappeared", url);
requireEqual(attr(probe, "data-sex-desktop-inspector-visible"), "true", "Sexagenary desktop inspector should remain visible", url);

console.log(`[view-shells] PASS shared nav + dark Birth surfaces + compact Birth/Sexagenary 390px hierarchy: ${url}`);
