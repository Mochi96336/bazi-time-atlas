export const DE441_SEASONAL_CROSSING_4006_EVIDENCE = Object.freeze({
  id:"de441-horizons-q31-seasonal-crossing-e2e-4006",
  authority:"NASA/JPL Horizons + NASA/JPL NAIF SPICE",
  catalogueYear:4006,
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
  promotionBoundary:Object.freeze({
    ttToTdbValidated:true,
    de441StateInterpolationValidated:true,
    lightTimeValidated:true,
    stellarAberrationValidated:true,
    sunCenterApparentIcrfValidated:true,
    eclipticOfDateFrameValidated:true,
    crossingRootSolveValidated:true,
    catalogueYear4006EndToEndValidated:true,
    productionSeasonalPipelineIntegrated:false,
    productionYear4006Unlocked:false
  }),
  note:"This is an offline proof over 24 independent Horizons quantity-31 crossing epochs. The root seed is the existing ShouXing candidate, not JPL truth. Passing this proof validates the scientific chain but does not by itself register a production provider or unlock year 4006."
});
