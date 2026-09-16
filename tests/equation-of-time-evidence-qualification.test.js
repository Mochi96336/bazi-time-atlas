import test from "node:test";
import assert from "node:assert/strict";
import {
  EQUATION_OF_TIME_EVIDENCE_KIND,
  EQUATION_OF_TIME_EVIDENCE_QUALIFICATION_CONTRACT,
  equationOfTimeEvidenceQualification
} from "../src/recurrence/equation-of-time-evidence-qualification.js";

function evidence(overrides = {}) {
  return {
    evidenceId:"test-evidence",
    evidenceKind:EQUATION_OF_TIME_EVIDENCE_KIND.MODERN_REFERENCE_DIFFERENTIAL,
    continuousUpperBound:false,
    ...overrides
  };
}

test("modern reference evidence cannot enter continuous boundary clearance", () => {
  const result = equationOfTimeEvidenceQualification(evidence());
  assert.equal(result.continuousUpperBound, false);
  assert.equal(result.continuousBoundaryClearanceEligible, false);
  assert.equal(result.requiresTargetBoundaryClearance, false);
  assert.equal(result.unconditionalEotAuthorityEligible, false);
  assert.equal(result.authorityGap, "reference-evidence-is-not-recurrence-validation");
});

test("empirical grid evidence stays non-continuous even if a caller-like object claims authority", () => {
  const result = equationOfTimeEvidenceQualification(evidence({
    evidenceKind:EQUATION_OF_TIME_EVIDENCE_KIND.EMPIRICAL_GRID_OBSERVED_PRODUCTION_MAX_ABS,
    recurrenceAuthority:true,
    observedMaxAbsErrorSeconds:1.4929317113205443
  }));
  assert.equal(result.continuousUpperBound, false);
  assert.equal(result.continuousBoundaryClearanceEligible, false);
  assert.equal(result.unconditionalEotAuthorityEligible, false);
  assert.equal(result.authorityGap, "empirical-grid-is-not-continuous-bound");
});

test("empirical and modern evidence fail closed if mislabeled as a continuous upper bound", () => {
  for (const evidenceKind of [
    EQUATION_OF_TIME_EVIDENCE_KIND.MODERN_REFERENCE_DIFFERENTIAL,
    EQUATION_OF_TIME_EVIDENCE_KIND.EMPIRICAL_GRID_OBSERVED_PRODUCTION_MAX_ABS
  ]) {
    assert.throws(
      () => equationOfTimeEvidenceQualification(evidence({ evidenceKind, continuousUpperBound:true })),
      /cannot claim a continuous upper bound/
    );
  }
});

test("non-zero continuous certified bound is boundary-clearance eligible but not unconditional authority", () => {
  const result = equationOfTimeEvidenceQualification(evidence({
    evidenceKind:EQUATION_OF_TIME_EVIDENCE_KIND.CONTINUOUS_CERTIFIED_UPPER_BOUND,
    continuousUpperBound:true,
    certifiedUpperBoundSeconds:1.6,
    certificationMethod:"interval-arithmetic-residual-envelope-v1"
  }));
  assert.equal(result.continuousUpperBound, true);
  assert.equal(result.continuousBoundaryClearanceEligible, true);
  assert.equal(result.requiresTargetBoundaryClearance, true);
  assert.equal(result.unconditionalEotAuthorityEligible, false);
  assert.equal(result.certifiedUpperBoundSeconds, 1.6);
  assert.equal(result.authorityGap, "nonzero-continuous-bound-requires-target-boundary-clearance");
});

test("only an exact-zero continuous certified EoT residual can skip EoT boundary clearance", () => {
  const result = equationOfTimeEvidenceQualification(evidence({
    evidenceKind:EQUATION_OF_TIME_EVIDENCE_KIND.CONTINUOUS_CERTIFIED_UPPER_BOUND,
    continuousUpperBound:true,
    certifiedUpperBoundSeconds:0,
    certificationMethod:"symbolic-equivalence-proof-v1"
  }));
  assert.equal(result.continuousBoundaryClearanceEligible, true);
  assert.equal(result.requiresTargetBoundaryClearance, false);
  assert.equal(result.unconditionalEotAuthorityEligible, true);
  assert.equal(result.authorityGap, null);
});

test("continuous certified evidence requires an explicit non-negative bound and certification method", () => {
  const base = {
    evidenceKind:EQUATION_OF_TIME_EVIDENCE_KIND.CONTINUOUS_CERTIFIED_UPPER_BOUND,
    continuousUpperBound:true,
    certifiedUpperBoundSeconds:1,
    certificationMethod:"interval-proof-v1"
  };
  assert.throws(
    () => equationOfTimeEvidenceQualification(evidence({ ...base, continuousUpperBound:false })),
    /continuousUpperBound=true/
  );
  assert.throws(
    () => equationOfTimeEvidenceQualification(evidence({ ...base, certifiedUpperBoundSeconds:-1 })),
    /certifiedUpperBoundSeconds/
  );
  assert.throws(
    () => equationOfTimeEvidenceQualification(evidence({ ...base, certifiedUpperBoundSeconds:Number.NaN })),
    /certifiedUpperBoundSeconds/
  );
  assert.throws(
    () => equationOfTimeEvidenceQualification(evidence({ ...base, certificationMethod:"" })),
    /certificationMethod/
  );
});

test("qualification contract separates continuous evidence from pillar authority", () => {
  const contract = EQUATION_OF_TIME_EVIDENCE_QUALIFICATION_CONTRACT;
  assert.equal(contract.registryEvidenceOnly, true);
  assert.equal(contract.empiricalGridCanGrantContinuousBound, false);
  assert.equal(contract.modernReferenceCanGrantContinuousBound, false);
  assert.equal(contract.continuousCertifiedBoundCanEnterBoundaryClearance, true);
  assert.equal(contract.nonzeroContinuousBoundRequiresTargetBoundaryClearance, true);
  assert.equal(contract.continuousBoundAloneDoesNotGrantPillarMembership, true);
  assert.equal(contract.otherUncertaintyChannelsRemainSeparate, true);
});
