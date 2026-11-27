// 4K check: scroll the research view at 3840×2160 on the real GPU, record the
// screen, and count frames much darker than the median (missing GPU tiles show
// as a dark flash; see the 4K black flash notes). Also reports frame timing.
//
//   node scripts/research-checks/k4.mjs              from c13 to the end
//   node scripts/research-checks/k4.mjs sun .9 4     from scene sun, p .9, for 4 s
import { launch, openResearch, sleep, viewport } from "./cdp.mjs";

const [from = "c13", p = ".5", seconds = "9"] = process.argv.slice(2);
const b = await launch({ gpu: true });
await b.send("Page.enable");
await viewport(b, 3840, 2160, { mobile: false });
await openResearch(b);
await b.ev(`__research.jump(${JSON.stringify(from)}, ${Number(p)})`);
await sleep(2500);

const frames = [];
b.on(m => {
  if (m.method !== "Page.screencastFrame") return;
  frames.push(m.params.data);
  b.send("Page.screencastFrameAck", { sessionId: m.params.sessionId });
});
await b.send("Page.startScreencast", { format: "jpeg", quality: 40, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 });
// two screens a second, timed by the page's own frames
const gaps = await b.ev(`new Promise(res => { const gaps = []; let last = 0; const y0 = scrollY, t0 = performance.now();
  const f = t => { if (last) gaps.push(t - last); last = t; const k = (t - t0) / 1000; scrollTo(0, y0 + k * 2 * innerHeight);
    if (k < ${Number(seconds)}) requestAnimationFrame(f); else res(gaps); }; requestAnimationFrame(f); })`);
await b.send("Page.stopScreencast");
await sleep(300);

// mean luminance of each recorded frame, measured in the page itself
const lum = await b.ev(`Promise.all(${JSON.stringify(frames)}.map(d => new Promise(res => {
  const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = 96; c.height = 54;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, 96, 54); const px = x.getImageData(0, 0, 96, 54).data; let s = 0;
    for (let i = 0; i < px.length; i += 4) s += .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; res(s / (px.length / 4)); };
  img.src = "data:image/jpeg;base64," + d; })))`);
const median = [...lum].sort((a, z) => a - z)[lum.length >> 1];
const dark = lum.map((l, i) => [i, l]).filter(([, l]) => l < .6 * median);
gaps.sort((a, z) => a - z);
console.log(`4K from ${from}: ${gaps.length} frames, p50 ${gaps[gaps.length >> 1].toFixed(1)} ms, p90 ${gaps[Math.floor(gaps.length * .9)].toFixed(1)} ms`);
console.log(`${frames.length} recorded frames, ${dark.length} dark${dark.length ? ": " + dark.slice(0, 10).map(([i]) => i).join(", ") : ""}`);
b.close();
process.exit(dark.length ? 1 : 0);
