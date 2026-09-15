export const EQUATION_OF_TIME_MODEL_ID = Object.freeze({
  ATLAS_TYME_NREL_SPA_V1:"atlas-tyme-nrel-spa-v1"
});

export const EQUATION_OF_TIME_MODEL_ID_VALUES = Object.freeze(Object.values(EQUATION_OF_TIME_MODEL_ID));

const MODEL_REGISTRY = Object.freeze({
  [EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1]:Object.freeze({
    modelId:EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1,
    implementation:"src/astronomy/equation-of-time.js",
    method:"tyme-apparent-sun+nrel-spa-a1",
    evidenceId:"nrel-spa-a5+usno-modern-differential-v1",
    referenceYears:Object.freeze([2003, 2005, 2024]),
    validationScope:"modern-reference-only",
    recurrenceValidatedYearRanges:Object.freeze([]),
    recurrenceAuthority:false,
    note:"The production EoT engine has modern reference/differential evidence, but no independently validated recurrence-era coverage is registered yet."
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

function binding(fields = {}) {
  return Object.freeze({
    bound:false,
    modelId:null,
    implementation:null,
    method:null,
    evidenceId:null,
    referenceYears:Object.freeze([]),
    validationScope:null,
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
 * Callers may select only a canonical `modelId`; they cannot supply their own
 * evidence id, validation interval, or authority boolean. This prevents a
 * finite EoT result (or an arbitrary object) from masquerading as proof that a
 * model is independently validated for a deep-time recurrence epoch.
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
  id:"recurrence-equation-of-time-model-binding-v2",
  canonicalModelIds:EQUATION_OF_TIME_MODEL_ID_VALUES,
  authorityOwnedByRegistry:true,
  callersCannotDeclareEvidence:true,
  callersCannotDeclareValidatedCoverage:true,
  rejectsBooleanPresenceClaims:true,
  finiteOutputAloneIsNotValidation:true,
  modelPresenceDoesNotImplyRecurrenceAuthority:true
});
