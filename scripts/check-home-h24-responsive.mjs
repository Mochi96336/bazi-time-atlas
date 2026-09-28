import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { MATERIAL_FIXED_INSTANT } from "./material-visual-contract.mjs";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const out = path.resolve("tmp/visual-check");
const mobileWidths = [320, 360, 390, 430, 480];
const widths = [...mobileWidths, 481]; // Verify media hand-off, not just mobile values.
const height = 844;

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const p = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding:"utf8" });
    if (p.status === 0 && p.stdout.trim()) return p.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome for responsive audit");
}
const browser = findBrowser();
const baseArgs = [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader-webgl", "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=5800", "--window-size=600,844"
];
function targetUrl(width, audit) {
  const params = new URLSearchParams({
    width:String(width), height:String(height), audit:audit ? "1" : "0",
    target:"../../?instant=" + MATERIAL_FIXED_INSTANT
  });
  return new URL("scripts/fixtures/home-h24-responsive.html?" + params, baseURL).href;
}
function runBrowser(args, url) {
  const result = spawnSync(browser, [...baseArgs, ...args, url], {
    encoding:args[0] === "--dump-dom" ? "utf8" : undefined,
    timeout:65_000, killSignal:"SIGKILL", maxBuffer:12 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr?.toString() ?? "");
    throw new Error("H2.4 Chromium failed at " + url + " with " + args[0]);
  }
  return result;
}
function attr(markup, key) {
  const result = markup.match(new RegExp("data-" + key + '="([^"]*)"'));
  return result?.[1] ?? "";
}
function checkProof(markup, width) {
  if (attr(markup, "ready") !== "true") {
    throw new Error("H2.4 fixture did not finish: " + width + "px; " + attr(markup, "error"));
  }
  if (attr(markup, "inner-width") !== String(width) ||
    attr(markup, "mobile") !== String(width <= 480)) {
    throw new Error("H2.4 measured incorrect iframe viewport at " + width + "px");
  }
  if (width === 481) {
    for (const name of ["desktop-dock-hidden", "desktop-readout-visible"]) {
      if (attr(markup, name) !== "true") throw new Error("481px breakpoint " + name + " failed");
    }
  } else {
    for (const name of [
      "initial-matches", "initial-visible", "same-row", "now-visible", "now-fits", "now-aligned", "no-overlap",
      "not-clipped", "input-usable", "dirty-hidden", "reapplied",
      "future-selected", "future-zodiac-changed", "future-caption-synced",
      "future-input-synced", "future-no-overlap",
      "classification-hidden", "analysis-hidden"
    ]) if (attr(markup, name) !== "true") {
      throw new Error("H2.4 " + width + "px failed " + name +
        " / input=" + attr(markup, "input-bounds") +
        " / caption=" + attr(markup, "caption-bounds") +
        " / now=" + attr(markup, "now-bounds") +
        " / rail=" + attr(markup, "rail-bounds"));
    }
    if (Math.abs(Number.parseFloat(attr(markup, "font-px")) - 12) > .25) {
      throw new Error("H2.4 " + width + "px did not preserve 12px physical caption");
    }
  }
  return {
    width, mobile:width <= 480, horizontalOverflow:attr(markup, "body-overflow") === "true",
    initialSign:attr(markup, "initial-zodiac"),
    railBounds:attr(markup, "rail-bounds") || null,
    inputBounds:attr(markup, "input-bounds") || null,
    captionBounds:attr(markup, "caption-bounds") || null,
    nowBounds:attr(markup, "now-bounds") || null,
    fontPx:attr(markup, "font-px") || null,
    dynamicSignSwitchPassed:width <= 480
  };
}
await mkdir(out, { recursive:true });
const matrix=[];
for (const width of widths) {
  // Mutations (dirty/apply/instant switch) stay in the DOM-only diagnostic.
  const probe = runBrowser(["--dump-dom"], targetUrl(width, true)).stdout;
  const measured = checkProof(probe, width);
  if (measured.horizontalOverflow && width <= 480) {
    throw new Error("H2.4 page has horizontal overflow at " + width + "px");
  }
  const file = "home-h24-ordinary-" + width + "x844.png";
  const location = path.join(out, file);
  runBrowser(["--screenshot=" + location], targetUrl(width, false));
  const info = await stat(location);
  if (info.size < 10_000) throw new Error("H2.4 " + width + "px screenshot too small");
  const sha256 = createHash("sha256").update(await readFile(location)).digest("hex");
  matrix.push({ ...measured, screenshot:file, bytes:info.size, sha256 });
  console.log("[home-h24] " + width + "px browser and PNG passed: " + info.size + " bytes");
}
const report = {
  kind:"home-h24-responsive-real-browser-audit",
  fixedInstantUtc:decodeURIComponent(MATERIAL_FIXED_INSTANT),
  originalProductionSha:"67e8a1980d1a2a202f40abc450aed7c497a6867e",
  method:"600px outer Chromium window hosting one genuine-width same-origin iframe; UI interactions via canonical selected-instant command",
  viewports:matrix,
  constraints:[
    "Image capture uses the unchanged fixed instant; DOM interaction proof is a separate launch.",
    "Computed geometry and 12px font size are structural checks, not a human legibility score.",
    "Review actual native-width crops at 320, 360, 390, 430, 480 and the 481px desktop breakpoint.",
    "This audit changes no production UI, phase/ephemeris model or material parameters."
  ]
};
await writeFile(path.join(out, "home-h24-responsive-evidence.json"),
  JSON.stringify(report, null, 2) + "\n", "utf8");
