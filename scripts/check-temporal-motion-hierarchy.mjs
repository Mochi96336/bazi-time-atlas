import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const RINGS = ["hour", "day", "solar", "month", "year"];
const TEN_MINUTES_MS = 10 * 60 * 1000;
const EPSILON_DEGREES = 1e-8;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

const url = new URL("scripts/fixtures/temporal-motion-hierarchy.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=7000",
  "--window-size=500,844",
  "--dump-dom",
  url
], { encoding:"utf8", maxBuffer:10 * 1024 * 1024 });

if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium temporal-motion probe failed: ${url}`);
}

const dom = result.stdout;
const probe = dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0] ?? "";
const attr = name => probe.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
const num = name => Number(attr(name));

if (attr("data-ready") !== "true") {
  throw new Error(`temporal-motion hierarchy fixture did not settle: ${url}`);
}
if (num("data-inner-width") !== 390) {
  throw new Error(`temporal-motion hierarchy fixture is not a true 390px viewport: ${url}`);
}

const initialInstant = num("data-initial-instant");
const stepInstant = num("data-step-instant");
if (![initialInstant, stepInstant].every(Number.isFinite) || Math.abs((stepInstant - initialInstant) - TEN_MINUTES_MS) > 1) {
  throw new Error(`temporal-motion hierarchy did not advance exactly 10 minutes (${initialInstant} -> ${stepInstant}): ${url}`);
}

const cap = id => id[0].toUpperCase() + id.slice(1);
const initial = Object.fromEntries(RINGS.map(id => [id, num(`data-initial-${id}-model`)]));
const stepped = Object.fromEntries(RINGS.map(id => [id, num(`data-step-${id}-model`)]));
const delta = Object.fromEntries(RINGS.map(id => [id, stepped[id] - initial[id]]));

if (![...Object.values(initial), ...Object.values(stepped), ...Object.values(delta)].every(Number.isFinite)) {
  throw new Error(`temporal-motion hierarchy has non-finite track rotations: ${JSON.stringify({ initial, stepped, delta })}: ${url}`);
}

for (const id of RINGS) {
  if (!(delta[id] < -EPSILON_DEGREES)) {
    throw new Error(`time-forward motion changed ${id} in the wrong direction (${delta[id]}°): ${url}`);
  }
}

const speeds = Object.fromEntries(RINGS.map(id => [id, Math.abs(delta[id])]));
const hierarchy = speeds.hour > speeds.day &&
  speeds.day > speeds.solar &&
  speeds.solar > speeds.month &&
  speeds.month > speeds.year;
if (!hierarchy) {
  throw new Error(`temporal angular-speed hierarchy must be Hour > Day > Solar > Month > Year: ${JSON.stringify(speeds)}: ${url}`);
}

// Hour and Day are exact calendar intervals, so their ten-minute deltas have
// exact angular expectations. The slower three are astronomical and intentionally
// checked by ordering rather than pretending they have fixed civil durations.
if (Math.abs(delta.hour + 0.5) > 0.001) {
  throw new Error(`hour track should move −0.5° in 10 minutes, got ${delta.hour}°: ${url}`);
}
if (Math.abs(delta.day + 1 / 24) > 0.001) {
  throw new Error(`day track should move −1/24° in 10 minutes, got ${delta.day}°: ${url}`);
}

const initialLongitude = num("data-initial-longitude");
const stepLongitude = num("data-step-longitude");
const longitudeDelta = stepLongitude - initialLongitude;
if (!(longitudeDelta > 0.004 && longitudeDelta < 0.012)) {
  throw new Error(`apparent solar longitude should advance by a small positive amount in 10 minutes, got ${longitudeDelta}°: ${url}`);
}
if (Math.abs(delta.solar + longitudeDelta) > 0.001) {
  throw new Error(`solar ring rotation should oppose longitude advance (${delta.solar}° vs λ +${longitudeDelta}°): ${url}`);
}

console.log(
  `[temporal-motion] PASS 390px +10min common direction and speed hierarchy ` +
  `Hour ${delta.hour.toFixed(6)}° > Day ${delta.day.toFixed(6)}° > Solar ${delta.solar.toFixed(6)}° > ` +
  `Month ${delta.month.toFixed(6)}° > Year ${delta.year.toFixed(6)}°: ${url}`
);
