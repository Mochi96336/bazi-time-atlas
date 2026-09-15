import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const DAY_MS = 86_400_000;

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
function numberAttr(tag, name) { return Number(attr(tag, name)); }

const url = new URL("scripts/fixtures/reference-frame-390.html", baseURL).href;
const result = spawnSync(findBrowser(), [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--force-device-scale-factor=1", "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw", "--virtual-time-budget=4000", "--window-size=500,844", "--dump-dom", url
], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  throw new Error(`Chromium reference-frame probe failed: ${url}`);
}

const probe = result.stdout.match(/<output[^>]+id="probe"[^>]*>/)?.[0] ?? "";
if (!probe || attr(probe, "data-ready") !== "true") throw new Error(`reference-frame fixture did not settle: ${url}`);

const innerWidth = numberAttr(probe, "data-inner-width");
const initialOffset = numberAttr(probe, "data-initial-offset");
const initialCursor = numberAttr(probe, "data-initial-cursor");
const initialReadheadMaxError = numberAttr(probe, "data-initial-readhead-max-error");
const instantDeltaDay = numberAttr(probe, "data-instant-delta-day");
const dayModelDelta = numberAttr(probe, "data-day-model-delta");
const dayRenderedDelta = numberAttr(probe, "data-day-rendered-delta");
const dayFrameOffset = numberAttr(probe, "data-day-frame-offset");
const dayCursor = numberAttr(probe, "data-day-cursor");
const dayCursorEquationError = numberAttr(probe, "data-day-cursor-equation-error");
const dayReadheadMaxError = numberAttr(probe, "data-day-readhead-max-error");
const solarRelativeDelta = numberAttr(probe, "data-solar-relative-delta");
const zodiacSolarDeltaError = numberAttr(probe, "data-zodiac-solar-delta-error");
const solarReferenceReadheadMaxError = numberAttr(probe, "data-solar-reference-readhead-max-error");
const switchJump = numberAttr(probe, "data-switch-jump");
const switchOffsetDelta = numberAttr(probe, "data-switch-offset-delta");
const hiddenSolarRenderedDelta = numberAttr(probe, "data-hidden-solar-rendered-delta");
const hiddenZodiacRenderedDelta = numberAttr(probe, "data-hidden-zodiac-rendered-delta");
const hiddenDayRenderedDelta = numberAttr(probe, "data-hidden-day-rendered-delta");
const hiddenReadheadMaxError = numberAttr(probe, "data-hidden-readhead-max-error");
const worldOffset = numberAttr(probe, "data-world-offset");
const worldCursor = numberAttr(probe, "data-world-cursor");
const worldMaxRotationError = numberAttr(probe, "data-world-max-rotation-error");
const worldZodiacSolarError = numberAttr(probe, "data-world-zodiac-solar-error");
const worldReadheadMaxError = numberAttr(probe, "data-world-readhead-max-error");

const finite = [innerWidth, initialOffset, initialCursor, initialReadheadMaxError, instantDeltaDay, dayModelDelta,
  dayRenderedDelta, dayFrameOffset, dayCursor, dayCursorEquationError, dayReadheadMaxError, solarRelativeDelta,
  zodiacSolarDeltaError, solarReferenceReadheadMaxError, switchJump, switchOffsetDelta, hiddenSolarRenderedDelta,
  hiddenZodiacRenderedDelta, hiddenDayRenderedDelta, hiddenReadheadMaxError, worldOffset, worldCursor,
  worldMaxRotationError, worldZodiacSolarError, worldReadheadMaxError];
if (!finite.every(Number.isFinite)) throw new Error(`reference-frame: non-finite diagnostics: ${url}`);

if (innerWidth !== 390) throw new Error(`reference-frame: fixture is not true 390px (innerWidth=${innerWidth}): ${url}`);
if (attr(probe, "data-options") !== "world,hour,day,solar,month,year") {
  throw new Error(`reference-frame: selector must follow radial scale order (${attr(probe, "data-options")}): ${url}`);
}
if (attr(probe, "data-zodiac-derived-from") !== "solar") throw new Error(`reference-frame: Zodiac lost Solar ownership: ${url}`);
if (attr(probe, "data-initial-reference") !== "world" || Math.abs(initialOffset) > 1e-6 || Math.abs(initialCursor + 90) > 1e-6) {
  throw new Error(`reference-frame: initial world frame is not canonical: ${url}`);
}
if (initialReadheadMaxError > 0.01) {
  throw new Error(`reference-frame: initial current read-heads missed Selected Instant (${initialReadheadMaxError}°): ${url}`);
}
if (
  attr(probe, "data-motion-fan-clipped") !== "true" || attr(probe, "data-cursor-fan-clipped") !== "true" ||
  attr(probe, "data-motion-clip-owner") !== "kinetic-fan-layer" || attr(probe, "data-cursor-clip-owner") !== "kinetic-fan-layer" ||
  attr(probe, "data-motion-parent") !== "kinetic-fan-layer" || attr(probe, "data-cursor-parent") !== "kinetic-fan-layer" ||
  attr(probe, "data-fan-wrapper-clip") !== "url(#kinetic-master-fan-clip)"
) throw new Error(`reference-frame: moving overlays are not children of the fixed master fan clip: ${url}`);

if (attr(probe, "data-day-reference") !== "day") throw new Error(`reference-frame: Day reference did not activate: ${url}`);
if (Math.abs(instantDeltaDay - DAY_MS) > 1) throw new Error(`reference-frame: +1 day scrub changed master-time semantics (${instantDeltaDay}ms): ${url}`);
if (Math.abs(Math.abs(dayModelDelta) - 6) > 0.01) throw new Error(`reference-frame: Day model did not advance one tooth (${dayModelDelta}°): ${url}`);
if (Math.abs(dayRenderedDelta) > 0.01) throw new Error(`reference-frame: Day reference did not stay visually fixed (${dayRenderedDelta}°): ${url}`);
if (Math.abs(Math.abs(dayFrameOffset) - 6) > 0.01 || Math.abs(dayCursorEquationError) > 0.01) {
  throw new Error(`reference-frame: frame/cursor transform inconsistent (offset=${dayFrameOffset}, cursor=${dayCursor}): ${url}`);
}
if (dayReadheadMaxError > 0.01) {
  throw new Error(`reference-frame: current read-heads missed the moving Day-frame datum (${dayReadheadMaxError}°): ${url}`);
}
if (Math.abs(solarRelativeDelta) < 4 || Math.abs(solarRelativeDelta) > 6.5) throw new Error(`reference-frame: Solar relative drift unexpected (${solarRelativeDelta}°): ${url}`);
if (Math.abs(zodiacSolarDeltaError) > 0.01) throw new Error(`reference-frame: Zodiac did not inherit Solar rendered pose (${zodiacSolarDeltaError}°): ${url}`);
if (attr(probe, "data-day-trace-visible") !== "false" || attr(probe, "data-solar-trace-visible") !== "true") {
  throw new Error(`reference-frame: motion traces are not relative to Day frame: ${url}`);
}

if (attr(probe, "data-solar-reference") !== "solar" || switchJump > 0.01 || Math.abs(switchOffsetDelta) > 0.01) {
  throw new Error(`reference-frame: switching Day→Solar changed visible frame (jump=${switchJump}, offsetDelta=${switchOffsetDelta}): ${url}`);
}
if (solarReferenceReadheadMaxError > 0.01) {
  throw new Error(`reference-frame: current read-heads jumped off the datum on Day→Solar frame switch (${solarReferenceReadheadMaxError}°): ${url}`);
}
if (numberAttr(probe, "data-switch-trace-count") !== 0) throw new Error(`reference-frame: changing reference emitted fake traces: ${url}`);
if (attr(probe, "data-hidden-reference") !== "solar" || attr(probe, "data-solar-hidden") !== "true" || attr(probe, "data-zodiac-hidden") !== "true") {
  throw new Error(`reference-frame: hiding annual band did not hide Solar + Zodiac together: ${url}`);
}
if (Math.abs(hiddenSolarRenderedDelta) > 0.01 || Math.abs(hiddenZodiacRenderedDelta) > 0.01) {
  throw new Error(`reference-frame: hidden annual frame did not remain fixed (solar=${hiddenSolarRenderedDelta}, zodiac=${hiddenZodiacRenderedDelta}): ${url}`);
}
if (Math.abs(hiddenDayRenderedDelta) < 0.05) throw new Error(`reference-frame: Day did not move relative to hidden Solar reference (${hiddenDayRenderedDelta}°): ${url}`);
if (hiddenReadheadMaxError > 0.01) {
  throw new Error(`reference-frame: hidden Solar frame stopped tracking the shared Selected Instant datum (${hiddenReadheadMaxError}°): ${url}`);
}
if (attr(probe, "data-hidden-solar-trace-visible") !== "false") throw new Error(`reference-frame: hidden Solar reference emitted visible trace: ${url}`);
if (attr(probe, "data-solar-restored") !== "false" || attr(probe, "data-zodiac-restored") !== "false" || attr(probe, "data-solar-restored-trace-visible") !== "false") {
  throw new Error(`reference-frame: restoring annual band exposed stale state: ${url}`);
}

if (attr(probe, "data-world-reference") !== "world" || Math.abs(worldOffset) > 1e-6 || Math.abs(worldCursor + 90) > 1e-6) {
  throw new Error(`reference-frame: world reset did not restore canonical frame: ${url}`);
}
if (worldMaxRotationError > 0.01 || worldZodiacSolarError > 0.01) {
  throw new Error(`reference-frame: world reset did not restore primary/world + Zodiac/Solar agreement (${worldMaxRotationError}, ${worldZodiacSolarError}): ${url}`);
}
if (worldReadheadMaxError > 0.01) {
  throw new Error(`reference-frame: world reset left current read-heads off the canonical datum (${worldReadheadMaxError}°): ${url}`);
}
if (numberAttr(probe, "data-world-trace-count") !== 0) throw new Error(`reference-frame: frame reset emitted fake traces: ${url}`);

console.log(`[reference-frame] PASS radial-order frames + shared current read-head datum; Day=${dayModelDelta.toFixed(3)}°, Solar relative=${solarRelativeDelta.toFixed(3)}°: ${url}`);
