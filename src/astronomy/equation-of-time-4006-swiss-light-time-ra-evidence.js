export const EQUATION_OF_TIME_4006_SWISS_LIGHT_TIME_RA_EVIDENCE = Object.freeze({
  id:"swiss-eot-4006-two-pass-light-time-precessed-ra-curvature-v1",
  targetYear:4006,
  scope:"geocentric-sun-two-pass-light-time-plus-mean-of-date-precession",
  provenance:Object.freeze({
    researchPullRequest:261,
    researchHeadSha:"55d062701b75ff8b0f4d1527db285f40f878d8fd",
    workflowRunId:35130604582,
    artifactId:10461401146,
    artifactName:"swiss-light-time-ra-bound-4006",
    artifactDigest:"sha256:b5aa96c7ce3d695b4b34671a0308e7fbed604d0dbed013231ac03166e8131ef6",
    swissUpstreamCommit:"9083a12d59e98034fb2337061481ac8800c16e64",
    sourceGeometryEvidenceId:"swiss-eot-4006-swieph-segment-curvature-v1",
    precessionMatrixEvidenceId:"swiss-eot-4006-vondrak-precession-matrix-v1",
    correctedRaFrameEvidenceId:"swiss-eot-4006-equatorial-ra-frame-correction-v1"
  }),
  method:Object.freeze({
    id:"swieph-two-pass-sun-light-time-plus-vondrak-ra-curvature-envelope-v1",
    rawSamplerMethod:"swieph-two-pass-sun-light-time-plus-vondrak-precession-et-grid-v1",
    pinnedSunSourceStructureAudited:true,
    geocentricSunRetardedIterations:2,
    earthHeldAtObservationTime:true,
    sunBarycenterRetarded:true,
    equatorialFlagExplicit:true,
    annualAberrationDisabled:true,
    gravitationalDeflectionDisabledByScopeGuard:true,
    nutationDisabled:true,
    vondrakPrecessionEnabled:true,
    uniformEtGrid:true,
    sampleIntervals:1461,
    sampleStepEtDays:0.249828987573844,
    sampleCoverRadiusEtDays:0.124914493786922
  }),
  sample:Object.freeze({
    minSampledLightTimePrecessedXyAu:0.9090325665612146,
    minSampleIndex:1434,
    minSampleEtJd:3184579.906621183,
    gridMinimumIsContinuousLowerBound:false
  }),
  lightTimeSourceConstant:Object.freeze({
    daysPerAu:0.005775518331436995
  }),
  retardedTimeHardBounds:Object.freeze({
    tau0MaxDays:0.030476349786717236,
    tau0PrimeAbs:0.001075927208606605,
    tau0SecondAbsPerDay:0.00023318268170398476,
    firstRetardedDistanceLowerAu:0.958079870794773,
    firstRetardedSunVelocityAuPerDay:0.09322077411963028,
    firstRetardedSunAccelerationAuPerDaySquared:0.0021492271645445968,
    tau1MaxDays:0.030476349786717236,
    tau1PrimeAbs:0.0010765058633852458,
    tau1SecondAbsPerDay:0.0002341774480483504,
    retardedSunDomainStartEtJd:3184221.6213766523,
    inspectedSunSegmentStartEtJd:3183893.141895076,
    inspectedSunSegmentEndEtJd:3184623.6612785603
  }),
  derivedHardBounds:Object.freeze({
    lightTimeGeometricPositionAu:5.276816389072819,
    lightTimeGeometricVelocityAuPerDay:0.18639126617217477,
    lightTimeGeometricAccelerationAuPerDaySquared:0.00428488068457667,
    lightTimePrecessedVelocityAuPerDay:0.1864020964018084,
    lightTimePrecessedAccelerationAuPerDaySquared:0.004285645872490167,
    hardLightTimePrecessedXyLowerAu:0.8857482430483616,
    lightTimePrecessedRaSecondDerivativeBoundRadPerDaySquared:0.09341341030224332,
    lightTimePrecessedRaSecondDerivativeBoundDegPerDaySquared:5.3521941602424254
  }),
  planning:Object.freeze({
    fullSwissEotSecondDerivativeThresholdDegPerDaySquared:104.94059155911904,
    priorCorrectedGeometricMeanOfDateRaBoundDegPerDaySquared:5.344883763257586,
    lightTimePrecessedFractionOfThreshold:0.05100213445268439,
    thresholdRemainingAfterLightTimePrecessedBoundDegPerDaySquared:99.58839739887662
  }),
  proof:Object.freeze({
    distanceDerivativeBound:"|r'| <= V",
    distanceSecondDerivativeBound:"|r''| <= A + V^2/r_min",
    retardedVelocityBound:"|S(t-tau)'| <= V_s(1+|tau'|)",
    retardedAccelerationBound:"|S(t-tau)''| <= A_s(1+|tau'|)^2 + V_s|tau''|",
    transformedVelocityInequality:"|(R x)'| <= |x'| + ||R'|| |x|",
    transformedAccelerationInequality:"|(R x)''| <= |x''| + 2 ||R'|| |x'| + ||R''|| |x|",
    betweenSampleXyLowerBound:"rho(t) >= rho(sample) - V_light_time_precessed * cover_radius",
    raCurvatureInequality:"|alpha''| <= A_xy/rho + 2 V_xy^2/rho^2",
    full3dVelocityAccelerationUsedForXy:true,
    retardedSunDomainCoveredByInspectedChebyshevSegments:true
  }),
  interpretation:Object.freeze({
    sourceDerivedContinuousBound:true,
    correctedRaFrameEvidenceRequired:true,
    swissTwoPassSunLightTimeCertified:true,
    retardedTimeDerivativeBoundsAnalytic:true,
    retardedSunSegmentDomainCertified:true,
    vondrakPrecessionMatrixCertified:true,
    lightTimePrecessedXySeparationContinuous:true,
    lightTimePrecessedRaSecondDerivativeCertified:true,
    annualAberrationCertified:false,
    gravitationalDeflectionCertified:false,
    nutationCertified:false,
    apparentPositionCorrectionChainCertified:false,
    longTermSiderealSecondDerivativeCertified:false,
    swissEotSecondDerivativeCertified:false,
    swissEotDerivativeCertified:false,
    continuousResidualUpperBound:false,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    reason:"Pinned SWIEPH segment kinematics, the exact two-pass geocentric Sun light-time structure, corrected equatorial RA-frame evidence, and the Vondrak matrix certificate establish a continuous RA-curvature bound after light-time and precession. Annual aberration, nutation and long-term sidereal curvature remain outside this certificate."
  })
});
