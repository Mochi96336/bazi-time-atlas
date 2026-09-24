import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DE441_10026_SEASONAL_CROSSING_PROOF_CONTRACT } from "../src/astronomy/de441-10026-seasonal-crossing-proof-contract.js";
import { DE441_10026_SEASONAL_CROSSING_EVIDENCE } from "../src/astronomy/de441-10026-seasonal-crossing-evidence.js";

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

test("successful proof is pinned with all 24 source-derived TT crossings", () => {
  const evidence = DE441_10026_SEASONAL_CROSSING_EVIDENCE;
  assert.equal(evidence.validationKind, "source-derived-reconstruction");
  assert.equal(evidence.researchRun.pullRequest, 456);
  assert.equal(evidence.researchRun.workflowRunId, 35_941_704_369);
  assert.equal(evidence.researchRun.artifactId, 10_785_076_771);
  assert.equal(
    evidence.researchRun.artifactDigest,
    "sha256:b68b3d9d8fd2ca28f65d8d6d3f41dba93b674e2089478745e55fd83f582224dc"
  );
  assert.equal(evidence.terms.length, 24);
  assert.equal(new Set(evidence.terms.map(term => term.longitudeDegrees)).size, 24);
  assert.equal(evidence.proofResult.solvedCrossings, 24);
  assert.ok(evidence.proofResult.maxRootResidualArcsec < 0.001);
  assert.ok(evidence.proofResult.maxAlternateSeedParitySeconds < 0.02);
  const liChun = evidence.terms.find(term => term.longitudeDegrees === 315);
  assert.equal(liChun.name, "立春");
  assert.equal(liChun.ttJulianDay, 5383013.532143416);
  assert.equal(evidence.liChun.ttJulianDay, liChun.ttJulianDay);
});

test("pinned 10026 evidence remains explicitly weaker than independent 4006 truth", () => {
  const evidence = DE441_10026_SEASONAL_CROSSING_EVIDENCE;
  assert.equal(evidence.claimBoundary.independentTargetYearTruth, false);
  assert.equal(evidence.claimBoundary.sourceDerivedTargetYear, true);
  assert.equal(evidence.claimBoundary.frameIndependentlyValidatedAtTargetYear, false);
  assert.equal(evidence.claimBoundary.productionIntegrated, false);
  assert.equal(evidence.claimBoundary.productionAuthorityGranted, false);

  const contract = DE441_10026_SEASONAL_CROSSING_PROOF_CONTRACT;
  assert.equal(contract.proofResult.sourceDerivedSeasonalCrossingsGenerated, true);
  assert.equal(contract.proofResult.solvedCrossings, 24);
  assert.equal(contract.proofResult.evidenceId, evidence.id);
  assert.equal(contract.proofResult.liChunTtJulianDay, evidence.liChun.ttJulianDay);
  assert.equal(contract.claimBoundary.frameIndependentlyValidatedAtTargetYear, false);
});
