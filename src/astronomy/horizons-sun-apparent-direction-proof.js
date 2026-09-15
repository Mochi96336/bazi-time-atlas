import {
  ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
  aberrateNaturalDirection
} from "./absolute-state-seasonal-solver.js";
import { HORIZONS_SUN_APPARENT_CORRECTION_EVIDENCE } from "./horizons-sun-apparent-correction-evidence.js";

function assertEarthState(earth) {
  if (!earth || typeof earth !== "object"
    || !Array.isArray(earth.velocityAuPerDay)
    || earth.velocityAuPerDay.length !== 3
    || earth.velocityAuPerDay.some(value => !Number.isFinite(value))) {
    throw new TypeError("Earth barycentric velocity is required for stellar aberration");
  }
}

/**
 * Proof-only apparent-direction model for the Sun-center seasonal observable.
 *
 * Horizons observer quantity #45 includes light-time, solar gravitational
 * deflection and stellar aberration. For the Sun-center target, independent
 * Horizons LT+S vectors agree with quantity #45 to <= 3 microarcseconds across
 * 2026/4006 samples. The gravitational-deflection stage is therefore modeled
 * explicitly as an evidence-bounded identity for this target geometry only.
 * Stellar aberration is then applied by the existing SOFA-compatible routine,
 * whose output independently matches Horizons LT+S to <= 1 microarcsecond.
 */
export const HORIZONS_SUN_APPARENT_DIRECTION_PROOF_MODEL = Object.freeze({
  id:"horizons-sun-center-apparent-direction-proof",
  referenceSemantics:ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
  target:"Sun center",
  includesGravitationalDeflection:true,
  gravitationalDeflectionMode:"sun-center-evidence-bounded-identity",
  gravitationalDeflectionEvidenceMaxArcsec:
    HORIZONS_SUN_APPARENT_CORRECTION_EVIDENCE.observerQ45VsLtPlusS.maxAngularResidualArcsec,
  includesStellarAberration:true,
  stellarAberrationModel:"repo-sofa-compatible-eraAb-adaptation",
  proofOnly:true,
  productionIntegrated:false,
  evidence:HORIZONS_SUN_APPARENT_CORRECTION_EVIDENCE,
  naturalToApparentIcrf({ naturalDirectionIcrf, earth, sunObserverDistanceAu }) {
    assertEarthState(earth);
    return aberrateNaturalDirection({
      naturalDirection:naturalDirectionIcrf,
      observerBarycentricVelocityAuPerDay:earth.velocityAuPerDay,
      sunObserverDistanceAu
    });
  }
});
