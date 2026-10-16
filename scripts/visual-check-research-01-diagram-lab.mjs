import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const directions = ["ladder","tracks","origin"];
const viewports = [
  { key:"1440x900", width:1440, height:900 },
  { key:"390x844", width:390, height:844 }
];

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]) {
    const probe = spawnSync("sh",["-lc","command -v " + candidate],{ encoding:"utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function browserArgs() {
  return [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=1800"
  ];
}

function runChromium(browser,args,label) {
  let last = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = spawnSync(browser,args,{
      encoding:"utf8",
      timeout:attempt === 1 ? 20_000 : 45_000,
      killSignal:"SIGKILL"
    });
    if (result.status === 0) return result;
    last = result;
  }
  process.stderr.write(last?.stdout ?? "");
  process.stderr.write(last?.stderr ?? "");
  throw new Error("Chromium failed for " + label);
}

function labPath(direction) {
  const anchor = {
    ladder:"ladder-title",
    tracks:"tracks-title",
    origin:"origin-title"
  }[direction];
  return "prototypes/research-01-diagram-lab.html?direction="
    + encodeURIComponent(direction)
    + "#" + anchor;
}

await mkdir(outputDir,{ recursive:true });
const browser = findBrowser();
const captures = [];

for (const direction of directions) {
  const pathName = labPath(direction);
  const url = new URL(pathName,baseURL).href;

  const dom = runChromium(browser,[
    ...browserArgs(),
    "--window-size=1440,900",
    "--dump-dom",
    url
  ],"diagram lab DOM " + direction).stdout;

  if (!dom.includes('data-diagram-lab-ready="true"')) {
    throw new Error("diagram lab did not become ready for " + direction);
  }
  if (!dom.includes('data-diagram-direction="' + direction + '"')) {
    throw new Error("diagram lab rendered the wrong direction for " + direction);
  }
  for (const required of ["+1,980","+24,000","Research 01 · diagram lab"]) {
    if (!dom.includes(required)) throw new Error("diagram lab missing " + required + " for " + direction);
  }

  if (direction === "ladder" && !dom.includes("不是找 1,980 的倍數")) {
    throw new Error("ladder lost its condition-tightening claim");
  }
  if (direction === "tracks" && !dom.includes("三個相位有沒有同時對線")) {
    throw new Error("tracks lost its alignment claim");
  }
  if (direction === "origin" && !dom.includes("公曆結構與十二節／八字月序不是同一系統")) {
    throw new Error("origin map lost its solar-origin claim");
  }

  for (const viewport of viewports) {
    const outputName = "research-01-diagram-" + direction + "-" + viewport.key + ".png";
    const outputPath = path.join(outputDir,outputName);
    runChromium(browser,[
      ...browserArgs(),
      "--window-size=" + viewport.width + "," + viewport.height,
      "--screenshot=" + outputPath,
      url
    ],"diagram lab screenshot " + direction + " " + viewport.key);

    const info = await stat(outputPath);
    if (info.size < 10_000) {
      throw new Error(outputName + " is unexpectedly small (" + info.size + " bytes)");
    }

    captures.push({
      direction,
      viewport:viewport.key,
      file:outputName,
      bytes:info.size,
      url
    });
    console.log("[research-01-diagram-lab] " + outputName + ": " + info.size + " bytes");
  }
}

await writeFile(
  path.join(outputDir,"research-01-diagram-lab-evidence.json"),
  JSON.stringify({ browser,baseURL,captures },null,2) + "\n",
  "utf8"
);