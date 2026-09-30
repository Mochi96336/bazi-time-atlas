import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app=readFileSync(new URL("../src/kinetic-atlas.js",import.meta.url),"utf8");
const drag=readFileSync(new URL("../src/wheel/ring-drag-controller.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../scale-emphasis.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");

test("native-4K transition guard defaults to the verified all mode and has a URL rollback",()=>{
  assert.match(app,/new URLSearchParams\(globalThis\.location\.search\)\s*\.get\("motionTransitionAudit"\)/);
  assert.match(app,/if \(motionTransitionAudit !== "off"\) \{/);
  assert.match(app,/svg\.dataset\.motionTransitionAudit =\s*motionTransitionAudit === "surfaces" \? "surfaces" : "all";/);
  assert.doesNotMatch(app,/svg\.dataset\.motionTransitionAudit = "off"/);
  assert.match(html,/href="\.\/scale-emphasis\.css"/);
});

test("active and coasting ownership both drive the *same* motion-only guard",()=>{
  assert.match(drag,/svg\.dataset\.activeRing = ring\.id/);
  assert.match(drag,/delete svg\.dataset\.activeRing/);
  assert.match(drag,/svg\.dataset\.coastingRing = gesture\.ringId/);
  assert.match(drag,/delete svg\.dataset\.coastingRing/);
  assert.match(css,/data-motion-transition-audit="all"\]:is\(\[data-active-ring\], \[data-coasting-ring\]\)/);
  assert.match(css,/data-motion-transition-audit="surfaces"\]:is\(\[data-active-ring\], \[data-coasting-ring\]\)/);
});

test("broad mode disables transitions only in the wheel, not filters, text, or unrelated controls",()=>{
  const broad=css.slice(css.indexOf('/* Native 4K hard-fling diagnostic:'));
  assert.match(broad,/#kinetic-wheel\[data-motion-transition-audit="all"\]:is\(\[data-active-ring\], \[data-coasting-ring\]\) \* \{\s*transition: none !important;/);
  assert.doesNotMatch(broad,/filter:\s*none/);
  assert.doesNotMatch(broad,/display:\s*none/);
  assert.doesNotMatch(broad,/animation:\s*none/);
  assert.doesNotMatch(broad,/\.control-button|\.timeline-dock|\.ring-legend-row/);
});

test("narrow mode includes every known transitioning SVG element class",()=>{
  const narrow=css.slice(css.indexOf('#kinetic-wheel[data-motion-transition-audit="surfaces"]'));
  for(const cls of [".cycle-sector",".term-sector",".zodiac-sector",".ring-tick",".term-mark",".cycle-label",".term-label",".zodiac-label"]) {
    assert.ok(narrow.includes(cls),cls);
  }
  assert.match(narrow,/transition: none !important;/);
});
