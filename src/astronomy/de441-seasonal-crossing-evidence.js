export const DE441_SEASONAL_CROSSING_4006_EVIDENCE = Object.freeze({
  id:"de441-horizons-q31-seasonal-crossing-e2e-4006",
  providerId:"jpl-de441",
  validationKind:"authoritative-observable-reconstruction",
  sourceEphemeris:"DE441",
  authority:"NASA/JPL Horizons + NASA/JPL NAIF SPICE",
  catalogueYear:4006,
  sampledYears:Object.freeze([4006]),
  samplesByYear:Object.freeze({ 4006:24 }),
  referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  timeScale:"TT",
  chain:Object.freeze([
    "DE441 geometric Earth/Sun barycentric ICRF states",
    "NAIF/SPICE TT→TDB DELTET bridge",
    "SPICE LT one-iteration reception light-time",
    "NAIF STELAB stellar aberration",
    "apparent ICRF Sun direction",
    "Horizons quantity #45→#31 ecliptic-of-date frame",
    "apparent geocentric solar longitude",
    "bounded crossing root solve from independent ShouXing seed"
  ]),
  stateEvidence:Object.freeze({
    researchPullRequest:86,
    workflowRunId:34836797011,
    artifactId:10344981076,
    artifactDigest:"sha256:d1c5c5c504bee2d68053aaf47541b5b6f61cd0c740b9946492b7d641dc5c0dca",
    compactStateKnots:50
  }),
  apparentDirectionEvidence:Object.freeze({
    researchPullRequest:109,
    workflowRunId:34886473281,
    artifactId:10365660120,
    artifactDigest:"sha256:5bd8b2c448390034839d092e35ac28c3d82ec65007999423bf0fba6ada3e9bc8",
    sunCenterQ45VsLtPlusSMaxArcsec:2.1724745127587677e-6,
    repositoryAberrationVsLtPlusSMaxArcsec:4.164146993414492e-7,
    gravitationalDeflectionMode:"sun-center-evidence-bounded-identity"
  }),
  frameEvidence:Object.freeze({
    researchPullRequest:94,
    workflowRunId:34881697237,
    artifactId:10363212590,
    artifactDigest:"sha256:7445693e518a54c261eb1cd499f78522558eee2cb57a250c51a82e40b5b44549",
    compactFrameWindows:26
  }),
  independentTruth:Object.freeze({
    authority:"NASA/JPL Horizons quantity #31",
    crossings:24,
    sourceCrosscheckId:"jpl-horizons-de441-shouxing-4006-24-term",
    seedProviderId:"tyme4ts-1.5.2-shouxing-direct",
    seedMaxEpochErrorSeconds:270.174636,
    seedMeanAbsEpochErrorSeconds:261.124517,
    seedIsTruth:false
  }),
  proofResult:Object.freeze({
    solvedCrossings:24,
    totalCrossings:24,
    initialHalfBracketDays:0.05,
    rootToleranceSeconds:0.005,
    maxEpochErrorSeconds:0.161,
    meanAbsEpochErrorSeconds:0.057,
    maxTruthLongitudeResidualArcsec:0.007,
    promotionBudgetSeconds:2,
    withinPromotionBudget:true
  }),
  productionShapedSolverParity:Object.freeze({
    solver:"solveSeasonalCrossingFromAbsoluteState",
    apparentModelId:"horizons-sun-center-apparent-direction-proof",
    frameSemantics:"earth-mean-ecliptic-of-date",
    lightTimeIterations:3,
    independentTruthCrossings:24,
    promotionBudgetSeconds:2,
    maxEpochErrorRegressionGateSeconds:0.25,
    meanAbsEpochErrorRegressionGateSeconds:0.1,
    compactFixtureReused:true,
    productionRegistryStillFailClosed:true
  }),
  promotionBoundary:Object.freeze({
    ttToTdbValidated:true,
    de441StateInterpolationValidated:true,
    lightTimeValidated:true,
    stellarAberrationValidated:true,
    sunCenterApparentIcrfValidated:true,
    sunCenterApparentCorrectionModelValidated:true,
    eclipticOfDateFrameValidated:true,
    crossingRootSolveValidated:true,
    catalogueYear4006EndToEndValidated:true,
    productionShapedSolverParityValidated:true,
    productionSeasonalPipelineIntegrated:false,
    productionYear4006Unlocked:false
  }),
  note:"Pinned 24-crossing year-4006 reconstruction evidence. The independent SPICE-style harness and the production-shaped three-iteration solver parity are separate checks over the same bounded DE441/Horizons basis. Passing this evidence may qualify year 4006 for a separate runtime-integration review, but it does not register an adapter, widen runtime coverage, or unlock production year 4006."
});
