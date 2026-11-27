// Research view: the home instrument, driven by scroll (docs/research-scenes-plan.md §9).
//
// The same page as the atlas. 研究 (or ./?view=research) turns the instrument
// into the research view: the home's own inputs rest, the page scrolls, and
// each scroll frame is a pure function of the scroll position (scroll-scenes.js)
// drawn through the renderer (ring poses) and scroll-overlay.js (marks).
import { researchHost } from "../kinetic-atlas.js";
import {
  BASE_MS, SCENES, clamp, fmt, locate, signed, stopUnits, totalLength
} from "./scroll-scenes.js";
import { createScrollFeel } from "./scroll-feel.js";
import { createResearchOverlay } from "./scroll-overlay.js";
import { RADII, WHEEL_CENTER } from "../wheel/ring-model.js";

const NS = "http://www.w3.org/2000/svg";
const body = document.body;
const { instrument, svg } = researchHost;
const $ = id => document.getElementById(id);
const ui = {
  root: $("research-ui"), scroll: $("research-scroll"), kicker: $("research-kicker"), copy: $("research-copy"),
  title: $("research-title"), text: $("research-body"), actions: $("research-actions"), hint: $("research-hint"),
  ledger: $("research-ledger"), progress: $("research-progress"), back: $("research-back"), again: $("research-again")
};
const researchLinks = [...document.querySelectorAll('.site-nav [data-nav-role="research"]')];
const atlasLinks = [...document.querySelectorAll('.site-nav a:not([data-nav-role])')];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isResearchUrl = () => new URLSearchParams(location.search).get("view") === "research";

// Phones lay the instrument out 680px wide (the camera plans for that width)
// and pan across it, so the needle can sit near either edge.
const WIDE = 680;
let session = null;

// ---------------------------------------------------------------- geometry
// One "screen" of scroll in px: the large viewport, which does not change
// while a phone's address bar slides (measured once, again on rotation).
let vhPx = 0;
function VH() {
  if (!vhPx) {
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;top:0;left:0;width:1px;visibility:hidden;height:${CSS.supports("height", "100lvh") ? "100lvh" : "100vh"}`;
    body.append(probe);
    vhPx = probe.offsetHeight || innerHeight;
    probe.remove();
  }
  return vhPx;
}
const stopsPx = all => stopUnits(all).map(u => u * VH());

function setStyle(node, name, value) {
  if (!node) return;
  if (value === null) { if (node.style.getPropertyValue(name) !== "") node.style.removeProperty(name); }
  else if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}
function setData(node, key, value) {
  if (value === null) { if (key in node.dataset) delete node.dataset[key]; }
  else if (node.dataset[key] !== value) node.dataset[key] = value;
}

// ---------------------------------------------------------------- frame
function needleX(pan) {
  const s = session, lo = Math.max(46, s.vw - (s.frameW - s.capX)), hi = Math.min(s.vw - 46, s.capX);
  return pan < 0 ? s.vw / 2 + (lo - s.vw / 2) * -pan : s.vw / 2 + (hi - s.vw / 2) * pan;
}
// Phones: the caption leaves the needle's side free; the room is fixed per
// scene (the farthest the needle goes in it) and set with the words.
const insets = new Map();
function sceneInset(sc) {
  if (!session.mobile) return null;
  if (insets.has(sc.id)) return insets.get(sc.id);
  let pan = 0;
  for (const p of [.02, .5, .999]) { const st = sc.state(p); const v = st.pan ?? -(st.push ?? 0); if (Math.abs(v) > Math.abs(pan)) pan = v; }
  const x = needleX(pan);
  const inset = Math.abs(pan) < .5 ? null : pan < 0 ? { side: "left", px: Math.round(Math.max(0, x + 6)) } : { side: "right", px: Math.round(Math.max(0, session.vw - x + 6)) };
  insets.set(sc.id, inset);
  return inset;
}

function applyCamera(st) {
  const s = session;
  if (s.mobile) {
    const pan = st.pan ?? -(st.push ?? 0);
    // (the instrument's own left offset in the shell counts too)
    setStyle(instrument, "transform", `translateX(${(needleX(pan) - s.boxLeft - s.capX).toFixed(1)}px)`);
  }
  // Desktop keeps the camera still. (The prototype zoomed toward the gap in
  // 一 曆法; at 4K every scale step re-rasterises the whole wheel and tiles went
  // missing for a frame. The gap reads without it.)
}

function writePose(st) {
  const b = session.base;
  const p = st.manual ? st.pose : null;
  const pose = { hour: b.hour, month: b.month, year: b.year + (p?.year ?? 0), day: b.day + (p?.day ?? 0), solar: b.solar };
  const key = `${pose.year.toFixed(3)}|${pose.day.toFixed(3)}`;
  if (key === session.poseKey) return;
  session.poseKey = key;
  researchHost.renderPose(pose);
}

function frame(force = false) {
  const s = session;
  if (!s?.ready) return;
  // layout values are read before this frame writes anything (a read after a
  // write forces a second layout: measured as the costliest line of a frame)
  const sy = scrollY;
  const { index, p } = locate(sy / VH());
  const sc = SCENES[index], st = sc.state(p);
  writePose(st);
  setData(instrument, "researchGreg", st.greg ? "" : null);
  // (on the month ring only: a variable on the instrument would restyle every ring)
  setStyle(s.monthTrack, "--research-month", String(st.greg ? clamp(1 - st.greg * 1.6) : 1));
  applyCamera(st);
  s.overlay.draw(st, st.push ?? 0);
  drawLedger(st);
  setCopy(st.copy, force, { scene: sc.id === "open0" || sc.id === "end" ? sc.id : "", panned: s.mobile && !!st.wide, inset: sceneInset(sc) });
  ui.actions.hidden = !st.end;
  ui.hint.classList.toggle("gone", sy > 24);
  setData(body, "researchScene", sc.id);
  if (index !== s.sceneIndex || force) {
    s.sceneIndex = index;
    [...ui.progress.children].forEach((n, i) => n.classList.toggle("on", i === index));
  }
}

// ---------------------------------------------------------------- caption
let copyKey = "", copyWords = "", copyTimer = 0;
function setCopy(copy, force, layout) {
  const look = `${layout.scene}|${layout.panned ? "p" : ""}|${layout.inset ? layout.inset.side + layout.inset.px : ""}`;
  const key = copy ? `${copy.kicker}|${copy.title}|${copy.body}|${look}` : `|${look}`;
  if (key === copyKey && !force) return;
  // the words (and the caption's own layout) fade out and back when the title,
  // the body or the layout changes; a kicker-only change is written at once
  const words = copy ? `${copy.title}|${copy.body}|${look}` : `|${look}`;
  const swap = words !== copyWords;
  copyKey = key; copyWords = words;
  const write = () => {
    // lines break only after punctuation or at spaces (keep-all)
    const breaks = t => (t ?? "").replace(/([，；：。、？）])(?!$)/g, "$1​");
    ui.kicker.textContent = copy?.kicker ?? "";
    ui.title.textContent = breaks(copy?.title);
    ui.text.textContent = breaks(copy?.body);
    setData(ui.copy, "scene", layout.scene || null);
    ui.copy.toggleAttribute("data-panned", layout.panned);
    ui.copy.style.paddingLeft = layout.inset?.side === "left" ? `${layout.inset.px}px` : "";
    ui.copy.style.paddingRight = layout.inset?.side === "right" ? `${layout.inset.px}px` : "";
    ui.copy.classList.remove("swapping");
  };
  clearTimeout(copyTimer);
  if (swap && !force) { ui.copy.classList.add("swapping"); copyTimer = setTimeout(write, 180); } else write();
}

// ---------------------------------------------------------------- ledger
// 一 曆法: one row per ring; each step leaves a bar whose height is how far that
// ring's start is from the needle (signed, as a share of its cycle).
const LEDGER_ROWS = [["year", "年序", "yearSequence", 60, "年"], ["greg", "公曆", "gregorian", 400, "年"], ["day", "日序", "day", 60, "天"]];
function drawLedger(st) {
  const host = ui.ledger, L = st.ledger, o = L ? (L.o ?? 1) : 0;
  setStyle(host, "opacity", String(o));
  const key = L && o >= .01 ? JSON.stringify([L.title, L.poses.length, L.n, L.flag ?? "", LEDGER_ROWS.map(([r]) => Math.round((st.veil[r] ?? 0) * 100))]) : "";
  if (key === session.ledgerKey) return;
  session.ledgerKey = key;
  if (!key) { host.replaceChildren(); return; }
  if (session.mobile) setStyle(host, "top", `${Math.round(session.dayTop - host.getBoundingClientRect().height - 4)}px`);
  const g = document.createElementNS(NS, "g");
  const el = (parent, name, attrs = {}, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    parent.append(n); return n;
  };
  const x0 = 46, x1 = 262, dx = (x1 - x0) / Math.max(1, L.n - 1), k = L.poses.length - 1;
  el(g, "text", { class: "lg-head", x: 0, y: 12 }, `${L.title} · 第 ${Math.max(0, k)} 步 · +${fmt(L.poses[k]?.delta ?? 0)} 年`);
  LEDGER_ROWS.forEach(([ring, name, phase, n, unit], row) => {
    const y = 46 + row * 38;
    const rowG = el(g, "g", { opacity: clamp(1 - (st.veil[ring] ?? 0) * 1.3, .28, 1) });
    el(rowG, "text", { class: "lg-name", x: 0, y: y + 4 }, name);
    el(rowG, "line", { class: "lg-base", x1: x0 - 4, y1: y, x2: x1 + 4, y2: y });
    L.poses.forEach((ps, i) => {
      const off = signed(ps.state.phases[phase], n), x = x0 + i * dx, cur = i === k;
      if (off === 0) el(rowG, "circle", { class: cur ? "lg-zero cur" : "lg-zero", cx: x, cy: y, r: cur ? 3.6 : 2.6 });
      else el(rowG, "line", { class: cur ? "lg-bar cur" : "lg-bar", x1: x, y1: y, x2: x, y2: y - off / (n / 2) * 15 });
    });
    const off = k >= 0 ? signed(L.poses[k].state.phases[phase], n) : 0;
    const flag = L.flag === ring && off !== 0;
    el(rowG, "text", { class: off === 0 ? "lg-val zero" : flag ? "lg-val gap" : "lg-val", x: 320, y: y + 4 }, off === 0 ? "回到起點" : `差 ${Math.abs(off)} ${unit}`);
  });
  host.replaceChildren(...g.childNodes);
}

// ---------------------------------------------------------------- enter / leave
function measureLayout() {
  const s = session;
  s.vw = innerWidth;
  const prev = instrument.style.transform;
  instrument.style.transform = "";
  const box = instrument.getBoundingClientRect();
  const cap = document.querySelector("#kinetic-wheel-over .cursor-cap, #kinetic-wheel .cursor-cap")?.getBoundingClientRect();
  s.frameW = box.width;
  s.boxLeft = box.left;
  s.capX = cap ? cap.left + cap.width / 2 - box.left : box.width / 2;
  const capY = cap ? cap.top + cap.height / 2 - box.top : box.height / 2;
  instrument.style.transformOrigin = `${s.capX}px ${capY}px`;
  const m = svg.getScreenCTM();
  s.dayTop = m ? m.d * (WHEEL_CENTER.y - RADII.dayOuter) + m.f : 400;
  instrument.style.transform = prev;
  insets.clear();
}

async function enter({ opening }) {
  if (session) return;
  const s = session = { ready: false, mobile: innerWidth < 700, sceneIndex: -1, poseKey: "", ledgerKey: "" };
  // input during the opening cuts it short: the reader does not wait
  let skip; const skipped = new Promise(resolve => { skip = resolve; });
  const inputs = ["touchstart", "wheel", "keydown", "pointerdown"];
  for (const type of inputs) addEventListener(type, skip, { passive: true, once: true });

  ui.root.hidden = false;
  for (let i = 0; i < 100 && !researchHost.isReady(); i++) await sleep(50);
  // Phones change layout on the way in (the home's controls leave, the wide
  // camera comes in): all of it happens under one short dim, centred before
  // the light returns, so the wheel never jumps in view.
  if (s.mobile && opening) { body.dataset.researchJumping = "true"; await sleep(220); }
  document.documentElement.dataset.view = body.dataset.view = "research";
  researchHost.setResearchView(true);
  for (const a of researchLinks) a.setAttribute("aria-current", "page");
  for (const a of atlasLinks) { a.removeAttribute("aria-current"); a.classList.remove("active"); }
  ui.scroll.style.height = `${(totalLength() + 1) * VH()}px`;
  ui.progress.replaceChildren(...SCENES.map(() => document.createElement("i")));
  scrollTo(0, 0);
  if (s.mobile) {
    instrument.dataset.cameraViewportWidth = String(WIDE);
    body.dataset.researchWide = "";
    await sleep(opening ? 700 : 400);
    measureLayout();
    applyCamera({ pan: 0 });
    await sleep(60);
    delete body.dataset.researchJumping;
  }
  if (opening) {
    body.dataset.researchEntering = "";
    ui.kicker.textContent = "研究 · 撥到 2026 年 9 月 13 日 下午 3 點";
    await Promise.race([sleep(350), skipped]);
    await Promise.race([researchHost.dialTo(BASE_MS, "research-open"), skipped]);
  }
  researchHost.commit(BASE_MS, "research");
  // the atlas writes its instant into the URL; the research view's address stays plain
  history.replaceState(history.state, "", "./?view=research");
  for (const type of inputs) removeEventListener(type, skip);
  await sleep(80);
  if (session !== s) return;
  body.dataset.researchEntered = "";
  s.base = researchHost.currentPose();
  s.monthTrack = svg.querySelector("#month-track");
  measureLayout();
  s.overlay = createResearchOverlay({ svg, mobile: s.mobile });
  s.overlay.measure(s.base);
  s.feel = createScrollFeel({ stops: stopsPx, vh: VH });
  s.ready = true;
  let queued = false;
  s.onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; frame(); }); } };
  addEventListener("scroll", s.onScroll, { passive: true });
  s.onResize = () => {
    if (innerWidth === s.vw) return; // the address bar only
    vhPx = 0; ui.scroll.style.height = `${(totalLength() + 1) * VH()}px`;
    measureLayout(); s.overlay.measure(s.base); frame(true);
  };
  addEventListener("resize", s.onResize);
  frame(true);
  setTimeout(() => { ui.hint.hidden = false; }, opening ? 900 : 0);
}

async function leave({ toNow = true } = {}) {
  const s = session;
  if (!s) return;
  session = null;
  s.feel?.destroy();
  removeEventListener("scroll", s.onScroll);
  removeEventListener("resize", s.onResize);
  s.overlay?.destroy();
  clearTimeout(copyTimer); copyKey = copyWords = "";
  ui.root.hidden = true; ui.hint.hidden = true;
  ui.scroll.style.height = "0px";
  instrument.style.transform = ""; instrument.style.transformOrigin = "";
  s.monthTrack?.style.removeProperty("--research-month");
  delete instrument.dataset.researchGreg;
  delete instrument.dataset.cameraViewportWidth;
  for (const key of ["researchWide", "researchEntering", "researchEntered", "researchScene", "researchJumping"]) delete body.dataset[key];
  for (const a of researchLinks) a.removeAttribute("aria-current");
  for (const a of atlasLinks) { a.setAttribute("aria-current", "page"); a.classList.add("active"); }
  scrollTo(0, 0);
  delete body.dataset.view;
  delete document.documentElement.dataset.view;
  researchHost.setResearchView(false);
  if (toNow) {
    await researchHost.dialTo(Date.now(), "now");
    // back to the plain atlas address (it follows the live clock again)
    if (!isResearchUrl()) history.replaceState(history.state, "", "./");
  }
}

// ---------------------------------------------------------------- wiring
for (const a of researchLinks) {
  a.href = "./?view=research";
  a.addEventListener("click", event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (session) return;
    history.pushState({ view: "research" }, "", "./?view=research");
    enter({ opening: true });
  });
}
for (const a of atlasLinks) a.addEventListener("click", event => {
  if (!session || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  history.pushState({}, "", "./");
  leave();
});
ui.back.addEventListener("click", () => { history.pushState({}, "", "./"); leave(); });
ui.again.addEventListener("click", () => scrollTo(0, 0));
addEventListener("popstate", () => {
  if (isResearchUrl() && !session) enter({ opening: false });
  else if (!isResearchUrl() && session) leave();
});
if (isResearchUrl()) enter({ opening: true });

// review hook (captures): jump to a scene position and redraw
globalThis.__research = {
  jump(id, p) {
    const i = SCENES.findIndex(sc => sc.id === id);
    const u = SCENES.slice(0, i).reduce((t, sc) => t + sc.length, 0) + SCENES[i].length * p;
    scrollTo(0, Math.round(u * VH()));
    frame(true);
  },
  get ready() { return !!session?.ready; }
};
