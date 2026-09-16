export const EQUATION_OF_TIME_4006_SWISS_DERIVATIVE_COMPONENT_EVIDENCE = Object.freeze({
  id:"swiss-eot-4006-derivative-components-v1",
  targetYear:4006,
  referenceModel:"Swiss Ephemeris swe_time_equ / SWIEPH",
  provenance:Object.freeze({
    researchPullRequest:221,
    researchHeadSha:"92c55146a18b863a93071f14007c83cfeda646e2",
    workflowRunId:35116177447,
    artifactId:10455117614,
    artifactName:"swiss-eot-derivative-components-4006",
    artifactDigest:"sha256:f9e143e9f8af5184e0395fa26facd86bfe26515448a63b5966e2181e3c4e920c",
    swissUpstreamCommit:"9083a12d59e98034fb2337061481ac8800c16e64",
    pyswissephVersion:"2.10.3.2",
    sepl36Sha256:"3faeadb0f2c04d455ce8c5a853d007e9b445e1dc7b65a43389fc3d746b7b9bd0",
    semo36Sha256:"f4e89fb3f69a337249ccff96d3f565baa8986a7c15e44cba5676d5dbdf00dfaa"
  }),
  sampling:Object.freeze({
    cadenceSeconds:300,
    intervals:105120,
    samplesIncludingTerminalEndpoint:105121,
    swiephSamples:105121
  }),
  formula:Object.freeze({
    continuousLift:"EoT_angle = (sidereal_time - 360deg*fractional_UT_day) - Sun_apparent_RA - 180deg",
    derivative:"EoT_angle' = sidereal_residual' - Sun_apparent_RA'",
    solarSecondsPerDegree:240
  }),
  observed:Object.freeze({
    maxAbsSiderealResidualForwardSlopeDegPerDay:0.9856917431116017,
    maxAbsSunRaForwardSlopeDegPerDay:1.0962924198865949,
    maxAbsSunRaEngineSpeedDegPerDay:1.0962922924964844,
    maxAbsSwissEotForwardSlopeSolarSecondsPerDay:26.555449898870393,
    maxAbsComponentDifferenceForwardSolarSecondsPerDay:26.555449892985052,
    maxAbsComponentVsDirectEotMismatchSolarSecondsPerDay:1.7680577002465725e-8,
    maxSunRaEngineSpeedVsFiveMinuteForwardDifferenceDegPerDay:3.3300207631370426e-5
  }),
  planning:Object.freeze({
    remainingSwissDerivativeBudgetSolarSecondsPerDay:114.00594286480292,
    remainingForwardSlopeMarginSolarSecondsPerDay:87.45049296593253,
    remainingForwardSlopeMarginDegPerDay:0.36437705402471887,
    intervalDays:300 / 86400,
    requiredCertifiedSecondDerivativeBoundDegPerDaySquared:104.94059155911904,
    bridgeMethod:"mean-value-theorem-forward-slope-plus-certified-second-derivative",
    secondDerivativeCertificateAvailable:false
  }),
  interpretation:Object.freeze({
    empiricalOnly:true,
    publicSwissSpeedOutputUsedForReconnaissance:true,
    componentIdentityEmpiricallyReproduced:true,
    forwardSlopeGridIsContinuousDerivativeBound:false,
    certifiedSiderealDerivativeBound:false,
    certifiedSunRaDerivativeBound:false,
    certifiedSwissEotDerivativeBound:false,
    certifiedSwissEotSecondDerivativeBound:false,
    continuousResidualUpperBound:false,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    reason:"The component decomposition reproduces Swiss swe_time_equ forward slopes to numerical noise and sizes a future mean-value-theorem proof. The required global second-derivative bound is not yet certified, so the sampled derivative grid remains non-authoritative."
  })
});
