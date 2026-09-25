import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MATERIAL_FIXED_INSTANT } from "./material-visual-contract.mjs";

// A real-running CDP page replaces Chrome --dump-dom: that command snapshots
// while performance.now may be frozen at zero, even without virtual-time-budget.
// Values are software-renderer CI wall measurements, NOT physical GPU FPS.
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const p = spawnSync("sh", ["-lc", "command -v " + candidate], { encoding:"utf8" });
    if (p.status === 0 && p.stdout.trim()) return p.stdout.trim();
  }
  throw new Error("No Chromium browser found");
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const userData = await mkdtemp(path.join(os.tmpdir(), "h21-cdp-"));
const browser = spawn(findBrowser(), [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader-webgl", "--window-size=1440,900",
  "--remote-allow-origins=*", "--remote-debugging-port=0",
  "--user-data-dir=" + userData, "about:blank"
], { stdio:"ignore" });

let websocket = null;
try {
  const portFile = path.join(userData, "DevToolsActivePort");
  const start = Date.now();
  let port = 0;
  while (Date.now() - start < 20_000) {
    if (browser.exitCode !== null) throw new Error("Chromium exited before CDP attached");
    try {
      const lines = (await readFile(portFile, "utf8")).trim().split("\n");
      port = Number(lines[0]);
      if (port > 0 && Number.isInteger(port)) break;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    await sleep(100);
  }
  if (!port) throw new Error("Chromium did not expose a CDP port");

  const deadline = Date.now() + 12_000;
  let target = null;
  while (Date.now() < deadline) {
    const res = await fetch("http://127.0.0.1:" + port + "/json/list");
    if (res.ok) {
      const pages = await res.json();
      target = pages.find(t => t.type === "page");
      if (target?.webSocketDebuggerUrl) break;
    }
    await sleep(120);
  }
  if (!target?.webSocketDebuggerUrl) throw new Error("CDP page target unavailable");

  websocket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CDP WebSocket open timeout")), 10_000);
    websocket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once:true });
    websocket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("CDP websocket open failed")); }, { once:true });
  });

  let nextId = 0;
  const pending = new Map();
  websocket.addEventListener("message", event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (!data.id) return;
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    clearTimeout(request.timeout);
    if (data.error) request.reject(new Error("CDP " + data.error.message));
    else request.resolve(data.result);
  });
  websocket.addEventListener("close", () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error("CDP disconnected"));
    }
    pending.clear();
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error("CDP " + method + " timed out")); }, 95_000);
    pending.set(id, { resolve, reject, timeout });
    websocket.send(JSON.stringify({ id, method, params }));
  });

  await send("Page.enable");
  await send("Runtime.enable");
  const url = new URL("?material=roughness&materialProbe=none&materialPerf=1&instant="
    + MATERIAL_FIXED_INSTANT, baseURL).href;
  await send("Page.navigate", { url });

  let payload = null, last = null;
  const stop = Date.now() + 105_000;
  while (Date.now() < stop) {
    const evaluation = await send("Runtime.evaluate", {
      expression: `(() => {
        const shell = document.querySelector("#kinetic-instrument");
        return JSON.stringify({
          mode: shell?.dataset.materialPrototype ?? null,
          probe: shell?.dataset.materialProbe ?? null,
          bench: shell?.dataset.materialBench ?? null,
          fallback: shell?.dataset.materialPrototypeFallback ?? null,
          error: shell?.dataset.materialPrototypeError ?? null,
          clock: performance.now()
        });
      })()`,
      returnByValue: true
    });
    if (evaluation.exceptionDetails) throw new Error("CDP page evaluation failed");
    const value = evaluation.result?.value;
    if (typeof value === "string") {
      last = JSON.parse(value);
      if (last.fallback || last.error) throw new Error("Material shader unavailable: " + JSON.stringify(last));
      if (last.mode === "roughness" && last.probe === "none" && last.bench) {
        payload = last;
        break;
      }
    }
    await sleep(200);
  }
  if (!payload) throw new Error("CDP real-time material benchmark never completed: " + JSON.stringify(last));
  if (!Number.isFinite(payload.clock) || payload.clock <= 0) {
    throw new Error("CDP browser clock is not advancing; reject benchmark");
  }

  const values = Object.fromEntries(payload.bench.split(";").map(item => item.split("=")));
  for (const key of ["offMs", "onMs", "ratio", "samples", "width", "height"]) {
    if (!Number.isFinite(Number(values[key]))) throw new Error("Invalid benchmark field: " + key);
  }
  if (Number(values.offMs) <= 0 || Number(values.onMs) <= 0 || Number(values.ratio) <= 0
    || Number(values.samples) !== 10 || Number(values.width) < 1 || Number(values.height) < 1) {
    throw new Error("Unusable CDP benchmark: " + JSON.stringify(values));
  }
  const results = {
    kind:"h21-solar-groove-relative-draw-cost",
    instantUtc:decodeURIComponent(MATERIAL_FIXED_INSTANT),
    viewportRequested:"1440x900",
    sameGlContext:true,
    measurementBrowser:"Live CDP page; no --dump-dom or virtual-time-budget",
    roughnessWithScratchLightingMedianMs:Number(values.onMs),
    roughnessWithoutScratchLightingMedianMs:Number(values.offMs),
    withVsWithoutRatio:Number(values.ratio),
    pairs:Number(values.samples),
    canvasPx:[Number(values.width), Number(values.height)],
    method:"Four warmup pairs then ten order-alternating pairs; performance.now() around draw+gl.finish in one context.",
    limitations:[
      "CPU submission plus software-renderer GPU-inclusive wall time, NOT isolated GPU shader execution.",
      "SwiftShader headless CI is not a user-device GPU; compare same-run relative costs only.",
      "Normal viewport material perception must be checked separately; no beauty score or auto-merge.",
      "Browser navigation and font load are excluded from the timed section."
    ]
  };
  await mkdir(path.resolve("tmp/visual-check"), { recursive:true });
  await writeFile(path.resolve("tmp/visual-check/solar-groove-draw-cost.json"),
    JSON.stringify(results, null, 2) + "\n", "utf8");
  console.log("[solar-groove-cost] " + JSON.stringify(results));
} finally {
  try { websocket?.close(); } catch {}
  browser.kill("SIGTERM");
  await sleep(350);
  if (browser.exitCode === null) browser.kill("SIGKILL");
  await rm(userData, { recursive:true, force:true, maxRetries:3, retryDelay:150 });
}
