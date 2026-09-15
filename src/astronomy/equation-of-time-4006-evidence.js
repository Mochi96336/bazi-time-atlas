const SWISS_EPHEMERIS_FILES = Object.freeze([
  Object.freeze({
    filename:"sepl_18.se1",
    bodyClass:"planetary",
    coverage:"1800-2399 CE",
    sha256:"ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66"
  }),
  Object.freeze({
    filename:"semo_18.se1",
    bodyClass:"lunar",
    coverage:"1800-2399 CE",
    sha256:"1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7"
  }),
  Object.freeze({
    filename:"sepl_36.se1",
    bodyClass:"planetary",
    coverage:"3600-4199 CE",
    sha256:"3faeadb0f2c04d455ce8c5a853d007e9b445e1dc7b65a43389fc3d746b7b9bd0"
  }),
  Object.freeze({
    filename:"semo_36.se1",
    bodyClass:"lunar",
    coverage:"3600-4199 CE",
    sha256:"f4e89fb3f69a337249ccff96d3f565baa8986a7c15e44cba5676d5dbdf00dfaa"
  })
]);

/**
 * Pinned, research-derived validation evidence for the production Equation of
 * Time model in catalogue year 4006.
 *
 * This object deliberately records an observed sampled error envelope rather
 * than granting recurrence authority. The dense five-minute Swiss sweep is not
 * a mathematical global maximum proof, and a roughly 1.5-second model error
 * can still change an Hour pillar for a target arbitrarily close to a branch
 * boundary. Consumers must preserve that distinction.
 */
export const EQUATION_OF_TIME_4006_EVIDENCE = Object.freeze({
  schemaVersion:1,
  id:"atlas-eot-4006-observed-error-evidence-v1",
  modelId:"atlas-tyme-nrel-spa-v1",
  targetYear:4006,
  validationKind:"target-year-observed-error-envelope",
  clockQuantity:"equation-of-time",
  signConvention:"apparent-solar-time-minus-mean-solar-time",
  deterministic:false,
  recurrenceAuthorityGranted:false,
  civilTimeAuthority:false,
  futureUtcPolicyResolved:false,
  safeForUnconditionalHourResolution:false,
  requiresTargetBoundaryMarginCheck:true,

  swissComparison:Object.freeze({
    reference:"Swiss Ephemeris swe_time_equ(tjd_ut)",
    libraryVersion:"2.10.03",
    inputTimeScale:"UT",
    timeInterpretation:"astronomical UT / UT1-oriented research variable; not future UTC, leap-second, EOP, DST, or political-time authority",
    swiephRequiredForSunAndMoon:true,
    workflowRunId:35014458620,
    researchHeadSha:"7b42c266dee8fd4971c0f8bd4e31e8f8c75626c8",
    artifactId:10414623680,
    artifactDigest:"sha256:b21f11f54c7b5b6ba1175743449fbe4c717b7ae3518f4bfa79660e0d9f45f086",
    supersedesPreCorrectionArtifacts:true,
    ephemerisFiles:SWISS_EPHEMERIS_FILES,
    control2026:Object.freeze({
      cadenceMinutes:60,
      sampleCount:8760,
      alignedMaxAbsErrorSeconds:0.338112600247662,
      alignedRmsErrorSeconds:0.22422119779528032,
      productionMaxAbsErrorSeconds:0.3381102282259363
    }),
    target4006Hourly:Object.freeze({
      cadenceMinutes:60,
      sampleCount:8760,
      alignedMaxAbsErrorSeconds:1.2618362512413484,
      alignedRmsErrorSeconds:1.0568541245296355,
      alignedP99AbsErrorSeconds:1.2606160899852625,
      productionMaxAbsErrorSeconds:1.4929316033218143,
      productionRmsErrorSeconds:1.0857646109309682,
      productionP99AbsErrorSeconds:1.4911961260667894
    }),
    target4006Dense:Object.freeze({
      cadenceMinutes:5,
      sampleCount:105120,
      alignedMaxAbsErrorSeconds:1.261836410207735,
      alignedWorstSample:"4006-11-11T05:10:00",
      productionMaxAbsErrorSeconds:1.4929317113205443,
      productionRmsErrorSeconds:1.0857641824825877,
      productionP99AbsErrorSeconds:1.4912072952071753,
      productionWorstSample:"4006-10-10T07:45:00",
      sampledMaximumIsGlobalHardBound:false
    }),
    deltaT4006:Object.freeze({
      swissMinusProductionMinSeconds:1673.549897839106,
      swissMinusProductionMaxSeconds:1674.0641280745294,
      deltaTDrivenEotMaxAbsSeconds:0.5146870647749502
    })
  }),

  horizonsCrossingProof:Object.freeze({
    authority:"NASA/JPL Horizons",
    sourceEphemeris:"DE441",
    referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
    pullRequest:162,
    proofHeadSha:"28eb101e8bfcc0c2f5eb69ac292a544817b98966",
    sampleCount:24,
    longitudeStepDegrees:15,
    maxAbsErrorSeconds:1.312431,
    meanAbsErrorSeconds:1.073977,
    worstCrossing:Object.freeze({ name:"小寒", longitudeDegrees:285 }),
    acceptanceBudgetSeconds:5,
    productionRuntimeChanged:false,
    registryAuthorityChanged:false
  }),

  observedEnvelope:Object.freeze({
    targetYear:4006,
    largestObservedProductionAbsErrorSeconds:1.4929317113205443,
    denseCadenceMinutes:5,
    mathematicalGlobalBound:false,
    deterministic:false,
    use:"validation evidence only; target-specific boundary safety must be evaluated before Hour can resolve"
  }),

  note:"Independent Swiss full-year/dense sampling and Horizons crossing evidence agree at roughly the one-to-one-and-a-half second scale. This validates model quality for further bounded-error work but does not make year-4006 local-apparent-solar Hour deterministic."
});
