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

function dumpDom(path) {
  const url = new URL(path, baseURL).href;
  const result = spawnSync(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=2500",
    "--dump-dom",
    url
  ], { encoding:"utf8", maxBuffer:8 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom:result.stdout };
}

function tagById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0] ?? "";
}

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function textById(dom, id) {
  return dom.match(new RegExp(`<[^>]+id="${id}"[^>]*>([^<]*)</[^>]+>`))?.[1]?.trim() ?? "";
}

function stageTag(dom, id) {
  return dom.match(new RegExp(`<article[^>]*data-proof-stage="${id}"[^>]*>`))?.[0] ?? "";
}

function expectStage(dom, id, expected, label, url) {
  const tag = stageTag(dom, id);
  const actual = attr(tag, "data-status");
  if (actual !== expected) {
    throw new Error(`${label}: expected ${id} status=${expected}, got ${actual}: ${url}`);
  }
}

const zero = dumpDom("recurrence.html?date=2026-09-13&delta=0");
const zeroInstrument = tagById(zero.dom, "recurrence-instrument");
const zeroPanel = tagById(zero.dom, "day-hour-proof-chain");
if (attr(zeroPanel, "data-ready") !== "true" || attr(zeroPanel, "data-identity") !== "true") {
  throw new Error(`zero identity: proof chain did not settle as identity: ${zero.url}`);
}
if (attr(zeroInstrument, "data-day-hour-proof-day-resolved") !== "true" || attr(zeroInstrument, "data-day-hour-proof-hour-resolved") !== "true") {
  throw new Error(`zero identity: Day/Hour identity bypass missing: ${zero.url}`);
}
if (!zero.dom.includes("Δ=0 · 同一狀態免驗") || !zero.dom.includes("同一狀態不需要跨時代的絕對時間投影")) {
  throw new Error(`zero identity: identity-bypass explanation missing: ${zero.url}`);
}
expectStage(zero.dom, "absolute-seasonal-epoch", "satisfied", "zero identity", zero.url);
expectStage(zero.dom, "target-instant", "not-required", "zero identity", zero.url);
expectStage(zero.dom, "earth-rotation-bridge", "not-required", "zero identity", zero.url);
console.log(`[day-hour-proof] PASS identity bypass does not invent a cross-era target instant: ${zero.url}`);

const local = dumpDom("recurrence.html?date=2026-09-13&delta=1980");
const localInstrument = tagById(local.dom, "recurrence-instrument");
const localPanel = tagById(local.dom, "day-hour-proof-chain");
const localControls = tagById(local.dom, "target-instant-controls");
const localExact = {
  "data-ready":"true",
  "data-identity":"false",
  "data-first-hard-blocker":"target-instant",
  "data-target-instant-basis":"date-only",
  "data-target-instant-bound":"false",
  "data-target-clock-enabled":"false",
  "data-day-boundary":"unbound",
  "data-day-boundary-bound":"false",
  "data-day-boundary-control-valid":"true",
  "data-clock-basis":"unbound",
  "data-clock-basis-bound":"false",
  "data-clock-basis-control-valid":"true",
  "data-earth-rotation-estimate-available":"false",
  "data-day-resolved":"false",
  "data-hour-resolved":"false",
  "data-stage-count":"11"
};
for (const [name, expected] of Object.entries(localExact)) {
  const actual = attr(localPanel, name);
  if (actual !== expected) throw new Error(`4006 proof: expected ${name}=${expected}, got ${actual}: ${local.url}`);
}
if (
  attr(localControls, "data-day-boundary") !== "unbound"
  || attr(localControls, "data-day-boundary-valid") !== "true"
  || attr(localControls, "data-clock-basis") !== "unbound"
  || attr(localControls, "data-clock-basis-valid") !== "true"
) {
  throw new Error(`4006 proof: default convention controls must remain explicitly unbound: ${local.url}`);
}
if (attr(localInstrument, "data-day-hour-proof-first-hard-blocker") !== "target-instant") {
  throw new Error(`4006 proof: instrument first blocker mismatch: ${local.url}`);
}
if (
  attr(localInstrument, "data-selected-target-instant-basis") !== "date-only"
  || attr(localInstrument, "data-selected-target-instant-bound") !== "false"
  || attr(localInstrument, "data-selected-target-instant-julian-day") !== null
) {
  throw new Error(`4006 proof: shared selected-target authority must remain date-only while target clock is unbound: ${local.url}`);
}
if (
  attr(localInstrument, "data-day-hour-proof-day-boundary") !== "unbound"
  || attr(localInstrument, "data-day-hour-proof-day-boundary-bound") !== "false"
  || attr(localInstrument, "data-day-hour-proof-clock-basis") !== "unbound"
  || attr(localInstrument, "data-day-hour-proof-clock-basis-bound") !== "false"
) {
  throw new Error(`4006 proof: instrument convention defaults must remain unbound: ${local.url}`);
}
if (attr(localInstrument, "data-day-hour-proof-earth-rotation-estimate-available") !== "false") {
  throw new Error(`4006 proof: date-only recurrence must not claim a target-specific UT1 estimate: ${local.url}`);
}
expectStage(local.dom, "relative-term-geometry", "satisfied", "4006 proof", local.url);
expectStage(local.dom, "absolute-seasonal-epoch", "satisfied", "4006 proof", local.url);
expectStage(local.dom, "target-instant", "unbound-convention", "4006 proof", local.url);
expectStage(local.dom, "earth-rotation-bridge", "blocked", "4006 proof", local.url);
expectStage(local.dom, "civil-zone", "unbound-convention", "4006 proof", local.url);
expectStage(local.dom, "day-boundary", "unbound-convention", "4006 proof", local.url);
if (!local.dom.includes("目標時刻／reference basis") || !local.dom.includes("回歸頁目前只指定年月日") || !local.dom.includes("沒有 hour/minute/second") || !local.dom.includes("date-only")) {
  throw new Error(`4006 proof: typed date-only target-instant explanation missing: ${local.url}`);
}
if (!local.dom.includes("此年份已有深時間 ΔT / TT→UT1 模型能力") || !local.dom.includes("尚未定義 target instant reference basis")) {
  throw new Error(`4006 proof: Earth-rotation capability must remain upstream-blocked: ${local.url}`);
}
if (!local.dom.includes("proleptic Gregorian + 固定 UT1 offset") || !local.dom.includes("不是西元遠未來 UTC")) {
  throw new Error(`4006 proof: explicit fixed-zone research warning missing: ${local.url}`);
}
const localDayBlockers = textById(local.dom, "proof-chain-day-blockers");
const localHourBlockers = textById(local.dom, "proof-chain-hour-blockers");
if (
  !localDayBlockers.includes("地方鐘面／時區約定")
  || localDayBlockers.includes("localZoneBound")
  || !localHourBlockers.includes("已解析日柱")
  || localHourBlockers.includes("localZoneBound")
) {
  throw new Error(`4006 proof: typed local-zone blocker ownership/rendering mismatch: ${local.url}`);
}
console.log(`[day-hour-proof] PASS 4006 date-only recurrence blocks typed target instant before Earth rotation: ${local.url}`);

const fixedZonePath = "recurrence.html?date=2026-09-13&delta=1980&targetClock=fixed-zone&targetTime=12%3A34%3A56&ut1Offset=8";
const bound = dumpDom(fixedZonePath);
const boundInstrument = tagById(bound.dom, "recurrence-instrument");
const boundPanel = tagById(bound.dom, "day-hour-proof-chain");
const boundControls = tagById(bound.dom, "target-instant-controls");
const boundExact = {
  "data-ready":"true",
  "data-identity":"false",
  "data-first-hard-blocker":"day-boundary",
  "data-target-instant-basis":"fixed-zone-from-ut1",
  "data-target-instant-bound":"true",
  "data-target-clock-enabled":"true",
  "data-target-clock-valid":"true",
  "data-day-boundary":"unbound",
  "data-day-boundary-bound":"false",
  "data-day-boundary-control-valid":"true",
  "data-clock-basis":"unbound",
  "data-clock-basis-bound":"false",
  "data-clock-basis-control-valid":"true",
  "data-earth-rotation-bridge-required":"false",
  "data-earth-rotation-estimate-available":"false",
  "data-day-resolved":"false",
  "data-hour-resolved":"false"
};
for (const [name, expected] of Object.entries(boundExact)) {
  const actual = attr(boundPanel, name);
  if (actual !== expected) throw new Error(`4006 fixed-zone proof: expected ${name}=${expected}, got ${actual}: ${bound.url}`);
}
if (
  attr(boundControls, "data-enabled") !== "true"
  || attr(boundControls, "data-valid") !== "true"
  || attr(boundControls, "data-basis") !== "fixed-zone-from-ut1"
  || attr(boundControls, "data-day-boundary") !== "unbound"
  || attr(boundControls, "data-day-boundary-valid") !== "true"
  || attr(boundControls, "data-clock-basis") !== "unbound"
  || attr(boundControls, "data-clock-basis-valid") !== "true"
) {
  throw new Error(`4006 fixed-zone proof: target/day-boundary/clock-basis controls did not settle to the expected unbound state: ${bound.url}`);
}
if (attr(boundInstrument, "data-day-hour-proof-target-instant-basis") !== "fixed-zone-from-ut1" || attr(boundInstrument, "data-day-hour-proof-target-instant-bound") !== "true") {
  throw new Error(`4006 fixed-zone proof: instrument target binding mismatch: ${bound.url}`);
}
if (
  attr(boundInstrument, "data-selected-target-instant-basis") !== "fixed-zone-from-ut1"
  || attr(boundInstrument, "data-selected-target-instant-bound") !== "true"
  || !Number.isFinite(Number(attr(boundInstrument, "data-selected-target-instant-julian-day")))
  || attr(boundInstrument, "data-selected-target-instant-local-offset-hours-from-ut1") !== "8"
) {
  throw new Error(`4006 fixed-zone proof: shared selected-target authority did not mirror the typed target instant: ${bound.url}`);
}
expectStage(bound.dom, "absolute-seasonal-epoch", "satisfied", "4006 fixed-zone proof", bound.url);
expectStage(bound.dom, "target-instant", "satisfied", "4006 fixed-zone proof", bound.url);
expectStage(bound.dom, "earth-rotation-bridge", "not-required", "4006 fixed-zone proof", bound.url);
expectStage(bound.dom, "civil-zone", "satisfied", "4006 fixed-zone proof", bound.url);
expectStage(bound.dom, "day-boundary", "unbound-convention", "4006 fixed-zone proof", bound.url);
if (!bound.dom.includes("4006-09-13 12:34:56") || !bound.dom.includes("UT1 JD") || !bound.dom.includes("offset +8 h")) {
  throw new Error(`4006 fixed-zone proof: target projection readout missing: ${bound.url}`);
}
if (!bound.dom.includes("proleptic fixed local zone") || !bound.dom.includes("civilTimezonePolicyResolved=false") || !bound.dom.includes("不是未來 UTC／DST／政治時區預測")) {
  throw new Error(`4006 fixed-zone proof: local-zone convention must remain explicit and non-political: ${bound.url}`);
}
if (!bound.dom.includes("Birth 的預設不會被 recurrence 暗中繼承")) {
  throw new Error(`4006 fixed-zone proof: explicit day-boundary blocker explanation missing: ${bound.url}`);
}
console.log(`[day-hour-proof] PASS 4006 fixed-zone target derives local-zone convention and stops at day-boundary: ${bound.url}`);

const ziBoundary = dumpDom(`${fixedZonePath}&dayBoundary=zi-initial-next-day`);
const ziInstrument = tagById(ziBoundary.dom, "recurrence-instrument");
const ziPanel = tagById(ziBoundary.dom, "day-hour-proof-chain");
const ziControls = tagById(ziBoundary.dom, "target-instant-controls");
const ziExact = {
  "data-ready":"true",
  "data-first-hard-blocker":"clock-basis",
  "data-target-instant-basis":"fixed-zone-from-ut1",
  "data-target-instant-bound":"true",
  "data-day-boundary":"zi-initial-next-day",
  "data-day-boundary-bound":"true",
  "data-day-boundary-control-valid":"true",
  "data-clock-basis":"unbound",
  "data-clock-basis-bound":"false",
  "data-clock-basis-control-valid":"true",
  "data-day-resolved":"true",
  "data-hour-resolved":"false"
};
for (const [name, expected] of Object.entries(ziExact)) {
  const actual = attr(ziPanel, name);
  if (actual !== expected) throw new Error(`4006 zi-boundary proof: expected ${name}=${expected}, got ${actual}: ${ziBoundary.url}`);
}
if (
  attr(ziControls, "data-day-boundary") !== "zi-initial-next-day"
  || attr(ziControls, "data-day-boundary-valid") !== "true"
  || attr(ziControls, "data-clock-basis") !== "unbound"
) {
  throw new Error(`4006 zi-boundary proof: control did not bind canonical zi-initial-next-day while keeping clock basis unbound: ${ziBoundary.url}`);
}
if (attr(ziInstrument, "data-day-hour-proof-day-boundary") !== "zi-initial-next-day" || attr(ziInstrument, "data-day-hour-proof-day-boundary-bound") !== "true") {
  throw new Error(`4006 zi-boundary proof: instrument day-boundary binding mismatch: ${ziBoundary.url}`);
}
expectStage(ziBoundary.dom, "day-boundary", "satisfied", "4006 zi-boundary proof", ziBoundary.url);
expectStage(ziBoundary.dom, "clock-basis", "unbound-convention", "4006 zi-boundary proof", ziBoundary.url);
if (!ziBoundary.dom.includes("canonical zi-initial-next-day") || !ziBoundary.dom.includes("子初 23:00") || !ziBoundary.dom.includes("時柱仍需明示 civil / local mean solar / local apparent solar clock basis")) {
  throw new Error(`4006 zi-boundary proof: canonical boundary or next-blocker explanation missing: ${ziBoundary.url}`);
}
if (textById(ziBoundary.dom, "proof-chain-day-blockers") !== "無阻塞" || !textById(ziBoundary.dom, "proof-chain-hour-blockers").includes("地方時計時基準")) {
  throw new Error(`4006 zi-boundary proof: Day should resolve while Hour stops at clock basis: ${ziBoundary.url}`);
}
console.log(`[day-hour-proof] PASS canonical zi-initial day boundary advances 4006 proof to clock-basis: ${ziBoundary.url}`);

const midnightBoundary = dumpDom(`${fixedZonePath}&dayBoundary=civil-midnight`);
const midnightPanel = tagById(midnightBoundary.dom, "day-hour-proof-chain");
const midnightControls = tagById(midnightBoundary.dom, "target-instant-controls");
if (
  attr(midnightPanel, "data-first-hard-blocker") !== "clock-basis"
  || attr(midnightPanel, "data-day-boundary") !== "civil-midnight"
  || attr(midnightPanel, "data-day-boundary-bound") !== "true"
  || attr(midnightPanel, "data-clock-basis") !== "unbound"
  || attr(midnightPanel, "data-day-resolved") !== "true"
  || attr(midnightPanel, "data-hour-resolved") !== "false"
  || attr(midnightControls, "data-day-boundary") !== "civil-midnight"
) {
  throw new Error(`4006 civil-midnight proof: canonical boundary did not advance to clock-basis: ${midnightBoundary.url}`);
}
expectStage(midnightBoundary.dom, "day-boundary", "satisfied", "4006 civil-midnight proof", midnightBoundary.url);
if (!midnightBoundary.dom.includes("canonical civil-midnight") || !midnightBoundary.dom.includes("00:00 民用午夜")) {
  throw new Error(`4006 civil-midnight proof: canonical midnight detail missing: ${midnightBoundary.url}`);
}
console.log(`[day-hour-proof] PASS canonical civil-midnight day boundary advances 4006 proof to clock-basis: ${midnightBoundary.url}`);

const invalidBoundary = dumpDom(`${fixedZonePath}&dayBoundary=late-zi-ish`);
const invalidPanel = tagById(invalidBoundary.dom, "day-hour-proof-chain");
const invalidControls = tagById(invalidBoundary.dom, "target-instant-controls");
if (
  attr(invalidPanel, "data-first-hard-blocker") !== "day-boundary"
  || attr(invalidPanel, "data-day-boundary") !== "unbound"
  || attr(invalidPanel, "data-day-boundary-bound") !== "false"
  || attr(invalidPanel, "data-day-boundary-control-valid") !== "false"
  || attr(invalidControls, "data-day-boundary") !== "unbound"
  || attr(invalidControls, "data-day-boundary-valid") !== "false"
) {
  throw new Error(`4006 invalid-boundary proof: invalid query must fail closed to unbound day-boundary: ${invalidBoundary.url}`);
}
expectStage(invalidBoundary.dom, "day-boundary", "unbound-convention", "4006 invalid-boundary proof", invalidBoundary.url);
console.log(`[day-hour-proof] PASS invalid day-boundary query fails closed: ${invalidBoundary.url}`);

const civilClock = dumpDom(`${fixedZonePath}&dayBoundary=zi-initial-next-day&clockBasis=civil`);
const civilPanel = tagById(civilClock.dom, "day-hour-proof-chain");
const civilControls = tagById(civilClock.dom, "target-instant-controls");
const civilInstrument = tagById(civilClock.dom, "recurrence-instrument");
const civilExact = {
  "data-first-hard-blocker":"none",
  "data-clock-basis":"civil",
  "data-clock-basis-bound":"true",
  "data-clock-basis-control-valid":"true",
  "data-needs-longitude":"false",
  "data-needs-equation-of-time":"false",
  "data-day-resolved":"true",
  "data-hour-resolved":"true"
};
for (const [name, expected] of Object.entries(civilExact)) {
  const actual = attr(civilPanel, name);
  if (actual !== expected) throw new Error(`4006 civil-clock proof: expected ${name}=${expected}, got ${actual}: ${civilClock.url}`);
}
if (
  attr(civilControls, "data-clock-basis") !== "civil"
  || attr(civilControls, "data-clock-basis-valid") !== "true"
  || attr(civilInstrument, "data-day-hour-proof-clock-basis") !== "civil"
  || attr(civilInstrument, "data-day-hour-proof-clock-basis-bound") !== "true"
) {
  throw new Error(`4006 civil-clock proof: typed clock basis did not propagate through controls/instrument: ${civilClock.url}`);
}
expectStage(civilClock.dom, "clock-basis", "satisfied", "4006 civil-clock proof", civilClock.url);
expectStage(civilClock.dom, "longitude", "not-required", "4006 civil-clock proof", civilClock.url);
expectStage(civilClock.dom, "equation-of-time", "not-required", "4006 civil-clock proof", civilClock.url);
if (!civilClock.dom.includes("已選 civil/zone-clock reading") || !civilClock.dom.includes("不代表未來政治時區已解決")) {
  throw new Error(`4006 civil-clock proof: fixed-zone civil semantics warning missing: ${civilClock.url}`);
}
if (textById(civilClock.dom, "proof-chain-hour-blockers") !== "無阻塞") {
  throw new Error(`4006 civil-clock proof: Hour should resolve without longitude/EoT: ${civilClock.url}`);
}
console.log(`[day-hour-proof] PASS explicit civil clock basis resolves Hour without longitude or EoT: ${civilClock.url}`);

const meanSolar = dumpDom(`${fixedZonePath}&dayBoundary=zi-initial-next-day&clockBasis=local-mean-solar`);
const meanPanel = tagById(meanSolar.dom, "day-hour-proof-chain");
if (
  attr(meanPanel, "data-first-hard-blocker") !== "longitude"
  || attr(meanPanel, "data-clock-basis") !== "local-mean-solar"
  || attr(meanPanel, "data-clock-basis-bound") !== "true"
  || attr(meanPanel, "data-needs-longitude") !== "true"
  || attr(meanPanel, "data-needs-equation-of-time") !== "false"
  || attr(meanPanel, "data-hour-resolved") !== "false"
) {
  throw new Error(`4006 mean-solar proof: explicit basis must advance to longitude only: ${meanSolar.url}`);
}
expectStage(meanSolar.dom, "clock-basis", "satisfied", "4006 mean-solar proof", meanSolar.url);
expectStage(meanSolar.dom, "longitude", "unbound-convention", "4006 mean-solar proof", meanSolar.url);
expectStage(meanSolar.dom, "equation-of-time", "not-required", "4006 mean-solar proof", meanSolar.url);
if (!textById(meanSolar.dom, "proof-chain-hour-blockers").includes("經度") || textById(meanSolar.dom, "proof-chain-hour-blockers").includes("地方時計時基準")) {
  throw new Error(`4006 mean-solar proof: Hour blocker should move from clock basis to longitude: ${meanSolar.url}`);
}
console.log(`[day-hour-proof] PASS explicit local-mean-solar basis advances Hour proof to longitude: ${meanSolar.url}`);

const apparentSolar = dumpDom(`${fixedZonePath}&dayBoundary=zi-initial-next-day&clockBasis=local-apparent-solar`);
const apparentPanel = tagById(apparentSolar.dom, "day-hour-proof-chain");
if (
  attr(apparentPanel, "data-first-hard-blocker") !== "longitude"
  || attr(apparentPanel, "data-clock-basis") !== "local-apparent-solar"
  || attr(apparentPanel, "data-needs-longitude") !== "true"
  || attr(apparentPanel, "data-needs-equation-of-time") !== "true"
  || attr(apparentPanel, "data-equation-of-time-target-evidence-available") !== "true"
  || attr(apparentPanel, "data-equation-of-time-target-evidence-authority") !== "false"
  || attr(apparentPanel, "data-hour-resolved") !== "false"
) {
  throw new Error(`4006 apparent-solar proof: explicit basis must expose longitude + non-authoritative Equation of Time evidence: ${apparentSolar.url}`);
}
expectStage(apparentSolar.dom, "clock-basis", "satisfied", "4006 apparent-solar proof", apparentSolar.url);
expectStage(apparentSolar.dom, "longitude", "unbound-convention", "4006 apparent-solar proof", apparentSolar.url);
expectStage(apparentSolar.dom, "equation-of-time", "evidence-not-authoritative", "4006 apparent-solar proof", apparentSolar.url);
const apparentBlockers = textById(apparentSolar.dom, "proof-chain-hour-blockers");
if (!apparentBlockers.includes("經度") || !apparentBlockers.includes("均時差（Equation of Time）")) {
  throw new Error(`4006 apparent-solar proof: both downstream blockers must be visible: ${apparentSolar.url}`);
}
if (!apparentSolar.dom.includes("swiss-ephemeris-eot-4006-dense-v2") || !apparentSolar.dom.includes("有實證 · 未授權")) {
  throw new Error(`4006 apparent-solar proof: target-year EoT evidence must be visible without authority promotion: ${apparentSolar.url}`);
}
console.log(`[day-hour-proof] PASS explicit local-apparent-solar basis exposes longitude and non-authoritative EoT evidence: ${apparentSolar.url}`);

const invalidClock = dumpDom(`${fixedZonePath}&dayBoundary=zi-initial-next-day&clockBasis=sundial-ish`);
const invalidClockPanel = tagById(invalidClock.dom, "day-hour-proof-chain");
const invalidClockControls = tagById(invalidClock.dom, "target-instant-controls");
if (
  attr(invalidClockPanel, "data-first-hard-blocker") !== "clock-basis"
  || attr(invalidClockPanel, "data-clock-basis") !== "unbound"
  || attr(invalidClockPanel, "data-clock-basis-bound") !== "false"
  || attr(invalidClockPanel, "data-clock-basis-control-valid") !== "false"
  || attr(invalidClockControls, "data-clock-basis") !== "unbound"
  || attr(invalidClockControls, "data-clock-basis-valid") !== "false"
) {
  throw new Error(`4006 invalid-clock proof: invalid query must fail closed to unbound clock basis: ${invalidClock.url}`);
}
expectStage(invalidClock.dom, "clock-basis", "unbound-convention", "4006 invalid-clock proof", invalidClock.url);
console.log(`[day-hour-proof] PASS invalid clock-basis query fails closed: ${invalidClock.url}`);

const global = dumpDom("recurrence.html?date=2026-09-13&delta=24000");
const instrument = tagById(global.dom, "recurrence-instrument");
const panel = tagById(global.dom, "day-hour-proof-chain");
const exact = {
  "data-ready":"true",
  "data-identity":"false",
  "data-first-hard-blocker":"absolute-seasonal-epoch",
  "data-day-boundary":"unbound",
  "data-day-boundary-bound":"false",
  "data-clock-basis":"unbound",
  "data-clock-basis-bound":"false",
  "data-earth-rotation-estimate-available":"false",
  "data-day-resolved":"false",
  "data-hour-resolved":"false",
  "data-stage-count":"11"
};
for (const [name, expected] of Object.entries(exact)) {
  const actual = attr(panel, name);
  if (actual !== expected) throw new Error(`24000-year proof: expected ${name}=${expected}, got ${actual}: ${global.url}`);
}
if (attr(instrument, "data-day-hour-proof-first-hard-blocker") !== "absolute-seasonal-epoch") {
  throw new Error(`24000-year proof: instrument first blocker mismatch: ${global.url}`);
}
if (attr(instrument, "data-day-hour-proof-day-resolved") !== "false" || attr(instrument, "data-day-hour-proof-hour-resolved") !== "false") {
  throw new Error(`24000-year proof: instrument should keep Day/Hour blocked: ${global.url}`);
}

const expectedStages = {
  "relative-term-geometry":"satisfied",
  "absolute-seasonal-epoch":"missing-deep-time-model",
  "target-instant":"unbound-convention",
  "earth-rotation-bridge":"blocked",
  "civil-zone":"unbound-convention",
  "day-boundary":"unbound-convention",
  "sexagenary-day-arithmetic":"satisfied",
  "clock-basis":"unbound-convention",
  longitude:"conditional",
  "equation-of-time":"conditional",
  "hour-rules":"satisfied"
};
for (const [id, status] of Object.entries(expectedStages)) expectStage(global.dom, id, status, "24000-year proof", global.url);

if (!global.dom.includes("絕對季節 epoch") || !global.dom.includes("先把春分／節氣放回絕對均勻時間軸")) {
  throw new Error(`24000-year proof: first-hard-blocker explanation missing: ${global.url}`);
}
if (!global.dom.includes("zone convention") || !global.dom.includes("日界規則") || !global.dom.includes("clock basis")) {
  throw new Error(`24000-year proof: convention blockers missing: ${global.url}`);
}
console.log(`[day-hour-proof] PASS 24000-year proof remains blocked at absolute-seasonal-epoch: ${global.url}`);
