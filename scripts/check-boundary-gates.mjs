import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const RINGS = ["hour", "year", "month", "day"];

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dump(path, width = 500, height = 844, virtualTime = 6000) {
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
    throw new Error(`Chromium boundary-gate probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function boundaryTag(dom, id, kind) {
  return dom.match(new RegExp(`<[^>]+class="[^"]*state-boundary-${kind}[^"]*"[^>]+data-boundary-ring="${id}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function dataName(prefix, id, field) {
  return `data-${prefix}-${id}-${field}`;
}

function value(probe, prefix, id, field) {
  return attr(probe, dataName(prefix, id, field));
}

function number(probe, prefix, id, field) {
  return Number(value(probe, prefix, id, field));
}

function requireFinite(values, label, url) {
  if (!values.every(Number.isFinite)) throw new Error(`${label}: non-finite diagnostics: ${url}`);
}

const interactive = dump("scripts/fixtures/boundary-gates-390.html", 500, 844, 8000);
const probe = tagById(interactive.dom, "probe");
const ready = attr(probe, "data-ready");
if (!probe || ready !== "true") {
  const phase = attr(probe, "data-phase") ?? "missing";
  const error = attr(probe, "data-error") ?? "none";
  throw new Error(`boundary-gate fixture did not settle (ready=${ready ?? "missing"}, phase=${phase}, error=${error}): ${interactive.url}`);
}
if (Number(attr(probe, "data-inner-width")) !== 390) {
  throw new Error(`boundary-gate fixture is not a true 390px viewport: ${interactive.url}`);
}

const ziBoundary = Date.parse("2027-03-15T15:00:00.000Z");
if (attr(probe, "data-initial-shared-count") !== "1") {
  throw new Error(`boundary-gate: initial exact shared count is not 1: ${interactive.url}`);
}
if (attr(probe, "data-initial-shared-groups") !== `hour+day@${ziBoundary}`) {
  throw new Error(`boundary-gate: initial shared group is not exact Hour+Day@23:00 (${attr(probe, "data-initial-shared-groups")}): ${interactive.url}`);
}
if (number(probe, "initial", "hour", "end-ms") !== ziBoundary || number(probe, "initial", "day", "end-ms") !== ziBoundary) {
  throw new Error(`boundary-gate: Hour/Day do not share the exact Zi-initial instant: ${interactive.url}`);
}

for (const [id, peer] of [["hour", "day"], ["day", "hour"]]) {
  if (value(probe, "initial", id, "shared") !== "true" || value(probe, "initial", id, "shared-with") !== peer) {
    throw new Error(`boundary-gate: ${id} shared metadata does not name ${peer}: ${interactive.url}`);
  }
  if (value(probe, "initial", id, "gate-shared") !== "true" || value(probe, "initial", id, "gate-class") !== "true") {
    throw new Error(`boundary-gate: ${id} shared gate is not visually classified: ${interactive.url}`);
  }
  if (value(probe, "initial", id, "halo-visibility") === "hidden") {
    throw new Error(`boundary-gate: ${id} shared halo is hidden: ${interactive.url}`);
  }
}
for (const id of ["year", "month"]) {
  if (value(probe, "initial", id, "shared") !== "false" || value(probe, "initial", id, "halo-visibility") !== "hidden") {
    throw new Error(`boundary-gate: ${id} falsely appears shared at the Zi-initial sample: ${interactive.url}`);
  }
}

for (const id of RINGS) {
  const geometry = [
    number(probe, "initial", id, "gate-x1"),
    number(probe, "initial", id, "gate-y1"),
    number(probe, "initial", id, "gate-x2"),
    number(probe, "initial", id, "gate-y2")
  ];
  requireFinite(geometry, `boundary-gate ${id}`, interactive.url);
  if (value(probe, "initial", id, "gate-visibility") === "hidden") {
    throw new Error(`boundary-gate: ${id} terminal gate is hidden: ${interactive.url}`);
  }
  const strokeWidth = Number.parseFloat(value(probe, "initial", id, "stroke-width") ?? "");
  if (!Number.isFinite(strokeWidth) || strokeWidth < 1) {
    throw new Error(`boundary-gate: ${id} terminal gate has no visible stroke: ${interactive.url}`);
  }
}

if (attr(probe, "data-reference-frame") !== "day") {
  throw new Error(`boundary-gate: Day reference frame did not engage: ${interactive.url}`);
}
if (attr(probe, "data-reference-shared-groups") !== attr(probe, "data-initial-shared-groups")) {
  throw new Error(`boundary-gate: reference-frame switch rewrote exact concurrence truth: ${interactive.url}`);
}
for (const id of RINGS) {
  for (const field of ["gate-x1", "gate-y1", "gate-x2", "gate-y2", "end-ms", "shared", "shared-with"]) {
    if (value(probe, "reference", id, field) !== value(probe, "initial", id, field)) {
      throw new Error(`boundary-gate: reference frame mutated ${id} local ${field}: ${interactive.url}`);
    }
  }
}

if (attr(probe, "data-ordinary-shared-count") !== "0" || attr(probe, "data-ordinary-shared-groups") !== "") {
  throw new Error(`boundary-gate: ordinary 20:00 state falsely claims exact concurrence (${attr(probe, "data-ordinary-shared-groups")}): ${interactive.url}`);
}
for (const id of RINGS) {
  if (value(probe, "ordinary", id, "shared") !== "false" || value(probe, "ordinary", id, "halo-visibility") !== "hidden") {
    throw new Error(`boundary-gate: ${id} remains falsely shared at ordinary state: ${interactive.url}`);
  }
}

if (attr(probe, "data-lichun-shared-count") !== "1") {
  throw new Error(`boundary-gate: pre-Li-Chun exact shared count is not 1: ${interactive.url}`);
}
const liYear = number(probe, "lichun", "year", "end-ms");
const liMonth = number(probe, "lichun", "month", "end-ms");
requireFinite([liYear, liMonth], "boundary-gate Li Chun", interactive.url);
if (liYear !== liMonth) {
  throw new Error(`boundary-gate: Year/Month do not end at the identical Li Chun instant (${liYear} vs ${liMonth}): ${interactive.url}`);
}
if (attr(probe, "data-lichun-shared-groups") !== `year+month@${liYear}`) {
  throw new Error(`boundary-gate: Li Chun shared group is wrong (${attr(probe, "data-lichun-shared-groups")}): ${interactive.url}`);
}
for (const [id, peer] of [["year", "month"], ["month", "year"]]) {
  if (value(probe, "lichun", id, "shared") !== "true" || value(probe, "lichun", id, "shared-with") !== peer || value(probe, "lichun", id, "halo-visibility") === "hidden") {
    throw new Error(`boundary-gate: ${id}/${peer} Li Chun concurrence is not visible and exact: ${interactive.url}`);
  }
}
for (const id of ["hour", "day"]) {
  if (value(probe, "lichun", id, "shared") !== "false") {
    throw new Error(`boundary-gate: ${id} falsely joins the Li Chun concurrence group: ${interactive.url}`);
  }
}

const legacy = dump("?lambda=271.3&month=%E5%AD%90&yearStem=%E7%94%B2", 390, 844, 4000);
const legacyInstrument = tagById(legacy.dom, "kinetic-instrument");
const legacyMonth = tagById(legacy.dom, "month-track");
const legacyMonthGate = boundaryTag(legacy.dom, "month", "gate");
const legacyMonthHalo = boundaryTag(legacy.dom, "month", "shared-halo");
if (attr(legacyInstrument, "data-projection-mode") !== "legacy-longitude") {
  throw new Error(`boundary-gate legacy guard: projection mode missing: ${legacy.url}`);
}
if (attr(legacyMonth, "data-next-boundary-ms") !== null || attr(legacyMonth, "data-next-boundary-shared") !== null) {
  throw new Error(`boundary-gate legacy guard: projected month claims a future exact boundary: ${legacy.url}`);
}
if (attr(legacyMonthGate, "visibility") !== "hidden" || attr(legacyMonthHalo, "visibility") !== "hidden") {
  throw new Error(`boundary-gate legacy guard: projected month gate/halo was not suppressed: ${legacy.url}`);
}

console.log(`[boundary-gates] PASS 390px exact concurrence: Hour+Day@${ziBoundary}, ordinary none, Year+Month@${liYear}; reference-frame invariant + legacy month suppression: ${interactive.url}`);
