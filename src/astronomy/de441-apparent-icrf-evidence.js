export const DE441_APPARENT_ICRF_EVIDENCE = Object.freeze({
  authority:"NASA/JPL Horizons API + NAIF SPICE aberration semantics",
  researchPullRequest:99,
  researchWorkflowRunId:34870654952,
  researchArtifactId:10358534224,
  artifactDigest:"sha256:ca8995da914f62d419032e2d0a929b570f698671989bec5b22d721be4a06709f",
  sourceFileDigests:Object.freeze({
    observerQ1Q21Q45:"sha256:4030f2baefd24d9ce6f228c6bad7b5e4861119df1f0f4cfbeff0e9456c73338b",
    vectorsNone:"sha256:9fe2aa74fcaf4e23662a3fb349f113495d55952cf3487417c50ff23d5314ae6d",
    vectorsLt:"sha256:90f4edce9c35196ceee51f403f56aed5b02a9c0960908eda0d803220bd72b44e",
    vectorsLtPlusS:"sha256:d3e2a5929011435f7b559a30a9c13946d556be93355a2f7a76687afbdb31e23f",
    earthBarycentricWindows:"sha256:39ecabaa0a61fb0a1164aeca17dcb8d19a54e3bf703fbf863eaa10e08c34e9c3",
    sunBarycentricWindows:"sha256:851a8907e15ee450cc00e7fe7888d80f43a680438d98991ff93191b4635ef4ac"
  }),
  sampledEpochs:Object.freeze({ years:Object.freeze([2026, 4006]), count:8 }),
  horizonsLayerIsolation:Object.freeze({
    maxAstrometricObserverVsVectorLtArcsec:1.7494119099790988e-6,
    maxApparentObserverVsVectorLtPlusSArcsec:2.0564502059745358e-6,
    stellarAberrationRangeArcsec:Object.freeze([20.257412, 20.8134]),
    sunCenterAdditionalDeflectionResolved:false,
    interpretation:"For the Sun center, Horizons observer #45 is indistinguishable from vector LT+S at the table's output precision."
  }),
  de441Reconstruction:Object.freeze({
    interpolation:"one-day cubic Hermite barycentric DE441 windows",
    lightTime:"SPICE LT one-iteration reception convention",
    stellarAberration:"NAIF STELAB rotation",
    maxLtPositionErrorMeters:0.6889661,
    maxLtAngularErrorArcsec:9.601178e-7,
    maxOneIterationLightTimeErrorSeconds:2.44819e-7,
    maxApparentVsVectorLtPlusSArcsec:1.6209364e-5,
    maxApparentVsObserverQ45Arcsec:1.5125924e-5,
    apparentDirectionValidated:true
  }),
  promotionBoundary:Object.freeze({
    ttToTdbValidated:true,
    de441StateInterpolationValidated:true,
    lightTimeValidated:true,
    stellarAberrationValidated:true,
    sunCenterApparentIcrfValidated:true,
    eclipticOfDateFrameValidated:true,
    crossingRootSolveValidated:false,
    productionSeasonalPipelineIntegrated:false
  }),
  note:"This evidence is specific to the geocentric Sun-center seasonal-longitude use case. It does not generalize the absence of a gravitational-deflection residual to arbitrary targets. Production remains fail-closed until apparent ICRF, ecliptic-of-date frame, and the longitude crossing solver are composed and validated end to end."
});
