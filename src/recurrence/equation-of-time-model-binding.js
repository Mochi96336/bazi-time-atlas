import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../astronomy/equation-of-time-4006-swiss-evidence.js";

export const EQUATION_OF_TIME_MODEL_ID = Object.freeze({
  ATLAS_TYME_NREL_SPA_V1:"atlas-tyme-nrel-spa-v1"
});

export const EQUATION_OF_TIME_MODEL_ID_VALUES = Object.freeze(Object.values(EQUATION_OF_TIME_MODEL_ID));

const SWISS_4006_DENSE = EQUATION_OF_TIME_4006_SWISS_EVIDENCE.target4006.dense;

const MODEL_REGISTRY = Object.freeze({
  [EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1]:Object.freeze({
    modelId:EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1,
    implementation:"src/astronomy/equation-of-time.js",
    method:"tyme-apparent-sun+nrel-spa-a1",
    evidenceId:"nrel-spa-a5+usno-modern-differential-v1",
    referenceYears:Object.freeze([2003, 2005, 2024]),
    validationScope:"modern-reference-only",
    targetResearchEvidence:Object.freeze([
      Object.freeze({
        year:4006,
        evidenceId:EQUATION_OF_TIME_4006_SWISS_EVIDENCE.id,
        evidenceKind:"empirical-grid-observed-production-max-abs",
        validationScope:"target-year-empirical-grid-only",
        cadenceMinutes:SWISS_4006_DENSE.cadenceMinutes,
        samples:SWISS_4006_DENSE.samples,
        observedMaxAbsErrorSeconds:SWISS_4006_DENSE.productionErrorSeconds.maxAbs,
        continuousUpperBound:false,
        recurrenceAuthority:false,
        authorityGap:"empirical-grid-is-not-continuous-bound"
      })
    ]),
    recurrenceValidatedYearRanges:Object.freeze([]),
    recurrenceAuthority:false,
    note:"The production EoT engine has modern reference evidence and separately pinned year-4006 empirical Swiss evidence, but neither grants recurrence authority; no validated recurrence year range is registered."
  })
});

function normalizeTargetYear(value) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value)) throw new RangeError("targetYear must be an integer year");
  return value;
}

function rangeCoversYear(range, year) {
  return year >= range.minYear && year <= range.maxYear;
}

function targetEvidenceForYear(record, year) {
  if (year === null) return null;
  if (record.referenceYears.includes(year)) {
    return Object.freeze({
      year,
      evidenceId:record.evidenceId,
      evidenceKind:"modern-reference-differential",
      validationScope:record.validationScope,
      continuousUpperBound:false,
      recurrenceAuthority:false,
      authorityGap:"reference-evidence-is-not-recurrence-validation"
    });
  }
  return record.targetResearchEvidence.find(item => item.year === year) ?? null;
}

function binding(fields = {}) {
  return Object.freeze({
    bound:false,
    modelId:null,
    implementation:null,
    method:null,
    evidenceId:null,
    referenceYears:Object.freeze([]),
    validationScope:null,
    targetEvidenceAvailable:false,
    targetEvidence:null,
    targetEvidenceAuthority:false,
    authorityGap:null,
    recurrenceValidatedYearRanges:Object.freeze([]),
    recurrenceAuthority:false,
    authoritySource:"registry",
    targetYear:null,
    coversTarget:false,
    validatedForTarget:false,
    usableForRecurrence:false,
    ...fields
  });
}

export const UNBOUND_EQUATION_OF_TIME_MODEL = binding();

/**
 * Bind a canonical Equation-of-Time model to registry-owned validation
 * authority for one recurrence target year.
 *
 * Target-year evidence presence is reported independently from recurrence
 * authority. A modern reference year or a dense empirical deep-time sweep may
 * therefore be visible to callers while `validatedForTarget` remains false.
 * This prevents useful research evidence from being mislabeled as "no model"
 * without upgrading a sampled residual into deterministic recurrence proof.
 *
 * Callers may select only a canonical `modelId`; they cannot supply their own
 * evidence id, validation interval, target-evidence metadata, or authority
 * boolean.
 */
export function equationOfTimeModelBinding(modelId = null, targetYear = null) {
  const normalizedTargetYear = normalizeTargetYear(targetYear);
  if (modelId === null || modelId === undefined) {
    return normalizedTargetYear === null
      ? UNBOUND_EQUATION_OF_TIME_MODEL
      : binding({ targetYear:normalizedTargetYear });
  }
  if (typeof modelId !== "string" || modelId.trim() === "") {
    throw new TypeError("equationOfTimeModelId must be a canonical non-empty string");
  }
  const canonicalId = modelId.trim();
  const record = MODEL_REGISTRY[canonicalId];
  if (!record) {
    throw new RangeError(`equationOfTimeModelId must be one of: ${EQUATION_OF_TIME_MODEL_ID_VALUES.join(", ")}`);
  }

  const targetEvidence = targetEvidenceForYear(record, normalizedTargetYear);
  const targetEvidenceAvailable = targetEvidence !== null;
  const coversTarget = normalizedTargetYear !== null
    && record.recurrenceValidatedYearRanges.some(range => rangeCoversYear(range, normalizedTargetYear));
  const validatedForTarget = record.recurrenceAuthority && coversTarget;

  return binding({
    bound:true,
    modelId:record.modelId,
    implementation:record.implementation,
    method:record.method,
    evidenceId:record.evidenceId,
    referenceYears:record.referenceYears,
    validationScope:record.validationScope,
    targetEvidenceAvailable,
    targetEvidence,
    targetEvidenceAuthority:targetEvidence?.recurrenceAuthority === true,
    authorityGap:targetEvidence?.authorityGap ?? null,
    recurrenceValidatedYearRanges:record.recurrenceValidatedYearRanges,
    recurrenceAuthority:record.recurrenceAuthority,
    targetYear:normalizedTargetYear,
    coversTarget,
    validatedForTarget,
    usableForRecurrence:validatedForTarget,
    note:record.note
  });
}

export const EQUATION_OF_TIME_MODEL_BINDING_CONTRACT = Object.freeze({
  id:"recurrence-equation-of-time-model-binding-v3",
  canonicalModelIds:EQUATION_OF_TIME_MODEL_ID_VALUES,
  authorityOwnedByRegistry:true,
  targetEvidenceMetadataOwnedByRegistry:true,
  callersCannotDeclareEvidence:true,
  callersCannotDeclareValidatedCoverage:true,
  callersCannotDeclareTargetEvidence:true,
  rejectsBooleanPresenceClaims:true,
  finiteOutputAloneIsNotValidation:true,
  targetEvidencePresenceDoesNotImplyRecurrenceAuthority:true,
  empiricalGridDoesNotImplyContinuousUpperBound:true,
  modelPresenceDoesNotImplyRecurrenceAuthority:true
});
