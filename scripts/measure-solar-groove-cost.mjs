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
          ready: typeof shell?.__h21MaterialDraw === "function",
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
      if (last.mode === "roughness" && last.probe === "none" && last.ready) {
        payload = last;
        break;
      }
    }
    await sleep(200);
  }
  if (!payload) throw new Error("CDP diagnostic draw hook unavailable: " + JSON.stringify(last));

  // The page process clocks were observed returning *zero* around gl.finish()
  // even in a live CDP session. External Node monotonic time is the authority:
  // each request batches six complete draws in exactly the same WebGL context.
  // RPC overhead is measured independently; high noise => inconclusive, never
  // pretend to have a precise GPU-only or real-device FPS measurement.
  const batchSize = 6;
  const pairs = 10;
  const median = xs => {
    const a = [...xs].sort((x, y) => x - y);
    return (a[4] + a[5]) / 2;
  };
  let dimensions = null;
  const timeBatch = async (probe, repeats = batchSize) => {
    const expression = `(() => {
      const shell = document.querySelector("#kinetic-instrument");
      if (!shell || typeof shell.__h21MaterialDraw !== "function") throw new Error("draw hook lost");
      let dimensions;
      for (let i = 0; i < ${repeats}; i++) dimensions = shell.__h21MaterialDraw(${probe});
      return dimensions;
    })()`;
    const start = process.hrtime.bigint();
    const result = await send("Runtime.evaluate", { expression, returnByValue: true });
    const ms = Number(process.hrtime.bigint() - start) / 1e6 / repeats;
    if (result.exceptionDetails || !Array.isArray(result.result?.value)) {
      throw new Error("CDP material draw batch failed");
    }
    dimensions = result.result.value;
    if (!Number.isFinite(ms) || ms <= 0) throw new Error("external monotonic measurement failed");
    return ms;
  };
  const rpc = [];
  for (let i = 0; i < 10; i++) {
    const start = process.hrtime.bigint();
    const result = await send("Runtime.evaluate", { expression: "42", returnByValue: true });
    if (result.result?.value !== 42) throw new Error("CDP control failed");
    rpc.push(Number(process.hrtime.bigint() - start) / 1e6 / batchSize);
  }
  for (let i = 0; i < 4; i++) {
    await timeBatch(7);
    await timeBatch(0);
  }
  const disabled = [], enabled = [];
  for (let i = 0; i < pairs; i++) {
    if (i % 2 === 0) {
      disabled.push(await timeBatch(7));
      enabled.push(await timeBatch(0));
    } else {
      enabled.push(await timeBatch(0));
      disabled.push(await timeBatch(7));
    }
  }
  // Restore the same explicit probe baseline after the diagnostic measurements.
  await timeBatch(0, 1);
  const off = median(disabled), on = median(enabled), baselineRpc = median(rpc);
  if (off <= 0 || on <= 0 || !Array.isArray(dimensions)
    || dimensions.some(n => !Number.isFinite(n) || n <= 1)) {
    throw new Error("invalid external CDP benchmark result");
  }
  const results = {
    kind:"h21-solar-groove-relative-draw-cost",
    instantUtc:decodeURIComponent(MATERIAL_FIXED_INSTANT),
    viewportRequested:"1440x900",
    sameGlContext:true,
    measurementBrowser:"Live CDP page; external Node process.hrtime.bigint around batched GPU-finish RPCs",
    roughnessWithScratchLightingMedianMs:Number(on.toFixed(5)),
    roughnessWithoutScratchLightingMedianMs:Number(off.toFixed(5)),
    withVsWithoutRatio:Number((on / off).toFixed(5)),
    rpcBaselinePerDrawMs:Number(baselineRpc.toFixed(5)),
    enabledSamplesMs:enabled.map(n => Number(n.toFixed(5))),
    disabledSamplesMs:disabled.map(n => Number(n.toFixed(5))),
    pairs,
    drawsPerSample:batchSize,
    canvasPx:dimensions,
    method:"Four warmup pairs, ten order-alternating pairs of six gl.finish-synchronized draws per CDP call; external monotonic Node clock.",
    limitations:[
      "Measured values include CDP RPC and CPU submission, plus software-renderer gl.finish wall time; NOT isolated GPU timer data.",
      "Any apparent improvement/regression comparable to RPC overhead or per-run spread is inconclusive.",
      "SwiftShader headless CI does not represent native GPU/device FPS. Benchmark the real device separately.",
      "Normal-zoom material quality must be reviewed using real PNGs; cost or pixel-change ratios are not aesthetic scores."
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
