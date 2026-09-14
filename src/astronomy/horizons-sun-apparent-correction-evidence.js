export const HORIZONS_SUN_APPARENT_CORRECTION_EVIDENCE = Object.freeze({
  authority:"NASA/JPL Horizons API",
  researchPullRequest:109,
  researchWorkflowRunId:34886473281,
  researchArtifactId:10365660120,
  artifactDigest:"sha256:5bd8b2c448390034839d092e35ac28c3d82ec65007999423bf0fba6ada3e9bc8",
  contract:Object.freeze({
    target:"Sun center (10)",
    observer:"Earth geocenter (500@399)",
    observerQuantity45:"ICRF apparent RA/DEC",
    vectorLtPlusS:"ICRF vector with down-leg light-time + stellar aberration",
    vectorLt:"ICRF vector with down-leg light-time only",
    earthBarycentricState:"Earth (399) relative to SSB (0), geometric ICRF/TDB",
    observerTimeScale:"TT",
    vectorTimeScale:"TDB",
    sampleYears:Object.freeze([2026, 4006]),
    sampleCount:8
  }),
  sourceFileDigests:Object.freeze({
    observerQuantity45:"sha256:7195815cf757454cd40e4163db4f5a3f52b2ad23907a035b0fc53b0f458ed7da",
    vectorLtPlusS:"sha256:a687de9276f8276a0fa5d06fea70333f6e479038e60111310ee9e3c5e7344b9a",
    vectorLt:"sha256:9f067ac308b346dbedc76a788d8fa4e968bf771ffba8f1abf4637c816143f14a",
    earthBarycentric:"sha256:beea04a21d302030dee474ee39394a8b99909ff43e58b5d7f6f1530e588a7ded"
  }),
  observerQ45VsLtPlusS:Object.freeze({
    maxAngularResidualArcsec:2.1724745127587677e-6,
    meanAngularResidualArcsec:1.650154930390724e-6,
    conservativeGateArcsec:3e-6,
    interpretation:"For the Sun-center target, the observer apparent direction and LT+S vector direction agree within a few microarcseconds. The solar gravitational self-deflection term is therefore represented as an evidence-bounded identity on this target geometry."
  }),
  stellarAberration:Object.freeze({
    minLtVsLtPlusSArcsec:20.173826565544406,
    maxLtVsLtPlusSArcsec:20.813400338441784,
    meanLtVsLtPlusSArcsec:20.492876582109467,
    nonTrivial:true
  }),
  repositoryAberrationParity:Object.freeze({
    maxRepoVsLtPlusSArcsec:4.164146993414492e-7,
    meanRepoVsLtPlusSArcsec:4.034865467790059e-7,
    conservativeGateArcsec:1e-6,
    validated:true
  }),
  promotionBoundary:Object.freeze({
    sunCenterSelfDeflectionIdentityValidated:true,
    stellarAberrationValidated:true,
    repositoryAberrationAgainstHorizonsValidated:true,
    completeSunApparentDirectionModelEligible:true,
    productionSeasonalPipelineIntegrated:false
  }),
  note:"This evidence is specific to the Sun-center seasonal observable. It does not generalize zero gravitational deflection to arbitrary background targets near the Sun. The proof model explicitly accounts for the required deflection stage as an evidence-bounded identity for the Sun center, then applies the repository SOFA-compatible stellar-aberration correction."
});
