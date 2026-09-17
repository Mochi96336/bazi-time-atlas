import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [evidenceCss, clockCss] = await Promise.all([
  readFile(new URL("../four-pillar-determinacy.css", import.meta.url), "utf8"),
  readFile(new URL("../recurrence-target-clock.css", import.meta.url), "utf8")
]);

test("inactive target-clock research controls do not reserve a full form", () => {
  assert.match(
    clockCss,
    /\.target-instant-controls\[data-enabled="false"\]\s+\.target-instant-fields\s*\{\s*display\s*:\s*none\s*;?\s*\}/
  );
  assert.match(
    clockCss,
    /\.target-instant-controls\[data-enabled="true"\]\s*>\s*p\s*\{\s*display\s*:\s*block\s*;?\s*\}/
  );
});

test("four-pillar and proof evidence use flat cells instead of nested cards", () => {
  assert.match(evidenceCss, /\.determinacy-card\s*\{[\s\S]*?min-height\s*:\s*0[\s\S]*?border-radius\s*:\s*0[\s\S]*?background\s*:\s*transparent/);
  assert.match(evidenceCss, /\.proof-chain-stage\s*\{[\s\S]*?min-height\s*:\s*0[\s\S]*?border-radius\s*:\s*0[\s\S]*?background\s*:\s*transparent/);
  assert.doesNotMatch(evidenceCss, /\.proof-chain-stage\s*\{[\s\S]*?border-radius\s*:\s*10px/);
});

test("proof-stage prose is reserved for actionable or uncertain states", () => {
  assert.match(evidenceCss, /\.proof-chain-stage p\s*\{\s*display\s*:\s*none/);
  for (const status of [
    "uncertain-estimate",
    "evidence-not-authoritative",
    "missing-deep-time-model",
    "missing-model",
    "unbound-convention",
    "conditional"
  ]) {
    assert.match(evidenceCss, new RegExp(`data-status="${status}"\\] p`));
  }
  assert.doesNotMatch(evidenceCss, /data-status="satisfied"\]\s+p\s*\{\s*display\s*:\s*block/);
  assert.doesNotMatch(evidenceCss, /data-status="blocked"\]\s+p\s*\{\s*display\s*:\s*block/);
});

test("source audit keeps facts visible while long notes stay target-relevant", () => {
  assert.match(evidenceCss, /\.epoch-audit-source\s*\{[\s\S]*?border-radius\s*:\s*0[\s\S]*?background\s*:\s*transparent/);
  assert.match(evidenceCss, /\.epoch-audit-source p\s*\{\s*display\s*:\s*none/);
  assert.match(evidenceCss, /data-qualified-coverage="true"\]\s+p[\s\S]*?data-covers-target="true"\]\s+p\s*\{\s*display\s*:\s*block/);
  assert.match(evidenceCss, /\.epoch-audit-facts\s*\{[\s\S]*?display\s*:\s*grid/);
});

test("phone evidence remains a compact two-column matrix instead of a serial card stack", () => {
  const phone = evidenceCss.slice(evidenceCss.lastIndexOf("@media (max-width:480px)"));
  assert.match(phone, /\.determinacy-grid\s*\{\s*grid-template-columns\s*:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(phone, /\.proof-chain-stages\s*\{\s*grid-template-columns\s*:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(phone, /\.proof-chain-foot\s*\{\s*grid-template-columns\s*:\s*1fr 1fr/);
  assert.match(phone, /\.epoch-audit-facts\s*\{\s*grid-template-columns\s*:\s*1\.2fr 1fr/);
});
