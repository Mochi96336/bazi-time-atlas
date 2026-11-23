import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../site-nav.css", import.meta.url), "utf8");

test("atlas header has one current-view owner at every width", () => {
  assert.match(
    css,
    /\.kinetic-topbar \.site-nav a\[aria-current="page"\]\s*\{\s*display:\s*none;/,
    "the atlas brand should own current-view identity instead of repeating a self-link"
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width: 480px\)[^}]*\.kinetic-topbar \.site-nav a\[aria-current="page"\]/,
    "mobile shows the brand too, so it must not restore a second current-page owner"
  );
  assert.match(
    css,
    /\.kinetic-topbar \.site-nav a\.research-link\[data-nav-role="research"\]\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?min-height:\s*28px;[\s\S]*?padding:\s*0 2px;[\s\S]*?line-height:\s*1;/,
    "Research should keep one centered text/hitbox owner instead of a drifting baseline"
  );
  assert.match(
    css,
    /\.kinetic-topbar \.site-nav a\.research-link\[data-nav-role="research"\]::before\s*\{\s*display:\s*none;/,
    "the atlas Research exit should not retain a separator for a hidden sibling"
  );
});

test("mobile shows the BaZi Time Atlas brand like desktop", () => {
  const workspace = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
  const wheel = readFileSync(new URL("../atlas-wheel.css", import.meta.url), "utf8");
  assert.doesNotMatch(wheel, /\.kinetic-topbar \.brand\s*\{\s*display:\s*none/);
  assert.doesNotMatch(workspace, /\.brand[^{]*\{[^}]*display:\s*none/);
  assert.match(workspace, /\.kinetic-topbar \.brand, \.recurrence-topbar \.brand \{[^}]*display:\s*block/);
});
