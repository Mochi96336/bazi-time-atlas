import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DE441_10026_SEASONAL_CROSSING_PROOF_CONTRACT } from "../src/astronomy/de441-10026-seasonal-crossing-proof-contract.js";

test("10026 seasonal-crossing proof keeps source-derived truth separate from independent validation", () => {
  const c = DE441_10026_SEASONAL_CROSSING_PROOF_CONTRACT;
  assert.equal(c.catalogueYear, 10026);
  assert.equal(c.sourceEphemeris, "DE441");
  assert.equal(c.requiredCrossings, 24);
  assert.equal(c.longitudeStepDegrees, 15);
  assert.deepEqual(c.frameProof.independentlyValidatedCatalogueYears, [4006]);
  assert.equal(c.frameProof.targetYearIndependentlyValidated, false);
  assert.equal(c.frameProof.sourceDerivedExtensionToTargetYear, true);
  assert.equal(c.claimBoundary.independentTargetYearTruth, false);
  assert.equal(c.claimBoundary.sourceDerivedTargetYear, true);
  assert.equal(c.claimBoundary.productionIntegrated, false);
  assert.equal(c.claimBoundary.productionAuthorityGranted, false);
  assert.equal(c.proofOnly, true);
});

test("proof consumes the exact pinned state capture from #450", () => {
  const c = DE441_10026_SEASONAL_CROSSING_PROOF_CONTRACT;
  assert.equal(c.sourceStateEvidence.researchPullRequest, 450);
  assert.equal(c.sourceStateEvidence.workflowRunId, 35_929_146_374);
  assert.equal(c.sourceStateEvidence.artifactId, 10_780_616_042);
  assert.equal(c.sourceStateEvidence.captureSha256, "d1f7c06152771ffa2db8538dd2807b7f8d4785114e20b6d5655ee7cf1b110481");
});

test("proof script reuses the repository state, apparent-direction and root-solver contracts", async () => {
  const source = await readFile(
    new URL("../scripts/research-solve-de441-10026-seasonal.mjs", import.meta.url),
    "utf8"
  );
  assert.match(source, /createDe441StateSegmentProofAdapter/);
  assert.match(source, /ttJulianDayToTdbJulianDay/);
  assert.match(source, /HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL/);
  assert.match(source, /solveSeasonalCrossingFromAbsoluteState/);
  assert.match(source, /OWEN_HORIZONS_FRAME_PROOF_CONTRACT/);
  assert.match(source, /independentTargetYearTruth:false/);
  assert.match(source, /sourceDerivedTargetYear:true/);
});

test("proof gates root stability without converting it into a production-authority claim", () => {
  const root = DE441_10026_SEASONAL_CROSSING_PROOF_CONTRACT.rootSolve;
  assert.equal(root.toleranceSeconds, 0.005);
  assert.equal(root.maxResidualArcsec, 0.001);
  assert.equal(root.alternateSeedParitySeconds, 0.02);
  assert.equal(root.maxBracketHalfWidthDays, 16);
});
