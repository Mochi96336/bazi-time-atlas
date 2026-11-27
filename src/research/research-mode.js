// Research view: the home instrument, driven by scroll (docs/research-scenes-plan.md §9).
//
// The same page as the atlas. 研究 (or ./?view=research) turns the instrument
// into the research view: the home's own inputs rest, the page scrolls, and
// each scroll frame is a pure function of the scroll position (scroll-scenes.js)
// drawn through the renderer (ring poses) and scroll-overlay.js (marks).
import { researchHost } from "../kinetic-atlas.js";
import {
  BASE_MS, EXT, EXT_BEST, SCENES, SUN0, clamp, fmt, locate, signed, stopUnits, totalLength
} from "./scroll-scenes.js";
import { createScrollFeel } from "./scroll-feel.js";
import { createResearchOverlay } from "./scroll-overlay.js";
import { createOrbitPlate } from "./scroll-orbit.js";
import { RADII, WHEEL_CENTER } from "../wheel/ring-model.js";

const NS = "http://www.w3.org/2000/svg";
const body = document.body;
const { instrument, svg } = researchHost;
const $ = id => document.getElementById(id);
const ui = {
  root: $("research-ui"), scroll: $("research-scroll"), kicker: $("research-kicker"), copy: $("research-copy"),
  title: $("research-title"), text: $("research-body"), actions: $("research-actions"), hint: $("research-hint"),
  ledger: $("research-ledger"), orbit: $("research-orbit"), progress: $("research-progress"), back: $("research-back"), again: $("research-again"),
  fade: $("research-fade")
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
  const solar = b.solar - signed((st.band?.view ?? SUN0) - SUN0, 360);
  const pose = { hour: b.hour, month: b.month, year: b.year + (p?.year ?? 0), day: b.day + (p?.day ?? 0), solar };
  const key = `${pose.year.toFixed(3)}|${pose.day.toFixed(3)}|${solar.toFixed(3)}`;
  if (key === session.poseKey) return;
  session.poseKey = key;
  researchHost.renderPose(pose, session.lastPose);
  session.lastPose = pose;
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
  s.overlay.draw(sc.id, st, st.push ?? 0);
  s.orbit.draw(st.orbit, st.band);
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
    const breaks = t => (t ?? "").replace(/(\d) (?=年|天|小時)/g, "$1\u00a0").replace(/([，；：。、？）])(?!$)/g, "$1​");
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
  const host = ui.ledger, L = st.ledger, ladder = st.ladder;
  const plate = L ?? ladder;
  const o = plate ? plate.o ?? 1 : 0;
  setStyle(host, "opacity", String(o));
  setData(host, "ladder", ladder ? "" : null);
  const key = ladder ? "ladder" : L && o >= .01 ? JSON.stringify([L.title, L.poses.length, L.n, L.flag ?? "", LEDGER_ROWS.map(([r]) => Math.round((st.veil[r] ?? 0) * 100))]) : "";
  if (ladder) {
    if (key !== session.ledgerKey) session.ladder = createLadder(host);
    session.ledgerKey = key;
    session.ladder(ladder);
    return;
  }
  if (key === session.ledgerKey) return;
  session.ledgerKey = key;
  if (!key) { host.replaceChildren(); return; }
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

function createLadder(host) {
  host.replaceChildren();
  const add = (parent, name, attrs, word) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (word) node.textContent = word;
    parent.append(node);
    return node;
  };
  const x0 = 5, x1 = 288, base = 108, top = 38, clip = 160;
  const y = h => base - Math.min(h, clip) / clip * (base - top);
  add(host, "text", { class: "lg-head", x: 0, y: 12 }, "41 個候選 · 最大節氣差（小時）");
  add(host, "line", { class: "lg-base", x1: 0, y1: base, x2: x1 + 5, y2: base });
  add(host, "line", { class: "lg-ref", x1: 0, y1: y(24), x2: x1 + 8, y2: y(24) });
  add(host, "text", { class: "lg-ref-label", x: 322, y: y(24) + 5 }, "24");
  const bars = EXT.map((candidate, i) => {
    const x = x0 + (x1 - x0) * i / (EXT.length - 1);
    const group = add(host, "g", { visibility: "hidden" });
    const best = candidate === EXT_BEST;
    const bar = add(group, "line", { class: best ? "lg-rung best" : "lg-rung", x1: x, y1: base, x2: x, y2: y(candidate.maxAbs) });
    if (candidate.maxAbs > clip) add(group, "line", { class: "lg-rung cap", x1: x - 2, y1: top - 2, x2: x + 2, y2: top - 2 });
    if (best) {
      add(group, "circle", { class: "lg-best-dot", cx: x, cy: y(candidate.maxAbs) - 6, r: 3 });
      add(group, "text", { class: "lg-tick best lg-best-value", x: 0, y: 32 },
        `最小值 ${candidate.maxAbs.toFixed(1)} 小時`);
    }
    if (i === 0 || best || i === EXT.length - 1) {
      add(group, "text", { class: best ? "lg-tick best" : "lg-tick", x, y: base + 17,
        "text-anchor": i === 0 ? "start" : best ? "end" : "middle" }, `+${fmt(candidate.delta / 1000)}k`);
    }
    return { group, bar };
  });
  let shown = -1, selected = -1;
  return ({ upto, focus = Math.round(upto) }) => {
    const last = Math.round(upto);
    for (let i = Math.min(shown, last) + 1; i <= Math.max(shown, last); i++)
      bars[i].group.setAttribute("visibility", i <= last ? "visible" : "hidden");
    shown = last;
    if (selected === focus) return;
    bars[selected]?.bar.classList.remove("cur");
    bars[focus]?.bar.classList.add("cur");
    selected = focus;
  };
}

// ---------------------------------------------------------------- enter / leave
function measureLayout() {
  const s = session;
  s.vw = innerWidth;
  // big screens: the wheel grows with the window, so the words and figures
  // grow with it (1 up to ~1080p, ~2.2 at 4K); set once per layout, never per frame
  s.k = s.mobile ? 1 : Math.round(clamp(Math.min(innerWidth / 1600, innerHeight / 950), 1, 2.2) * 100) / 100;
  setStyle(body, "--rk", String(s.k));
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
  if (s.mobile) {
    const dayTop = m ? m.d * (WHEEL_CENTER.y - RADII.dayOuter) + m.f : 400;
    setStyle(ui.ledger, "--research-ledger-top", `${Math.round(dayTop - ui.ledger.getBoundingClientRect().height - 4)}px`);
  }
  instrument.style.transform = prev;
  insets.clear();
}

async function enter({ opening }) {
  if (session) return;
  const s = session = { ready: false, mobile: matchMedia("(max-width: 700px)").matches, sceneIndex: -1, poseKey: "", ledgerKey: "" };
  const animate = opening && !matchMedia("(prefers-reduced-motion: reduce)").matches;

  ui.root.hidden = false;
  for (let i = 0; session === s && i < 100 && !researchHost.isReady(); i++) await sleep(50);
  if (session !== s) return;

  let skipDial = false;
  let landed = false;
  if (animate) {
    s.entryInput = new AbortController();
    for (const type of ["wheel", "keydown", "pointerdown"])
      addEventListener(type, () => { skipDial = true; }, { passive: true, signal: s.entryInput.signal });
    body.dataset.researchEntrance = "";
    body.dataset.researchMasking = "";
    body.dataset.researchCopyWaiting = "";
    s.mask = ui.fade.animate({ opacity: [0, 1] }, { duration: 150, easing: "ease-in", fill: "forwards" });
    await s.mask.finished.catch(() => {});
    if (session !== s) return;
  }

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
  }
  researchHost.refreshCamera();
  // The static SVG layers copy the camera's viewBox in a MutationObserver.
  await Promise.resolve();
  if (session !== s) return;
  measureLayout();
  applyCamera({ pan: 0 });
  body.dataset.researchScene = "open0";
  setCopy(SCENES[0].state(0).copy, true, { scene: "open0" });
  ui.actions.hidden = true;
  ui.hint.classList.remove("gone");
  ui.hint.hidden = false;

  if (animate) {
    // Keep the reframe behind the mask. The wheel starts turning as the light
    // returns, and the caption comes in during the last part of that turn.
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (session !== s) return;
    s.entryInput.abort();
    s.mask.cancel();
    s.mask = ui.fade.animate({ opacity: [1, 0] }, { duration: 300, easing: "ease-out", fill: "forwards" });
    void s.mask.finished.then(() => {
      if (session !== s) return;
      delete body.dataset.researchMasking;
      s.mask.cancel();
      s.mask = null;
    }, () => {});
    if (!skipDial) {
      landed = await researchHost.dialTo(BASE_MS, "research-open", { onProgress: p => {
        if (p >= .68 && body.hasAttribute("data-research-copy-waiting")) delete body.dataset.researchCopyWaiting;
      } });
      if (session !== s) return;
    }
  }

  if (!landed) researchHost.commit(BASE_MS, "research");
  // the atlas writes its instant into the URL; the research view's address stays plain
  history.replaceState(history.state, "", "./?view=research");
  delete body.dataset.researchCopyWaiting;
  delete body.dataset.researchEntrance;
  s.base = researchHost.currentPose();
  s.monthTrack = svg.querySelector("#month-track");
  s.overlay = createResearchOverlay({ svg, mobile: s.mobile });
  s.overlay.measure(s.base, s.k);
  s.orbit = createOrbitPlate(ui.orbit);
  s.feel = createScrollFeel({ stops: stopsPx, vh: VH });
  s.ready = true;
  let queued = false;
  s.onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; frame(); }); } };
  addEventListener("scroll", s.onScroll, { passive: true });
  s.onResize = () => {
    if (s.mobile && innerWidth === s.vw) return; // the address bar only
    // phone ↔ desktop layout (a phone opened sideways, then turned upright):
    // the wide camera is set up on entry, so enter again
    if ((innerWidth < 700) !== s.mobile) { location.reload(); return; }
    vhPx = 0; ui.scroll.style.height = `${(totalLength() + 1) * VH()}px`;
    measureLayout(); s.overlay.measure(s.base, s.k); frame(true);
  };
  addEventListener("resize", s.onResize);
  frame(true);
}

async function leave({ toNow = true } = {}) {
  const s = session;
  if (!s) return;
  session = null;
  s.entryInput?.abort();
  s.mask?.cancel();
  s.feel?.destroy();
  removeEventListener("scroll", s.onScroll);
  removeEventListener("resize", s.onResize);
  s.overlay?.destroy();
  s.orbit?.destroy();
  clearTimeout(copyTimer); copyKey = copyWords = "";
  ui.root.hidden = true; ui.hint.hidden = true;
  ui.scroll.style.height = "0px";
  instrument.style.transform = ""; instrument.style.transformOrigin = "";
  s.monthTrack?.style.removeProperty("--research-month");
  delete instrument.dataset.researchGreg;
  delete instrument.dataset.cameraViewportWidth;
  for (const key of ["researchWide", "researchEntrance", "researchMasking", "researchCopyWaiting", "researchScene", "researchJumping"]) delete body.dataset[key];
  for (const a of researchLinks) a.removeAttribute("aria-current");
  for (const a of atlasLinks) { a.setAttribute("aria-current", "page"); a.classList.add("active"); }
  scrollTo(0, 0);
  delete body.dataset.view;
  delete document.documentElement.dataset.view;
  researchHost.setResearchView(false);
  researchHost.refreshCamera();
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
ui.again.addEventListener("click", () => session?.feel?.jumpTo(0));
addEventListener("popstate", () => {
  if (isResearchUrl() && !session) enter({ opening: false });
  else if (!isResearchUrl() && session) leave();
});
if (isResearchUrl()) enter({ opening: false });

// review hook (captures): jump to a scene position and redraw
globalThis.__research = {
  jump(id, p) {
    const i = SCENES.findIndex(sc => sc.id === id);
    const u = SCENES.slice(0, i).reduce((t, sc) => t + sc.length, 0) + SCENES[i].length * p;
    session?.feel?.jumpTo(Math.round(u * VH()));
    frame(true);
  },
  get ready() { return !!session?.ready; }
};
