import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../site-nav.css", import.meta.url), "utf8");

test("desktop atlas header has one current-view owner", () => {
  assert.match(
    css,
    /@media \(min-width: 481px\)[\s\S]*?\.kinetic-topbar \.site-nav a\[aria-current="page"\]\s*\{\s*display:\s*none;/,
    "desktop atlas brand should own current-view identity instead of repeating a self-link pill"
  );
  assert.match(
    css,
    /\.kinetic-topbar \.site-nav a\.research-link\[data-nav-role="research"\]\s*\{[\s\S]*?margin-left:\s*0;[\s\S]*?padding-left:\s*0;/,
    "Research should remain as the single quiet desktop exit without orphaned separator spacing"
  );
  assert.match(
    css,
    /\.kinetic-topbar \.site-nav a\.research-link\[data-nav-role="research"\]::before\s*\{\s*display:\s*none;/,
    "desktop atlas Research exit should not retain a separator for a hidden sibling"
  );
});

test("mobile atlas keeps one typographic current-page owner without pill chrome", () => {
  const mobile = css.match(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/);
  assert.ok(mobile, "compact atlas navigation override must remain present");
  assert.match(
    mobile[1],
    /\.kinetic-topbar \.site-nav a\[aria-current="page"\]\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
    "mobile current-view identity should be text, not a dashboard pill"
  );
  assert.match(
    mobile[1],
    /\.kinetic-topbar \.site-nav a\[aria-current="page"\]\s*\{[\s\S]*?color:\s*var\(--accent\);/,
    "mobile current-view ink should use the neutral M2 accent instead of the retired green palette"
  );
  assert.match(
    mobile[1],
    /\.kinetic-topbar \.site-nav a\[aria-current="page"\]::after\s*\{[\s\S]*?bottom:\s*0;[\s\S]*?opacity:\s*\.72;/,
    "mobile current-view identity should retain one quiet active baseline"
  );
  assert.doesNotMatch(
    mobile[1],
    /a\[aria-current="page"\][^}]*display:\s*none;/s,
    "mobile must retain its current-page owner because the compact brand is hidden"
  );
  assert.doesNotMatch(
    mobile[1],
    /#d7e0da|#334c46/i,
    "compact atlas current-view styling must not reintroduce retired green ink"
  );
});
