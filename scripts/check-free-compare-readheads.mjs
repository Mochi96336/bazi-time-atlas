import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const EXPECTED_INSTANT_MS = Date.parse("2024-06-15T04:00:00.000Z");
const TOLERANCE_DEGREES = 0.02;
const READHEAD_IDS = ["hour", "day", "term", "zodiac", "month", "year"];

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

const url = new URL("scripts/fixtures/free-compare-readheads-390.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=12000",
  "--window-size=500,844",
  "--dump-dom",
  url
], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium Free Compare read-head probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]*id="probe"[^>]*>/)?.[0] ?? "";
const attr = name => probe.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
const num = name => Number(attr(name));

if (attr("data-ready") !== "true") {
  throw new Error(`Free Compare read-head fixture did not settle (${attr("data-error") ?? "no error detail"}): ${url}`);
}

function parseOffsets(raw) {
  return Object.fromEntries((raw ?? "").split(",").filter(Boolean).map(token => {
    const [name, value] = token.split(":");
    return [name, Number(value)];
  }));
}

function snapshot(prefix) {
  return {
    innerWidth:num(`data-${prefix}-inner-width`),
    instantMs:num(`data-${prefix}-instant-ms`),
    compareMode:attr(`data-${prefix}-compare-mode`) ?? "",
    detachedRings:attr(`data-${prefix}-detached-rings`) ?? "",
    finite:attr(`data-${prefix}-finite`) ?? "",
    offsets:parseOffsets(attr(`data-${prefix}-offsets`))
  };
}

function assertOffsets(phase, actual, expected) {
  for (const id of READHEAD_IDS) {
    if (!Number.isFinite(actual[id])) throw new Error(`${phase}: ${id} read-head offset is non-finite: ${JSON.stringify(actual)}: ${url}`);
    if (Math.abs(actual[id] - expected[id]) > TOLERANCE_DEGREES) {
      throw new Error(
        `${phase}: ${id} read-head ownership drifted; expected ${expected[id]}°, got ${actual[id]}° ` +
        `(tolerance ${TOLERANCE_DEGREES}°): ${url}`
      );
    }
  }
}

const before = snapshot("before");
const enabled = snapshot("enabled");
const detached = snapshot("detached");
const allDetached = snapshot("all-detached");
const restored = snapshot("restored");
const phases = { before, enabled, detached, allDetached, restored };

for (const [phase, value] of Object.entries(phases)) {
  if (value.innerWidth !== 390) throw new Error(`${phase}: fixture is not true 390px: ${JSON.stringify(value)}: ${url}`);
  if (value.instantMs !== EXPECTED_INSTANT_MS) throw new Error(`${phase}: Free Compare mutated Selected Instant: ${JSON.stringify(value)}: ${url}`);
  if (value.finite !== "true") throw new Error(`${phase}: fixture reported non-finite read-head geometry: ${JSON.stringify(value)}: ${url}`);
}

const linked = Object.fromEntries(READHEAD_IDS.map(id => [id, 0]));
assertOffsets("before", before.offsets, linked);
assertOffsets("enabled", enabled.offsets, linked);
if (!(before.compareMode === "false" && enabled.compareMode === "true" && enabled.detachedRings === "")) {
  throw new Error(`Compare entry changed ownership before any ring detached: ${JSON.stringify({ before, enabled })}: ${url}`);
}

assertOffsets("detached", detached.offsets, { ...linked, day:6 });
if (!(detached.compareMode === "true" && detached.detachedRings === "day")) {
  throw new Error(`Day-only detach state is wrong: ${JSON.stringify(detached)}: ${url}`);
}

const expectedAll = { hour:6, day:6, term:15, zodiac:15, month:6, year:6 };
assertOffsets("allDetached", allDetached.offsets, expectedAll);
if (allDetached.detachedRings !== "hour,day,solar,month,year") {
  throw new Error(`all-detached ownership list is wrong: ${JSON.stringify(allDetached)}: ${url}`);
}

assertOffsets("restored", restored.offsets, linked);
if (!(restored.compareMode === "false" && restored.detachedRings === "")) {
  throw new Error(`leaving Compare did not restore linked ownership: ${JSON.stringify(restored)}: ${url}`);
}

console.log(
  `[free-compare-readheads] PASS true 390px ownership: linked all=0°, Day detach=+6°, ` +
  `all detached hour/day/month/year=+6° and term/zodiac=+15°, Selected Instant unchanged: ${url}`
);
