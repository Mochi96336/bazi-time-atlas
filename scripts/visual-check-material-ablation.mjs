import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { MATERIAL_FIXED_INSTANT, MATERIAL_PROBE_NAMES, MATERIAL_PROBE_REGION } from "./material-visual-contract.mjs";
import { decodePngRgb, materialMasks, compareMaterialPng, readScreenshotCtm } from "./material-png-metrics.mjs";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const viewport = { width: 1440, height: 900 };
const maxDuration = 45_000;
const fixedArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader-webgl", "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=2600", "--window-size=1440,900"
];

function browserPath() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const found = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function runBrowser(browser, flag, url) {
  const result = spawnSync(browser, [...fixedArgs, flag, url], {
    encoding: flag === "--dump-dom" ? "utf8" : undefined,
    timeout: maxDuration, killSignal: "SIGKILL"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr?.toString() ?? "");
    throw new Error("Material evidence browser failed: " + flag + " " + url);
  }
  return result;
}

function probeUrl(name) {
  const params = new URLSearchParams({ material: "roughness", materialProbe: name });
  return new URL("?" + params.toString() + "&instant=" + MATERIAL_FIXED_INSTANT, baseURL).href;
}

function domSnapshot(browser, url) {
  return runBrowser(browser, "--dump-dom", url).stdout;
}

function baselineTransform(browser) {
  const dom = domSnapshot(browser, probeUrl("none"));
  if (!dom.includes('data-material-prototype="roughness"') || !dom.includes('data-material-probe="none"')) {
    throw new Error("Material probe did not activate roughness / baseline probe");
  }
  const match = dom.match(/data-material-probe-transform="([^"]+)"/);
  if (!match) throw new Error("Material evidence missing exact SVG screen CTM");
  const values = match[1].split(",").map(Number);
  if (values.length !== 6 || values.some(value => !Number.isFinite(value))) {
    throw new Error("Invalid captured SVG screen CTM");
  }
  // Invalid or implicit probe inputs must never activate a production diagnostic.
  for (const search of [
    "?material=roughness&materialProbe=unrecognized&instant=" + MATERIAL_FIXED_INSTANT,
    "?material=svg&materialProbe=solar-no-scratches&instant=" + MATERIAL_FIXED_INSTANT,
    "?material=roughness&instant=" + MATERIAL_FIXED_INSTANT
  ]) {
    const invalid = domSnapshot(browser, new URL(search, baseURL).href);
    if (invalid.includes('data-material-probe="')) {
      throw new Error("Material diagnostic activated without an explicit supported roughness probe");
    }
  }
  return values;
}

async function capture(browser, fileName, url) {
  const filePath = path.join(outputDir, fileName);
  runBrowser(browser, "--screenshot=" + filePath, url);
  const info = await stat(filePath);
  if (info.size < 10_000) throw new Error("material screenshot unexpectedly small: " + fileName);
  const bytes = await readFile(filePath);
  const png = decodePngRgb(bytes);
  if (png.width !== viewport.width || png.height !== viewport.height) {
    throw new Error("material screenshot viewport mismatch: " + fileName);
  }
  console.log("[material-ablation] " + fileName + ": " + info.size + " bytes");
  return { file: fileName, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: info.size, png };
}

await mkdir(outputDir, { recursive: true });
const browser = browserPath();
const domCtm = baselineTransform(browser);
const screenshots = [];
for (const name of MATERIAL_PROBE_NAMES) {
  screenshots.push({ name, ...await capture(browser, "material-probe-" + name + "-1440x900.png", probeUrl(name)) });
}
// Same URL, separate Chromium launch: reveal screenshot nondeterminism before
// attributing small pixel differences to a material feature.
const replay = await capture(browser, "material-probe-none-replay-1440x900.png", probeUrl("none"));
const defaultFile = path.join(outputDir, "material-roughness-1440x900.png");
const defaultPng = decodePngRgb(await readFile(defaultFile));
const baseline = screenshots[0];
// Screenshot-process CTM is the ONLY geometry authority for PNG pixel masks.
// --dump-dom is used solely as an independent diagnostic/mode-activation check.
const ctm = readScreenshotCtm(baseline.png);
for (const shot of screenshots.slice(1).concat(replay)) {
  const other = readScreenshotCtm(shot.png);
  if (other.some((value, index) => Math.abs(value - ctm[index]) > 0.001)) {
    throw new Error("Material screenshot geometry changed between ablations: " + shot.name);
  }
}
const { masks, counts } = materialMasks(viewport.width, viewport.height, ctm);
const metrics = {
  defaultVsExplicit: compareMaterialPng(defaultPng, baseline.png, masks.all),
  baselineReplay: compareMaterialPng(baseline.png, replay.png, masks.all),
  ablations: []
};
for (const shot of screenshots.slice(1)) {
  const region = MATERIAL_PROBE_REGION[shot.name];
  const outside = new Uint8Array(masks.all.length);
  for (let i = 0; i < outside.length; i += 1) outside[i] = masks.all[i] && !masks[region][i] ? 1 : 0;
  metrics.ablations.push({
    name: shot.name,
    region,
    inside: compareMaterialPng(baseline.png, shot.png, masks[region]),
    outside: compareMaterialPng(baseline.png, shot.png, outside),
    baselineNoiseInside: compareMaterialPng(baseline.png, replay.png, masks[region])
  });
}
const report = {
  kind: "material-ablation-evidence",
  instantUtc: decodeURIComponent(MATERIAL_FIXED_INSTANT),
  actualViewport: "1440x900",
  referenceCtm: ctm,
  independentDumpDomCtm: domCtm,
  dumpDomVsScreenshotCtm: ctm.map((value, index) => Number((domCtm[index] - value).toFixed(6))),
  regionPixels: counts,
  materialMode: "roughness",
  captures: [...screenshots, { name: "none-replay", ...replay }].map(({ png, ...meta }) => meta),
  metrics,
  notes: [
    "Scores are RGB-channel pixel differences, NOT a material-realism or beauty judgment.",
    "ROI authority is the CTM embedded by the screenshot process, NOT a separate dump-dom browser process.",
    "Canonical radii and the screenshot CTM define ROIs; nonmatching screenshot probes fail closed.",
    "Text/sector semantics remain in screenshots; inspect actual PNGs before aesthetic conclusions.",
    "Repeated baseline measures Chromium timing/raster noise. No minimum visible-change threshold is imposed.",
    "Run the pre-existing 2047/1440/390 SVG/roughness evidence matrix for fallback and responsive checks."
  ]
};
await writeFile(path.join(outputDir, "material-probe-evidence.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log("[material-ablation] evidence: " + JSON.stringify({
  baselineReplay: metrics.baselineReplay,
  probes: metrics.ablations.map(v => ({ name: v.name, inside: v.inside.meanAbsoluteRgb8,
    noise: v.baselineNoiseInside.meanAbsoluteRgb8, outside: v.outside.meanAbsoluteRgb8 }))
}));
