// Shared helper for the research checks: launch headless Chrome and talk CDP.
//
//   const b = await launch({ gpu: true });
//   await b.send("Page.navigate", { url });
//   const v = await b.ev("document.title");
//   b.close();
//
// Chrome: $CHROMIUM_BIN, else the usual install paths. Output goes to tmp/
// (git-ignored). The site must be served first: node scripts/research-checks/serve.mjs
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const BASE = process.env.RESEARCH_BASE || "http://127.0.0.1:4173";
export const OUT = path.resolve("tmp/research-checks");
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function chromePath() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  const known = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  ];
  const found = known.find(p => existsSync(p));
  if (!found) throw new Error("Chrome not found: set CHROMIUM_BIN");
  return found;
}

// gpu: true uses the real GPU (needed for frame timing; the default software
// renderer takes ~180 ms a frame regardless of what the page does).
export async function launch({ gpu = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(path.join(tmpdir(), "research-check-"));
  const flags = ["--headless=new", "--hide-scrollbars", "--disable-renderer-backgrounding", "--disable-background-timer-throttling",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`];
  flags.push(...(gpu ? ["--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]));
  const chrome = spawn(chromePath(), [...flags, "about:blank"]);
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch {}
  }
  if (!target) { chrome.kill(); throw new Error("Chrome did not start"); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => { ws.onopen = resolve; });
  let id = 0;
  const pending = {}, listeners = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method) listeners.forEach(fn => fn(m));
    if (pending[m.id]) { pending[m.id](m.result ?? m.error); delete pending[m.id]; }
  };
  const send = (method, params = {}) => new Promise(resolve => { pending[++id] = resolve; ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expression => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
  return {
    send, ev,
    on: fn => listeners.push(fn),
    close() { ws.close(); chrome.kill(); }
  };
}

// A phone (390×844 touch) or a desktop viewport.
export async function viewport(b, width, height, { mobile = width < 700, scale = 1 } = {}) {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
  await b.send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
}

// Open the research view and wait until it is ready.
export async function openResearch(b) {
  await b.send("Page.navigate", { url: `${BASE}/?view=research` });
  for (let i = 0; i < 120; i++) { await sleep(250); if (await b.ev("!!globalThis.__research?.ready")) return; }
  throw new Error("research view never became ready");
}

// Screenshot of what is on screen. (captureScreenshot's clip is in document
// coordinates: on a scrolled page the clip must start at scrollY, or the shot
// shows the empty top of the page.)
export async function screen(b, { scale = 1, format = "jpeg", quality = 60 } = {}) {
  const { w, h, y } = await b.ev("({ w: innerWidth, h: innerHeight, y: scrollY })");
  const r = await b.send("Page.captureScreenshot", { format, quality, clip: { x: 0, y, width: w, height: h, scale } });
  return Buffer.from(r.data, "base64");
}
