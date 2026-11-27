// Research view: how the scroll feels.
//
// Free scroll; when the reader stops near a stop the page settles onto it,
// biased hard toward the way they were going. Keys and taps move one stop at
// a time and SCRUB there (the rings turn), never cut. Reduced motion = cuts.
//
//   createScrollFeel({ stops, vh, body }) → { glideTo(px), destroy() }
//   stops(all) → stop positions in px, ascending (all: every settle stop)
//   vh()       → one screen of scroll in px (stable while the address bar moves)
//
// Measured on the prototype (docs/research-scenes-plan.md §8–9).

// A motor, not a tween: the scroll position has velocity.
// - start: an S-curve (two smoothing stages), no jolt;
// - cruise: a steady speed, so stepped scenes tick at an even rhythm;
// - brake: follows the braking curve exactly (never overshoots, never rocks
//   back), and the last stretch decays exponentially for a soft landing.
// A new target while moving keeps the current velocity: repeated key presses
// chain into one continuous motion instead of restarting.
export const MOTORS = Object.freeze({
  // vmax: screens/s · brake: screens/s² · tau: start smoothing (s) · land: final decay (s)
  key: Object.freeze({ vmax: .75, brake: 1.1, tau: .15, land: .28 }),
  settle: Object.freeze({ vmax: 1.1, brake: 2.6, tau: .08, land: .18 })
});

// One motor step (pure): position x and velocity v (px, px/s) with its first
// smoothing stage w, toward target, over dt seconds, for screen height H.
export function motorStep({ x, v, w }, target, m, dt, H) {
  const d = target - x, dist = Math.abs(d) / H;
  // long jumps (Home/End) may cruise faster, so they still take a few seconds
  const vmax = Math.max(m.vmax, dist / 5);
  const want = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * m.brake * dist), dist / m.land) * H;
  const k = 1 - Math.exp(-dt / m.tau);
  if (Math.abs(want) > Math.abs(v) && Math.sign(want) === Math.sign(v || want)) { w += (want - w) * k; v += (w - v) * k; }
  else { v = want; w = want; } // braking (or reversing) follows the curve directly
  return { x: x + v * dt, v, w };
}

// Where to settle (pure): stops ahead within AHEAD screens win; a stop behind
// pulls back only within BEHIND. dir = net movement since the last rest.
export const AHEAD = 1, BEHIND = .1;
export function settleTarget(stops, y, dir, H) {
  if (stops.some(s => Math.abs(s - y) < 2)) return null;
  const ahead = dir > 0 ? stops.find(s => s > y) : [...stops].reverse().find(s => s < y);
  const behind = dir > 0 ? [...stops].reverse().find(s => s < y) : stops.find(s => s > y);
  if (ahead !== undefined && Math.abs(ahead - y) <= H * AHEAD) return ahead;
  if (behind !== undefined && Math.abs(behind - y) <= H * BEHIND) return behind;
  return null;
}

// A clean tap (pure): moved < 10px, held < 0.3 s. Left quarter = back.
export const TAP_MOVE = 10, TAP_MS = 300, BACK_ZONE = .25;

export function createScrollFeel({ stops, vh, body = document.body, win = globalThis.window }) {
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
  const listen = new AbortController();
  const on = (type, fn, opts = {}) => win.addEventListener(type, fn, { ...opts, signal: listen.signal });
  let anim = null, touching = false, idle = 0, restY = win.scrollY, tap = null;
  const cancel = () => { if (anim) { win.cancelAnimationFrame(anim.raf); anim = null; } };

  function glide(to, kind) {
    if (reduce.matches) { cancel(); win.scrollTo(0, to); restY = to; return; }
    const m = MOTORS[kind];
    if (anim) { anim.target = to; anim.m = m; return; }
    anim = { x: win.scrollY, v: 0, w: 0, target: to, m, last: win.performance.now() };
    const step = now => {
      const a = anim; if (!a) return;
      // time-based: a slow frame rate makes the motion choppier, never slower
      const dt = Math.min(.25, (now - a.last) / 1000); a.last = now;
      Object.assign(a, motorStep(a, a.target, a.m, dt, vh()));
      if (Math.abs(a.target - a.x) < .5) { win.scrollTo(0, a.target); restY = a.target; anim = null; return; }
      win.scrollTo(0, a.x);
      a.raf = win.requestAnimationFrame(step);
    };
    anim.raf = win.requestAnimationFrame(step);
  }
  // far jumps (Home/End across many scenes) do not scrub the whole page:
  // a brief dim, the jump, and the light comes back.
  function fadeJump(to) {
    cancel();
    if (reduce.matches) { win.scrollTo(0, to); return; }
    body.dataset.researchJumping = "true";
    setTimeout(() => {
      win.scrollTo(0, to); restY = to;
      win.requestAnimationFrame(() => win.requestAnimationFrame(() => delete body.dataset.researchJumping));
    }, 210);
  }
  function settle() {
    if (touching || anim) return;
    const y = win.scrollY;
    const to = settleTarget(stops(true), y, y - restY < 0 ? -1 : 1, vh());
    if (to === null) restY = y; else glide(to, "settle");
  }
  function stepTo(dir) {
    const list = stops(false), y = anim ? anim.target : win.scrollY;
    let to;
    if (dir === "home") to = list[0];
    else if (dir === "end") to = list[list.length - 1];
    else if (dir > 0) to = list.find(s => s > y + 2) ?? list[list.length - 1];
    else to = [...list].reverse().find(s => s < y - 2) ?? list[0];
    if (Math.abs(to - win.scrollY) > vh() * 6) fadeJump(to); else glide(to, "key");
  }

  on("scroll", () => { if (anim) return; clearTimeout(idle); idle = setTimeout(settle, 160); }, { passive: true });
  // the reader's own input always wins over a glide in progress; a touch only
  // once it turns out to be a drag (a tap on a running glide chains instead)
  on("wheel", cancel, { passive: true });
  on("pointerdown", e => { if (e.pointerType !== "touch") cancel(); }, { passive: true });
  on("touchstart", e => {
    touching = true;
    const t = e.touches[0];
    tap = e.touches.length === 1 && !e.target.closest?.("a, button, input") ? { x: t.clientX, y: t.clientY, at: e.timeStamp } : null;
    if (!tap) cancel();
  }, { passive: true });
  on("touchmove", e => {
    const t = e.touches[0];
    if (tap && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > TAP_MOVE) { tap = null; cancel(); }
    else if (!tap) cancel();
  }, { passive: true });
  // (event timestamps: a busy frame must not turn a quick tap into a long press)
  on("touchend", e => {
    touching = false;
    if (tap && e.timeStamp - tap.at < TAP_MS) { stepTo(tap.x < win.innerWidth * BACK_ZONE ? -1 : 1); tap = null; return; }
    if (tap) cancel(); // a long press: just stop where we are
    tap = null;
    clearTimeout(idle); idle = setTimeout(settle, 220);
  }, { passive: true });
  on("keydown", e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea")) return;
    const next = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
    const prev = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (!next && !prev && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    stepTo(e.key === "Home" ? "home" : e.key === "End" ? "end" : next ? 1 : -1);
  });

  return {
    glideTo: to => glide(to, "key"),
    destroy() { cancel(); clearTimeout(idle); listen.abort(); delete body.dataset.researchJumping; }
  };
}
