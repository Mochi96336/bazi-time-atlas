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

function dump(path, width = 500, height = 844, virtualTime = 5000) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    `--virtual-time-budget=${virtualTime}`,
    `--window-size=${width},${height}`,
    "--dump-dom",
    url
  ], { encoding:"utf8", maxBuffer:10 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium discrete-phase probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function phaseTag(dom, id, kind) {
  return dom.match(new RegExp(`<[^>]+class="[^"]*state-phase-${kind}[^"]*"[^>]+data-phase-ring="${id}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function num(tag, name) {
  return Number(attr(tag, name));
}

function requireFinite(values, label, url) {
  if (!values.every(Number.isFinite)) throw new Error(`${label}: non-finite diagnostics: ${url}`);
}

const interactive = dump("scripts/fixtures/discrete-phase-390.html", 500, 844, 7000);
const probe = tagById(interactive.dom, "probe");
if (!probe || attr(probe, "data-ready") !== "true") {
  throw new Error(`discrete-phase fixture did not settle: ${interactive.url}`);
}

if (num(probe, "data-inner-width") !== 390) {
  throw new Error(`discrete-phase: fixture is not a true 390px viewport: ${interactive.url}`);
}
if (attr(probe, "data-phase-mode") !== "true-boundaries" || attr(probe, "data-phase-rings") !== "hour,year,month,day") {
  throw new Error(`discrete-phase: phase mode/ring contract missing (${attr(probe, "data-phase-mode")}; ${attr(probe, "data-phase-rings")}): ${interactive.url}`);
}

const ids = ["hour", "year", "month", "day"];
const cap = id => id[0].toUpperCase() + id.slice(1);
const read = (prefix, id, field) => num(probe, `data-${prefix}-${id}-${field}`);
const text = (prefix, id, field) => attr(probe, `data-${prefix}-${id}-${field}`);

const initialProgress = Object.fromEntries(ids.map(id => [id, read("initial", id, "progress")]));
const stepProgress = Object.fromEntries(ids.map(id => [id, read("step", id, "progress")]));
const initialModel = Object.fromEntries(ids.map(id => [id, read("initial", id, "model")]));
const stepModel = Object.fromEntries(ids.map(id => [id, read("step", id, "model")]));
const initialActive = Object.fromEntries(ids.map(id => [id, read("initial", id, "active-index")]));
const stepActive = Object.fromEntries(ids.map(id => [id, read("step", id, "active-index")]));
requireFinite([
  ...Object.values(initialProgress), ...Object.values(stepProgress),
  ...Object.values(initialModel), ...Object.values(stepModel),
  ...Object.values(initialActive), ...Object.values(stepActive)
], "discrete-phase initial/step", interactive.url);

if (Math.abs(initialProgress.hour - 1209 / 7200) > 1e-5) {
  throw new Error(`discrete-phase: initial hour progress is not clock-true (${initialProgress.hour}): ${interactive.url}`);
}
if (!(initialProgress.day > 0.93 && initialProgress.day < 0.94)) {
  throw new Error(`discrete-phase: initial day progress is not Zi-boundary true (${initialProgress.day}): ${interactive.url}`);
}
if (text("initial", "hour", "source") !== "double-hour" || text("initial", "day", "source") !== "zi-initial") {
  throw new Error(`discrete-phase: calendar phase sources are wrong: ${interactive.url}`);
}
if (text("initial", "month", "source") !== "jie" || text("initial", "year", "source") !== "li-chun") {
  throw new Error(`discrete-phase: astronomical phase sources are wrong: ${interactive.url}`);
}
if (text("initial", "hour", "kind") !== "calendar-discrete" || text("initial", "day", "kind") !== "calendar-discrete") {
  throw new Error(`discrete-phase: hour/day boundary kind is wrong: ${interactive.url}`);
}
if (text("initial", "month", "kind") !== "astronomical-discrete" || text("initial", "year", "kind") !== "astronomical-discrete") {
  throw new Error(`discrete-phase: month/year boundary kind is wrong: ${interactive.url}`);
}

for (const id of ids) {
  if (!(initialProgress[id] >= 0 && initialProgress[id] < 1)) throw new Error(`discrete-phase: ${id} progress out of range: ${interactive.url}`);
  if (text("initial", id, "bead-visible") !== "true") throw new Error(`discrete-phase: ${id} bead missing: ${interactive.url}`);
  if (text("initial", id, "path-visible") !== "true") throw new Error(`discrete-phase: ${id} progress arc missing: ${interactive.url}`);
  const strokeWidth = Number.parseFloat(text("initial", id, "stroke-width") ?? "");
  if (!Number.isFinite(strokeWidth) || strokeWidth < 3) throw new Error(`discrete-phase: ${id} progress arc is not visibly styled: ${interactive.url}`);
  if (!text("initial", id, "stroke") || text("initial", id, "stroke") === "none") throw new Error(`discrete-phase: ${id} progress arc has no stroke: ${interactive.url}`);
  if (Math.abs(stepModel[id] - initialModel[id]) > 1e-6 || stepActive[id] !== initialActive[id]) {
    throw new Error(`discrete-phase: +10min tweened/snapped ${id} identity instead of phase only: ${interactive.url}`);
  }
}

if (Math.abs((stepProgress.hour - initialProgress.hour) - 1 / 12) > 2e-4) {
  throw new Error(`discrete-phase: +10min hour phase delta is wrong (${initialProgress.hour}->${stepProgress.hour}): ${interactive.url}`);
}
if (Math.abs((stepProgress.day - initialProgress.day) - 1 / 144) > 2e-5) {
  throw new Error(`discrete-phase: +10min day phase delta is wrong (${initialProgress.day}->${stepProgress.day}): ${interactive.url}`);
}
if (!(stepProgress.month > initialProgress.month && stepProgress.year > initialProgress.year)) {
  throw new Error(`discrete-phase: slow astronomical discrete phases did not continue inside their intervals: ${interactive.url}`);
}

const beforeHour = read("before", "hour", "progress");
const beforeDay = read("before", "day", "progress");
const afterHour = read("after", "hour", "progress");
const afterDay = read("after", "day", "progress");
const beforeHourModel = read("before", "hour", "model");
const beforeDayModel = read("before", "day", "model");
const afterHourModel = read("after", "hour", "model");
const afterDayModel = read("after", "day", "model");
requireFinite([beforeHour, beforeDay, afterHour, afterDay, beforeHourModel, beforeDayModel, afterHourModel, afterDayModel], "discrete-phase boundary", interactive.url);
if (Math.abs(beforeHour - 119 / 120) > 2e-5 || Math.abs(beforeDay - 1439 / 1440) > 2e-5) {
  throw new Error(`discrete-phase: 22:59 phases are not approaching the shared 23:00 boundary (hour=${beforeHour}, day=${beforeDay}): ${interactive.url}`);
}
if (Math.abs(afterHour) > 1e-9 || Math.abs(afterDay) > 1e-9) {
  throw new Error(`discrete-phase: 23:00 did not reset hour/day progress exactly (hour=${afterHour}, day=${afterDay}): ${interactive.url}`);
}
if (attr(probe, "data-before-hour-pillar") === attr(probe, "data-after-hour-pillar") || attr(probe, "data-before-day-pillar") === attr(probe, "data-after-day-pillar")) {
  throw new Error(`discrete-phase: pillar identities did not snap at 23:00: ${interactive.url}`);
}
if (Math.abs(Math.abs(afterHourModel - beforeHourModel) - 6) > 0.01 || Math.abs(Math.abs(afterDayModel - beforeDayModel) - 6) > 0.01) {
  throw new Error(`discrete-phase: 23:00 identity snap is not one six-degree tooth (hour=${beforeHourModel}->${afterHourModel}, day=${beforeDayModel}->${afterDayModel}): ${interactive.url}`);
}
if (text("after", "hour", "path-visible") !== "false" || text("after", "day", "path-visible") !== "false") {
  throw new Error(`discrete-phase: reset phase should begin with bead only, not a nonzero arc: ${interactive.url}`);
}
if (text("after", "hour", "bead-visible") !== "true" || text("after", "day", "bead-visible") !== "true") {
  throw new Error(`discrete-phase: reset phase bead vanished at exact boundary: ${interactive.url}`);
}

const legacy = dump("?lambda=271.3&month=%E5%AD%90&yearStem=%E7%94%B2", 390, 844, 3500);
const legacyInstrument = tagById(legacy.dom, "kinetic-instrument");
const legacyMonth = tagById(legacy.dom, "month-track");
const legacyMonthBead = phaseTag(legacy.dom, "month", "bead");
if (attr(legacyInstrument, "data-projection-mode") !== "legacy-longitude") {
  throw new Error(`discrete-phase legacy guard: projection mode missing: ${legacy.url}`);
}
if ((attr(legacyInstrument, "data-discrete-phase-rings") ?? "").includes("month")) {
  throw new Error(`discrete-phase legacy guard: projected month incorrectly claims true-time progress: ${legacy.url}`);
}
if (attr(legacyMonth, "data-phase-progress") !== null || attr(legacyMonthBead, "data-phase-visible") !== "false") {
  throw new Error(`discrete-phase legacy guard: projected month phase overlay was not suppressed: ${legacy.url}`);
}

console.log(`[discrete-phase] PASS 390px true-boundary phase; hour ${initialProgress.hour.toFixed(4)}→${stepProgress.hour.toFixed(4)}, day ${initialProgress.day.toFixed(4)}→${stepProgress.day.toFixed(4)}, exact 23:00 reset + legacy month suppression: ${interactive.url}`);
