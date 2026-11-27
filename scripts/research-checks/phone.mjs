// Phone checks for the research view (390×844, touch). Each one is a problem
// that reached the user's phone before:
//  1. the top bar, logo and wheel sit where they do on the home
//  2. entering from the home, the needle never moves once the light is up
//  3. a real finger drag scrolls (scrollTo cannot catch a CSS scroll lock)
//
//   node scripts/research-checks/phone.mjs
import { BASE, launch, sleep, viewport } from "./cdp.mjs";

const b = await launch();
await viewport(b, 390, 844, { scale: 2 });
const box = sel => `(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? [r.left, r.top, r.width, r.height].map(Math.round).join(",") : "-"; })()`;
const layout = async () => ({ brand: await b.ev(box(".kinetic-topbar .brand")), topbar: await b.ev(box(".kinetic-topbar")), wheelTop: (await b.ev(box("#kinetic-instrument"))).split(",")[1] });
const needle = `(() => { const c = document.querySelector("#kinetic-wheel-over .cursor-cap, #kinetic-wheel .cursor-cap")?.getBoundingClientRect(); return c ? Math.round(c.left + c.width / 2) + (document.body.dataset.researchJumping ? " dim" : " lit") : "-"; })()`;
let failed = 0;
const check = (ok, what) => { console.log(ok ? "ok  " : "FAIL", what); if (!ok) failed++; };

await b.send("Page.navigate", { url: `${BASE}/` });
await sleep(6000);
const home = await layout();
const homeNeedle = parseInt(await b.ev(needle));

await b.ev(`document.querySelector('.site-nav [data-nav-role="research"]').click(), 1`);
const seen = [];
for (let i = 0; i < 60; i++) { await sleep(120); seen.push(await b.ev(needle)); if (await b.ev("!!globalThis.__research?.ready")) break; }
const lit = seen.filter(s => s.endsWith("lit")).map(s => parseInt(s));
check(lit.every(x => Math.abs(x - homeNeedle) <= 1), `needle stays at ${homeNeedle}px while lit on entry (${[...new Set(lit)].join(", ")})`);
await sleep(1000);
const research = await layout();
check(research.brand === home.brand && research.topbar === home.topbar && research.wheelTop === home.wheelTop,
  `top bar and wheel match the home (home ${JSON.stringify(home)} · research ${JSON.stringify(research)})`);

const swipe = async (y0, y1) => {
  await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: y0 }] });
  for (let k = 1; k <= 10; k++) { await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: y0 + (y1 - y0) * k / 10 }] }); await sleep(16); }
  await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const y0 = await b.ev("scrollY");
await swipe(650, 250); await sleep(2500);
const y1 = await b.ev("scrollY");
check(y1 > y0 + 200, `a finger drag scrolls (scrollY ${y0} → ${y1}, scene ${await b.ev("document.body.dataset.researchScene")})`);

b.close();
process.exit(failed ? 1 : 0);
