import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_EVIDENCE } from "../src/astronomy/equation-of-time-4006-evidence.js";
import { EQUATION_OF_TIME_MODEL_ID } from "../src/recurrence/equation-of-time-model-binding.js";

test("year-4006 EoT evidence pins corrected Swiss dense provenance", () => {
  const evidence = EQUATION_OF_TIME_4006_EVIDENCE;
  assert.equal(evidence.modelId, EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1);
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.validationKind, "target-year-observed-error-envelope");

  const swiss = evidence.swissComparison;
  assert.equal(swiss.workflowRunId, 35014458620);
  assert.equal(swiss.artifactId, 10414623680);
  assert.equal(
    swiss.artifactDigest,
    "sha256:b21f11f54c7b5b6ba1175743449fbe4c717b7ae3518f4bfa79660e0d9f45f086"
  );
  assert.equal(swiss.inputTimeScale, "UT");
  assert.equal(swiss.swiephRequiredForSunAndMoon, true);
  assert.equal(swiss.supersedesPreCorrectionArtifacts, true);
  assert.equal(swiss.ephemerisFiles.length, 4);
  for (const file of swiss.ephemerisFiles) assert.match(file.sha256, /^[0-9a-f]{64}$/);

  assert.equal(swiss.target4006Dense.cadenceMinutes, 5);
  assert.equal(swiss.target4006Dense.sampleCount, 105120);
  assert.equal(swiss.target4006Dense.alignedMaxAbsErrorSeconds, 1.261836410207735);
  assert.equal(swiss.target4006Dense.productionMaxAbsErrorSeconds, 1.4929317113205443);
  assert.equal(swiss.target4006Dense.sampledMaximumIsGlobalHardBound, false);
});

test("year-4006 EoT evidence pins independent Horizons crossing differential", () => {
  const proof = EQUATION_OF_TIME_4006_EVIDENCE.horizonsCrossingProof;
  assert.equal(proof.authority, "NASA/JPL Horizons");
  assert.equal(proof.sourceEphemeris, "DE441");
  assert.equal(proof.pullRequest, 162);
  assert.match(proof.proofHeadSha, /^[0-9a-f]{40}$/);
  assert.equal(proof.sampleCount, 24);
  assert.equal(proof.longitudeStepDegrees, 15);
  assert.equal(proof.maxAbsErrorSeconds, 1.312431);
  assert.equal(proof.meanAbsErrorSeconds, 1.073977);
  assert.deepEqual(proof.worstCrossing, { name:"小寒", longitudeDegrees:285 });
  assert.equal(proof.productionRuntimeChanged, false);
  assert.equal(proof.registryAuthorityChanged, false);
});

test("observed EoT error evidence cannot masquerade as deterministic Hour authority", () => {
  const evidence = EQUATION_OF_TIME_4006_EVIDENCE;
  assert.equal(evidence.deterministic, false);
  assert.equal(evidence.recurrenceAuthorityGranted, false);
  assert.equal(evidence.civilTimeAuthority, false);
  assert.equal(evidence.futureUtcPolicyResolved, false);
  assert.equal(evidence.safeForUnconditionalHourResolution, false);
  assert.equal(evidence.requiresTargetBoundaryMarginCheck, true);

  const envelope = evidence.observedEnvelope;
  assert.equal(envelope.mathematicalGlobalBound, false);
  assert.equal(envelope.deterministic, false);
  assert.equal(envelope.largestObservedProductionAbsErrorSeconds, 1.4929317113205443);
  assert.match(envelope.use, /boundary safety/);
});
