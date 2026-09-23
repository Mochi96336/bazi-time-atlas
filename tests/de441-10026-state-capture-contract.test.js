import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DE441_10026_STATE_CAPTURE_CONTRACT } from "../src/astronomy/de441-10026-state-capture-contract.js";
import { DE441_10026_STATE_CAPTURE_EVIDENCE } from "../src/astronomy/de441-10026-state-capture-evidence.js";

test("10026 state capture is pinned to official DE441 part 2 and jplephem 2.24", () => {
  const c = DE441_10026_STATE_CAPTURE_CONTRACT;
  assert.equal(c.authority, "NASA/JPL NAIF");
  assert.equal(c.sourceEphemeris, "DE441");
  assert.equal(c.sourceKernel.filename, "de441_part-2.bsp");
  assert.equal(c.sourceKernel.officialMd5, "ad8dfa4e505ef0e3a5d587a5b4705632");
  assert.equal(c.sampler.library, "jplephem");
  assert.equal(c.sampler.version, "2.24");
  assert.equal(c.sampler.targetCatalogueYear, 10026);
});

test("10026 capture keeps state evidence separate from seasonal and production claims", () => {
  const c = DE441_10026_STATE_CAPTURE_CONTRACT;
  assert.equal(c.researchOnly, true);
  assert.equal(c.absoluteStateCaptured, true);
  assert.equal(c.stateInterpolationValidated, true);
  assert.equal(c.meanEclipticOfDateTransformResolved, false);
  assert.equal(c.apparentSeasonalCrossingResolved, false);
  assert.equal(c.productionIntegrated, false);
  assert.equal(c.sampler.referenceFrame, "ICRF");
  assert.equal(c.sampler.timeScale, "TDB");
  assert.equal(c.sampler.corrections, "NONE (geometric)");
});

test("10026 research workflow never uploads the 1.5 GB kernel", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/research-de441-state-capture-10026.yml", import.meta.url),
    "utf8"
  );
  assert.match(workflow, /de441_part-2\.bsp/);
  assert.match(workflow, /ad8dfa4e505ef0e3a5d587a5b4705632/);
  assert.match(workflow, /Remove large source kernel before artifact upload/);
  assert.match(workflow, /path: tmp\/de441-10026\/capture\//);
  assert.doesNotMatch(workflow, /path: tmp\/de441-10026\/$/m);
});

test("10026 capture preserves the same one-day Hermite budgets proven at 2026 and 4006", () => {
  const b = DE441_10026_STATE_CAPTURE_CONTRACT.interpolationValidation;
  assert.equal(b.method, "one-day cubic Hermite against withheld half-day DE441 states");
  assert.equal(b.earthMaxPositionErrorMeters, 125);
  assert.equal(b.earthMaxVelocityErrorMetersPerSecond, 0.00007);
  assert.equal(b.sunMaxPositionErrorMeters, 0.01);
  assert.equal(b.sunMaxVelocityErrorMetersPerSecond, 0.000000003);
});


test("successful run pins real 10026 DE441 state evidence without promoting a seasonal epoch", () => {
  const e = DE441_10026_STATE_CAPTURE_EVIDENCE;
  assert.equal(e.catalogueYear, 10026);
  assert.equal(e.sourceKernel.observedMd5, e.sourceKernel.officialMd5);
  assert.match(e.sourceKernel.observedSha256, /^[0-9a-f]{64}$/);
  assert.equal(e.researchRun.workflowRunId, 35929146374);
  assert.equal(e.researchRun.artifactId, 10780616042);
  assert.match(e.researchRun.artifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(e.capture.sha256, /^[0-9a-f]{64}$/);
  assert.equal(e.capture.dailySamples, 396);
  assert.equal(e.capture.withheldMidpointSamples, 395);
  assert.equal(e.interpolation.earth.sampleCount, 395);
  assert.ok(e.interpolation.earth.maxPositionErrorMeters < 100);
  assert.ok(e.interpolation.earth.maxVelocityErrorMetersPerSecond < 0.00006);
  assert.ok(e.interpolation.sun.maxPositionErrorMeters < 0.004);
  assert.ok(e.interpolation.sun.maxVelocityErrorMetersPerSecond < 0.000000002);
  assert.equal(e.promotionBoundary.absoluteStateCaptured, true);
  assert.equal(e.promotionBoundary.stateInterpolationValidated, true);
  assert.equal(e.promotionBoundary.meanEclipticOfDateTransformResolved, false);
  assert.equal(e.promotionBoundary.apparentSeasonalCrossingResolved, false);
  assert.equal(e.promotionBoundary.productionIntegrated, false);
});
