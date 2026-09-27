import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  H25_INSTANTS, H25_REFERENCE_SHA, H25_VARIANTS, h25ExpectedColors
} from "./home-h25-color-contract.js";
import { decodePngRgb } from "./material-png-metrics.mjs";

// Isolated A0–A3 proof. A1–A3 are CSS-only. The legacy Zodiac GLSL tints
// remain unchanged in roughness mode BY DESIGN: this run diagnoses renderer
// disagreement; it does not assert cross-renderer color parity.
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check/home-h25");
const viewports = Object.freeze({
  320:{ width:320, height:844 }, 390:{ width:390, height:844 },
  1440:{ width:1440, height:900 }, 2047:{ width:2047, height:1038 }
});
function browserPath() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]) {
    const r = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding:"utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error("H2.5 requires real Chromium");
}
const browser = browserPath();
const args = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader-webgl", "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=7400"
];
function fixtureUrl({ variant, mode, width, instant, classification=false }) {
  const params = new URLSearchParams({
    variant, material:mode, width:String(width), height:String(viewports[width].height),
    instant, classification:classification ? "1" : "0"
  });
  return new URL("scripts/fixtures/home-h25-color-frame.html?" + params, baseURL).href;
}
function runBrowser({ variant, mode, width, instant, classification=false }, flag) {
  const url = fixtureUrl({ variant, mode, width, instant, classification });
  const browserWidth = Math.max(600, width);
  const result = spawnSync(browser, [
    ...args, "--window-size=" + browserWidth + "," + viewports[width].height, flag, url
  ], {
    encoding:flag === "--dump-dom" ? "utf8" : undefined,
    timeout:55_000, killSignal:"SIGKILL", maxBuffer:16 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr?.toString() ?? "");
    throw new Error("H2.5 browser failed: " + variant + "/" + mode + "/" + width + " (" + flag + ")");
  }
  return result;
}
function proofTag(markup) {
  const result = markup.match(/<output id="proof"[^>]*>/);
  if (!result) throw new Error("H2.5 fixture did not emit an output proof");
  return result[0];
}
function attribute(tag, name) {
  return tag.match(new RegExp("data-" + name + '="([^"]*)"'))?.[1] ?? "";
}
function probe(spec) {
  const tag = proofTag(runBrowser(spec, "--dump-dom").stdout);
  const { variant, mode, width, instant, classification=false } = spec;
  if (attribute(tag,"ready") !== "true") {
    throw new Error("H2.5 proof not ready " + JSON.stringify(spec) +
      " / " + attribute(tag,"error"));
  }
  const colors = h25ExpectedColors(variant);
  const expected = [colors.field, colors.raised, colors.zodiac].join(",");
  if (attribute(tag,"variant") !== variant || attribute(tag,"mode") !== mode ||
    attribute(tag,"palette") !== expected ||
    attribute(tag,"inner-width") !== String(width) ||
    attribute(tag,"instant-ms") !== String(Date.parse(instant)) ||
    attribute(tag,"untouched") !== "true" ||
    attribute(tag,"classification") !== String(classification) ||
    attribute(tag,"environment") !== H25_VARIANTS[variant].environment) {
    throw new Error("H2.5 proof state mismatch " + JSON.stringify(spec) + " / " + tag);
  }
  if (mode === "roughness" && attribute(tag,"material-active") !== "roughness") {
    throw new Error("H2.5 WebGL material never activated");
  }
  if (mode === "fallback" && (attribute(tag,"material-fallback") !== "forced" ||
    attribute(tag,"material-active") === "roughness")) {
    throw new Error("H2.5 forced fallback did not activate");
  }
  if (mode === "svg" && attribute(tag,"material-active") === "roughness") {
    throw new Error("H2.5 SVG baseline unexpectedly activated WebGL");
  }
  return {
    variant, mode, width, instant, selectedZodiac:attribute(tag,"selected-zodiac"),
    palette:attribute(tag,"palette"), environment:attribute(tag,"environment"),
    materialActive:attribute(tag,"material-active"),
    materialFallback:attribute(tag,"material-fallback"),
    classificationFill:attribute(tag,"classification-fill")
  };
}
async function screenshot(spec, proof, suffix="") {
  const stamp = spec.instant === H25_INSTANTS[0] ? "reference" : "changed-instant";
  const name = ["h25",spec.variant,spec.mode,spec.width + "x" + viewports[spec.width].height,stamp].join("-") + suffix + ".png";
  const file = path.join(outputDir, name);
  runBrowser(spec, "--screenshot=" + file);
  const bytes = await readFile(file), info = await stat(file);
  if (info.size < 10_000) throw new Error("H2.5 screenshot suspiciously small: " + name);
  const png = decodePngRgb(bytes), expectedWidth = Math.max(600, spec.width);
  if (png.width !== expectedWidth || png.height !== viewports[spec.width].height) {
    throw new Error("H2.5 screenshot unexpected image dimensions: " + name +
      " / " + png.width + "x" + png.height);
  }
  // The screenshot-process fixture has a red NOT READY strip at top-right.
  // Unlike a separate DOM probe, this checks that the capture itself was ready.
  const i = ((8 * png.width) + (png.width - 12)) * 3;
  const [r,g,b] = [png.rgb[i],png.rgb[i+1],png.rgb[i+2]];
  if (r > 110 && r > g * 1.5 && r > b * 1.5) {
    throw new Error("H2.5 screenshot captured before the fixture was ready: " + name);
  }
  console.log("[h25] " + name + " / " + info.size + " bytes");
  return {
    ...proof, file:name, imageWidth:png.width, nativeCropWidth:spec.width,
    height:png.height, bytes:info.size,
    sha256:createHash("sha256").update(bytes).digest("hex")
  };
}
await mkdir(outputDir, { recursive:true });
// Factorial four-way comparison under identical reference time and viewport.
// The SVG run isolates color; roughness intentionally retains old GLSL tints;
// fallback documents a forced no-WebGL outcome.
const matrix=[];
for (const variant of Object.keys(H25_VARIANTS)) {
  for (const mode of ["svg","roughness","fallback"]) {
    for (const width of [390,1440]) {
      matrix.push({ variant,mode,width,instant:H25_INSTANTS[0] });
    }
  }
}
// The B-series is a reduction study. B1 keeps the old field and changes
// ambient light only; B2 moves the field by a smaller amount than A1.
// B3 tests the B2 background with A2 Zodiac WITHOUT changing the shader.
// All 7 variants are captured in SVG, roughness and forced fallback.
// Edge-width baseline: do not infer native 320 or 2047 legibility from 390/1440.
for (const variant of ["A0","B2"]) for (const width of [320,2047]) {
  for (const mode of ["svg","roughness"]) {
    matrix.push({ variant,mode,width,instant:H25_INSTANTS[0] });
  }
}
// A new real instant ensures the experiment is not secretly pose-specific.
for (const variant of ["A0","A3","B2","B3"]) for (const mode of ["svg","roughness"]) {
  matrix.push({ variant,mode,width:390,instant:H25_INSTANTS[1] });
}
const captures=[];
for (const spec of matrix) captures.push(await screenshot(spec, probe(spec)));
// Classification has its OWN palette. Check a rendered categorical Zodiac sector,
// not merely the unchanged CSS token declaration.
const ordinary = probe({ variant:"A0",mode:"svg",width:390,instant:H25_INSTANTS[0],classification:true });
const candidate = probe({ variant:"A3",mode:"svg",width:390,instant:H25_INSTANTS[0],classification:true });
if (!ordinary.classificationFill || ordinary.classificationFill === "not-applicable" ||
  ordinary.classificationFill !== candidate.classificationFill) {
  throw new Error("H2.5 candidate changed Classification Zodiac semantic fill");
}
const referenceSpec = { variant:"A0",mode:"svg",width:1440,instant:H25_INSTANTS[0] };
const reference = captures.find(c => c.variant==="A0" && c.mode==="svg" &&
  c.width===1440 && c.instant===H25_INSTANTS[0]);
const replay = await screenshot(referenceSpec, probe(referenceSpec), "-replay");
// Do not silently attribute browser nondeterminism to a palette change.
const report = {
  kind:"h25-evidence-only-background-zodiac-factorial-and-restrained-field",
  pinnedProductionSha:H25_REFERENCE_SHA, fixedInstants:H25_INSTANTS,
  variants:H25_VARIANTS, baselineReplayIdentical:reference.sha256===replay.sha256,
  classificationUnchanged:{ baseline:ordinary.classificationFill, candidate:candidate.classificationFill },
  captures, replay:{ file:replay.file,sha256:replay.sha256 },
  constraints:[
    "A0 is unmodified production; A1–A3 and B1–B3 are same-origin CSS-only iframe overrides, never production file edits.",
    "B1 holds reference field constant and changes only environmental gradient; B2 modestly shifts the field; B3 pairs B2 with the unchanged A2 Zodiac color.",
    "Background is one grouped environment change: field, raised field and page gradient.",
    "SVG isolates color effects. Roughness intentionally keeps old independent GLSL Zodiac tints; any mismatch is diagnostic, not renderer parity.",
    "Screenshot readiness is checked from screenshot pixels; DOM proof cannot substitute for its screenshot-process geometry.",
    "For mobile images inspect the leftmost nativeCropWidth pixels of the wrapper PNG at original scale.",
    "Encoded screenshot RGB differences are descriptive, never an aesthetic score or color approval.",
    "Do not merge color values until full-size visual review and a separate GLSL/SVG parity gate."
  ]
};
await writeFile(path.join(outputDir,"h25-evidence.json"),JSON.stringify(report,null,2)+"\n","utf8");
console.log("[h25] completed "+captures.length+" screenshot conditions; baseline replay identical: "+report.baselineReplayIdentical);
