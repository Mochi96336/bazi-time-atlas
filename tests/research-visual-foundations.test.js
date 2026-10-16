import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [css,html] = await Promise.all([
  readFile(new URL("../research-foundations.css", import.meta.url), "utf8"),
  readFile(new URL("../recurrence.html", import.meta.url), "utf8")
]);

test("Research visual foundations load before presentation styles", () => {
  const foundation = html.indexOf('href="./research-foundations.css"');
  const tasks = html.indexOf('href="./research-tasks.css"');
  const calibration = html.indexOf('href="./research-color-calibration.css"');

  assert.ok(foundation > 0, "Research foundation stylesheet must be linked");
  assert.ok(tasks > foundation, "task presentation must load after foundations");
  assert.ok(calibration > foundation, "legacy color calibration must load after foundations during migration");
});

test("Research visual foundations define the shared semantic vocabulary", () => {
  for (const token of [
    "--research-bg-page",
    "--research-bg-layer-1",
    "--research-bg-layer-2",
    "--research-text-primary",
    "--research-text-secondary",
    "--research-text-muted",
    "--research-line-subtle",
    "--research-line-strong",
    "--research-current",
    "--research-candidate",
    "--research-unresolved",
    "--research-danger",
    "--research-focus",
    "--research-diagram-surface",
    "--research-diagram-structure",
    "--research-diagram-context",
    "--research-diagram-active-current",
    "--research-diagram-active-candidate",
    "--research-diagram-unresolved",
    "--research-type-display",
    "--research-type-section",
    "--research-type-subsection",
    "--research-type-body",
    "--research-type-compact",
    "--research-type-meta",
    "--research-type-plot",
    "--research-width-narrative",
    "--research-width-visual"
  ]) {
    assert.ok(css.includes(token + ":"), "missing foundation token: " + token);
  }
});

test("Research foundation type and width floors match the visual constitution", () => {
  assert.match(css,/--research-type-body:\s*\.9375rem;/);   // 15 px
  assert.match(css,/--research-type-compact:\s*\.875rem;/); // 14 px
  assert.match(css,/--research-type-meta:\s*\.75rem;/);     // 12 px
  assert.match(css,/--research-type-plot:\s*\.6875rem;/);   // 11 px
  assert.match(css,/--research-width-narrative:\s*860px;/);
  assert.match(css,/--research-width-visual:\s*1280px;/);
});

test("Research foundations stay token-only and do not own component geometry", () => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g,"");
  const selectors = [...withoutComments.matchAll(/(^|\})\s*([^@{}][^{}]*)\{/g)]
    .map(match => match[2].trim())
    .filter(Boolean);

  assert.deepEqual(selectors,[":root"]);
  assert.doesNotMatch(css,/\.(research|recurrence|seasonal|determinacy|proof|near)-[a-z0-9_-]+\s*\{/i);
});

function tokenHex(name) {
  const match = css.match(new RegExp(name + String.raw`:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, "missing hex token: " + name);
  return match[1];
}

function relativeLuminance(hex) {
  const rgb = [1,3,5].map(i => Number.parseInt(hex.slice(i,i+2),16) / 255);
  const linear = rgb.map(channel =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a,b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
}

test("Research foundation colors keep readable contrast on the brightest dark layer", () => {
  const layer = tokenHex("--research-bg-layer-2");
  const required = new Map([
    ["--research-text-primary",7],
    ["--research-text-secondary",7],
    ["--research-text-muted",4.5],
    ["--research-current",4.5],
    ["--research-candidate",4.5],
    ["--research-unresolved",4.5],
    ["--research-danger",4.5],
    ["--research-focus",7]
  ]);

  for (const [token,minimum] of required) {
    const ratio = contrastRatio(tokenHex(token),layer);
    assert.ok(ratio >= minimum, token + " contrast " + ratio.toFixed(2) + " is below " + minimum);
  }
});
