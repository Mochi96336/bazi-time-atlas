export const EQUATION_OF_TIME_4006_SWISS_EVIDENCE = Object.freeze({
  id:"swiss-ephemeris-eot-4006-dense-v2",
  purpose:"independent full-output Equation-of-Time differential for recurrence-era validation",
  productionModelId:"atlas-tyme-nrel-spa-v1",
  productionMethod:"tyme-apparent-sun+nrel-spa-a1",
  reference:Object.freeze({
    authority:"Swiss Ephemeris / Astrodienst",
    libraryVersion:"2.10.03",
    function:"swe_time_equ(tjd_ut)",
    deltaTFunction:"swe_deltat_ex(tjd_ut, FLG_SWIEPH)",
    signConvention:"local-apparent-time-minus-local-mean-time",
    sampleTimeScale:"astronomical UT / UT1-oriented independent variable",
    equationInputTimeScale:"UT",
    calendar:"proleptic Gregorian",
    futureUtcPolicyClaim:false,
    note:"Year-4006 sample labels are astronomical UT-like arguments. They do not predict future UTC, leap seconds, EOP, DST, or political civil time. Sun and Moon SWIEPH use was verified at every research sample before evaluating swe_time_equ()."
  }),
  provenance:Object.freeze({
    researchPullRequest:160,
    researchHeadSha:"7b42c266dee8fd4971c0f8bd4e31e8f8c75626c8",
    workflowRunId:35014458620,
    workflowRunNumber:11,
    artifactId:10414623680,
    artifactDigest:"sha256:b21f11f54c7b5b6ba1175743449fbe4c717b7ae3518f4bfa79660e0d9f45f086",
    artifactName:"eot-swiss-4006-comparison",
    supersedesInvalidResearchRun:Object.freeze({
      workflowRunId:35013985750,
      artifactId:10414404236,
      reason:"The superseded helper incorrectly fed ET/TT into swe_time_equ(); Swiss source and swetest use a UT argument."
    })
  }),
  ephemerisFiles:Object.freeze([
    Object.freeze({ year:2026, bodyClass:"planetary", filename:"sepl_18.se1", coverage:"1800-2399 CE", sha256:"ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66" }),
    Object.freeze({ year:2026, bodyClass:"lunar", filename:"semo_18.se1", coverage:"1800-2399 CE", sha256:"1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7" }),
    Object.freeze({ year:4006, bodyClass:"planetary", filename:"sepl_36.se1", coverage:"3600-4199 CE", sha256:"3faeadb0f2c04d455ce8c5a853d007e9b445e1dc7b65a43389fc3d746b7b9bd0" }),
    Object.freeze({ year:4006, bodyClass:"lunar", filename:"semo_36.se1", coverage:"3600-4199 CE", sha256:"f4e89fb3f69a337249ccff96d3f565baa8986a7c15e44cba5676d5dbdf00dfaa" })
  ]),
  control2026:Object.freeze({
    cadenceMinutes:60,
    samples:8760,
    alignedErrorSeconds:Object.freeze({
      maxAbs:0.338112600247662,
      rms:0.22422119779528032,
      p95Abs:0.3283588421758843,
      p99Abs:0.3370792189210192,
      worst:Object.freeze({ year:2026, month:2, day:8, hour:15, minute:0, second:0 })
    }),
    productionErrorSeconds:Object.freeze({
      maxAbs:0.3381102282259363,
      rms:0.22422103198657528,
      p99Abs:0.33707844859801384
    }),
    productionDeltaTContributionToEotSeconds:Object.freeze({ maxAbs:0.0000664020272933552 })
  }),
  target4006:Object.freeze({
    hourly:Object.freeze({
      cadenceMinutes:60,
      samples:8760,
      alignedErrorSeconds:Object.freeze({
        maxAbs:1.2618362512413484,
        rms:1.0568541245296355,
        p99Abs:1.2606160899852625,
        worst:Object.freeze({ year:4006, month:11, day:11, hour:5, minute:0, second:0 })
      }),
      productionErrorSeconds:Object.freeze({
        maxAbs:1.4929316033218143,
        rms:1.0857646109309682,
        p99Abs:1.4911961260667894,
        worst:Object.freeze({ year:4006, month:10, day:10, hour:8, minute:0, second:0 })
      })
    }),
    dense:Object.freeze({
      cadenceMinutes:5,
      samples:105120,
      alignedErrorSeconds:Object.freeze({
        maxAbs:1.261836410207735,
        rms:1.0568534969578212,
        p95Abs:1.2478638260764052,
        p99Abs:1.260625409953633,
        worst:Object.freeze({ year:4006, month:11, day:11, hour:5, minute:10, second:0 })
      }),
      productionErrorSeconds:Object.freeze({
        maxAbs:1.4929317113205443,
        rms:1.0857641824825877,
        p95Abs:1.4671777218018,
        p99Abs:1.4912072952071753,
        worst:Object.freeze({ year:4006, month:10, day:10, hour:7, minute:45, second:0 })
      }),
      deltaTSecondsDifference:Object.freeze({
        maxAbs:1674.0641280745294,
        rms:1673.807044483447
      }),
      productionDeltaTContributionToEotSeconds:Object.freeze({
        maxAbs:0.5146870647749502,
        rms:0.2914003471866646
      })
    })
  }),
  interpretation:Object.freeze({
    modernControlPassed:true,
    fullYear4006Measured:true,
    denseCadenceMinutes:5,
    denseSweepIsEmpiricalNotContinuousBound:true,
    alignedMetricMeaning:"production EoT with Swiss Delta-T injected; isolates solar/EoT model disagreement at matched ephemeris time",
    productionMetricMeaning:"shipped production EoT including Tyme/ShouXing Delta-T",
    observedProductionMaxAbsErrorSeconds4006:1.4929317113205443,
    recurrenceAuthorityGranted:false,
    recurrenceValidatedYearRanges:Object.freeze([]),
    reason:"The corrected full-year Swiss differential shows small but non-zero EoT error. Exact Hour membership can still change arbitrarily close to a branch boundary, so evidence alone cannot grant unconditional recurrence authority without a boundary-margin uncertainty contract."
  })
});
