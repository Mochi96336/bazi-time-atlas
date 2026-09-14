export const NAIF_TT_TDB_EVIDENCE = Object.freeze({
  authority:"NASA/JPL NAIF CSPICE via SpiceyPy 8.2.0",
  researchPullRequest:90,
  researchWorkflowRunId:34853371738,
  researchArtifactId:10352650666,
  artifactDigest:"sha256:4adad74bf10d9471bb536df7868ea27889d60965e0f798bf23bd2aeffd8834ce",
  inputScale:"TT/TDT seconds past J2000",
  outputScale:"TDB seconds past J2000",
  kernelPool:Object.freeze({
    deltaTASeconds:32.184,
    kSeconds:0.001657,
    eb:0.01671,
    meanAnomaly:Object.freeze([6.239996, 1.99096871e-7])
  }),
  samples:Object.freeze([
    Object.freeze({ label:"j2000", jdTt:2451545.0, ttSecondsPastJ2000:0.0, spiceTdbSecondsPastJ2000:-7.273677619130569e-05 }),
    Object.freeze({ label:"2026-march", jdTt:2461120.0, ttSecondsPastJ2000:827280000.0, spiceTdbSecondsPastJ2000:827280000.0016047 }),
    Object.freeze({ label:"2026-june", jdTt:2461212.5, ttSecondsPastJ2000:835272000.0, spiceTdbSecondsPastJ2000:835272000.0003995 }),
    Object.freeze({ label:"2026-september", jdTt:2461306.5, ttSecondsPastJ2000:843393600.0, spiceTdbSecondsPastJ2000:843393599.9983821 }),
    Object.freeze({ label:"2026-december", jdTt:2461396.0, ttSecondsPastJ2000:851126400.0, spiceTdbSecondsPastJ2000:851126399.9996119 }),
    Object.freeze({ label:"4006-march", jdTt:3184300.0, ttSecondsPastJ2000:63310032000.0, spiceTdbSecondsPastJ2000:63310032000.0011 }),
    Object.freeze({ label:"4006-june", jdTt:3184392.5, ttSecondsPastJ2000:63318024000.0, spiceTdbSecondsPastJ2000:63318024000.00121 }),
    Object.freeze({ label:"4006-september", jdTt:3184486.5, ttSecondsPastJ2000:63326145600.0, spiceTdbSecondsPastJ2000:63326145599.99885 }),
    Object.freeze({ label:"4006-december", jdTt:3184576.0, ttSecondsPastJ2000:63333878400.0, spiceTdbSecondsPastJ2000:63333878399.99878 })
  ]),
  maxAbsCandidateMinusSpiceSeconds:2.437304102032717e-14,
  maxObservedAbsTdbMinusTtSeconds:0.0016179084777832031,
  promotionBoundary:Object.freeze({
    naifSpiceModelParityValidated:true,
    documentedApproximationAccuracySeconds:0.00003,
    fullRelativisticTdbDefinitionValidated:false,
    civilTimeConversionRequired:false,
    productionSeasonalPipelineIntegrated:false
  }),
  note:"The research capture loaded only the NAIF DELTET constants and called CSPICE UNITIM from TT to TDB. The pinned JS candidate matched CSPICE at J2000 and seasonal-phase samples in 2026 and 4006. This validates parity with the documented SPICE approximation, not the full DE441 relativistic coordinate-time integral."
});
