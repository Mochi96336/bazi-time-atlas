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

test("mobile atlas keeps current-page navigation available", () => {
  const mobile = css.match(/@media \(max-width: 600px\) \{([\s\S]*)\}\s*$/);
  assert.ok(mobile, "shared mobile navigation override must remain present");
  assert.doesNotMatch(
    mobile[1],
    /a\[aria-current="page"\][^}]*display:\s*none;/s,
    "mobile must not inherit the desktop-only hidden current-page link"
  );
});
