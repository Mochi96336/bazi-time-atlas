import test from "node:test";
import assert from "node:assert/strict";
import {
  validateApparentDirectionModel
} from "../src/astronomy/absolute-state-seasonal-solver.js";
import { HORIZONS_SUN_APPARENT_CORRECTION_EVIDENCE } from "../src/astronomy/horizons-sun-apparent-correction-evidence.js";
import { HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL } from "../src/astronomy/horizons-sun-apparent-direction-proof.js";
import { DE441_SEASONAL_EVENT_DATA_PROVIDER } from "../src/astronomy/de441-seasonal-event-data-product.js";
import { SEASONAL_EPOCH_PIPELINE, seasonalEpochSourceAudit } from "../src/recurrence/seasonal-epoch-source-audit.js";

const ARCSEC_PER_RADIAN = 206264.80624709636;
const DE441_EVENT_PROVIDER_ID = DE441_SEASONAL_EVENT_DATA_PROVIDER.id;

function unit(vector) {
  const magnitude = Math.hypot(...vector);
  return vector.map(value => value / magnitude);
}

function angularDistanceArcsec(a, b) {
  const x = unit(a);
  const y = unit(b);
  const cross = [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0]
  ];
  const dot = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  return Math.atan2(Math.hypot(...cross), dot) * ARCSEC_PER_RADIAN;
}

const PARITY_CASES = Object.freeze([
  Object.freeze({
    label:"2026-december",
    ltPositionAu:Object.freeze([-1.286562836524472e-2,-9.025284502484529e-1,-3.912239176114117e-1]),
    ltPlusSPositionAu:Object.freeze([-1.296488707703820e-2,-9.025272545777693e-1,-3.912233991720352e-1]),
    earthVelocityAuPerDay:Object.freeze([-1.747078506228411e-2,1.460282082392474e-4,6.332525040819500e-5])
  }),
  Object.freeze({
    label:"4006-march",
    ltPositionAu:Object.freeze([8.698584013933064e-1,-4.307339067458743e-1,-1.852191302185104e-1]),
    ltPlusSPositionAu:Object.freeze([8.698112723825419e-1,-4.308142851720214e-1,-1.852535160853027e-1]),
    earthVelocityAuPerDay:Object.freeze([-8.404704424668407e-3,-1.401085617832478e-2,-5.993679417423427e-3])
  })
]);

test("Sun apparent-correction evidence records the independent Horizons boundary", () => {
  const evidence = HORIZONS_SUN_APPARENT_CORRECTION_EVIDENCE;
  assert.equal(evidence.researchPullRequest, 109);
  assert.equal(evidence.researchWorkflowRunId, 34886473281);
  assert.equal(evidence.researchArtifactId, 10365660120);
  assert.equal(
    evidence.artifactDigest,
    "sha256:5bd8b2c448390034839d092e35ac28c3d82ec65007999423bf0fba6ada3e9bc8"
  );
  assert.ok(evidence.observerQ45VsLtPlusS.maxAngularResidualArcsec < 3e-6);
  assert.ok(evidence.stellarAberration.minLtVsLtPlusSArcsec > 20);
  assert.ok(evidence.stellarAberration.maxLtVsLtPlusSArcsec < 21);
  assert.ok(evidence.repositoryAberrationParity.maxRepoVsLtPlusSArcsec < 1e-6);
  assert.equal(evidence.promotionBoundary.sunCenterSelfDeflectionIdentityValidated, true);
  assert.equal(evidence.promotionBoundary.repositoryAberrationAgainstHorizonsValidated, true);
  assert.equal(evidence.promotionBoundary.productionSeasonalPipelineIntegrated, false);
});

test("Sun apparent-direction proof model satisfies the solver completeness contract explicitly", () => {
  const model = HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL;
  assert.equal(validateApparentDirectionModel(model), model);
  assert.equal(model.target, "Sun center");
  assert.equal(model.includesGravitationalDeflection, true);
  assert.equal(model.gravitationalDeflectionMode, "sun-center-evidence-bounded-identity");
  assert.ok(model.gravitationalDeflectionEvidenceMaxArcsec < 3e-6);
  assert.equal(model.includesStellarAberration, true);
  assert.equal(model.proofOnly, true);
  assert.equal(model.productionIntegrated, false);
});

test("repository aberration reproduces Horizons LT+S direction at modern and year-4006 samples", () => {
  for (const proofCase of PARITY_CASES) {
    const naturalDirectionIcrf = unit(proofCase.ltPositionAu);
    const expected = unit(proofCase.ltPlusSPositionAu);
    const actual = HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL.naturalToApparentIcrf({
      naturalDirectionIcrf,
      earth:{ velocityAuPerDay:proofCase.earthVelocityAuPerDay },
      sunObserverDistanceAu:Math.hypot(...proofCase.ltPositionAu)
    });
    const residualArcsec = angularDistanceArcsec(actual, expected);
    assert.ok(residualArcsec < 1e-6, `${proofCase.label}: ${residualArcsec} arcsec`);
  }
});

test("apparent-direction proof remains proof-only while the bounded direct runtime resolves year 4006", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterRuntimeCoverageById, {});
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.directEventProviderIds, [DE441_EVENT_PROVIDER_ID]);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "resolved");
  assert.equal(result.absoluteSeasonalEpochAvailable, true);
  assert.deepEqual(result.usableSourceIds, [DE441_EVENT_PROVIDER_ID]);
});
