export const HORIZONS_ECLIPTIC_FRAME_EVIDENCE = Object.freeze({
  authority:"NASA/JPL Horizons API",
  researchPullRequest:94,
  crossTargetResearchRunId:34855340964,
  denseWindowResearchRunId:34869125400,
  denseWindowArtifactId:10357559155,
  denseWindowArtifactDigest:"sha256:fa36844c596a5a78a2b37f6a28a5ded8c2293b4803dba9791b00eef7162224f5",
  contract:Object.freeze({
    observer:"Earth geocenter (500@399)",
    timeScale:"TT",
    sourceFrame:"ICRF apparent RA/DEC (Horizons quantity #45)",
    targetFrame:"Earth ecliptic-of-date apparent lon/lat (Horizons quantity #31)",
    sharedCorrections:"light-time + solar gravitational deflection + stellar aberration",
    fitDirections:Object.freeze(["sun", "moon"]),
    withheld2026Targets:Object.freeze(["mars", "jupiter", "saturn", "pluto"])
  }),
  crossTargetValidation:Object.freeze({
    epochs:4,
    withheldDirections:16,
    maxAngularResidualArcsec:0.0007870656192007469,
    meanAngularResidualArcsec:0.00027459710769956787,
    maxOrthogonalityResidualInfinityNorm:1.6139553514708688e-15,
    maxAbsDeterminantMinusOne:2.220446049250313e-16,
    targetIndependentRotationValidated:true
  }),
  year4006DenseWindow:Object.freeze({
    knotGrid:"daily 00:00 TT",
    knotRows:366,
    withheldGrid:"daily 12:00 TT",
    withheldRows:365,
    interpolation:"quaternion-slerp between adjacent daily rotation knots",
    maxAngularResidualArcsec:0.009068677319643812,
    meanAngularResidualArcsec:0.0033771492706470355,
    p99AngularResidualArcsec:0.00696041,
    maxEquivalentMeanAnnualSolarCrossingSeconds:0.22081757702112062,
    exhaustiveHalfDaySweepValidated:true
  }),
  sourceFileDigests:Object.freeze({
    sunDailyKnots:"sha256:689a5c4df7508b8d1d2852f9d79ed2f34a8487b2eafa8e7299565f5b90b0b4c0",
    moonDailyKnots:"sha256:eeb2a4ed72bc48bc69ebd7896ec3e0ed5c208a89f5e1a5048e2a808b11f5d99c",
    sunHalfDayTruth:"sha256:b7eb1a5f64dbfa591d14d42fc9093e88f77c52eda3dbf75c64834b561d315ab8",
    moonHalfDayTruth:"sha256:2adfc95fa13f93fffcd7af57a8d84b49918d42c30bbd4609e203a82f33f20cb7"
  }),
  horizonsObserverTableLimits:Object.freeze({
    mars:"after AD 2600 unavailable",
    jupiter:"after AD 2200 unavailable",
    saturn:"after AD 2250 unavailable",
    pluto:"after AD 2199 unavailable",
    note:"These target-specific observer-table limits do not block the year-4006 frame recovery because Sun and Moon remain available and two non-collinear paired directions uniquely determine a proper 3-D rotation."
  }),
  promotionBoundary:Object.freeze({
    targetIndependentFrameValidated:true,
    year4006FrameInterpolationValidated:true,
    apparentDirectionCorrectionFromGeometricDe441StateValidated:false,
    productionSeasonalPipelineIntegrated:false
  }),
  note:"The clean proof retains only bounded numeric evidence and selected worst-region windows. It does not copy Swiss Ephemeris/Owen source code or coefficient tables, and it does not claim that an ICRF geometric DE441 state is already an apparent direction."
});
