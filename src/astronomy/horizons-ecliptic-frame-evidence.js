export const HORIZONS_ECLIPTIC_FRAME_EVIDENCE = Object.freeze({
  authority:"NASA/JPL Horizons API",
  researchPullRequest:94,
  crossTargetResearchRunId:34855340964,
  denseWindowResearchRunId:34881697237,
  denseWindowArtifactId:10363212590,
  denseWindowArtifactDigest:"sha256:7445693e518a54c261eb1cd499f78522558eee2cb57a250c51a82e40b5b44549",
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
    catalogueYear:4006,
    catalogueYearSemantics:"270° winter solstice belongs to December 4005; 285°..255° continue through calendar year 4006",
    knotGrid:"4005-12-01 through 4007-01-01, daily 00:00 TT",
    knotRows:397,
    withheldGrid:"4005-12-01 through 4006-12-31, daily 12:00 TT",
    withheldRows:396,
    interpolation:"quaternion-slerp between adjacent daily rotation knots",
    maxAngularResidualArcsec:0.009719529582174898,
    meanAngularResidualArcsec:0.002637720298513509,
    conservativeGateArcsec:0.01,
    maxEquivalentMeanAnnualSolarCrossingSeconds:0.23666549117057603,
    exhaustiveHalfDaySweepValidated:true,
    completeCatalogueYearWindowValidated:true
  }),
  sourceFileDigests:Object.freeze({
    sunDailyKnots:"sha256:517253716c18cbdec36923f1232a8b30cf84007c88d5688661540eecd67bf2b1",
    moonDailyKnots:"sha256:c5f19859b867ad7c227700afa2c43947b6164f13303eba3469ba5961d467224d",
    sunHalfDayTruth:"sha256:c847d8da7d81b133e6588c5f5e70052c4b431515454bc1bcef951509230281bd",
    moonHalfDayTruth:"sha256:1279ef6fbfafc76234d417d24dad3a923e65dc07c0525869d08dcbe7c2145871"
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
    completeCatalogueYear4006WindowValidated:true,
    apparentDirectionCorrectionFromGeometricDe441StateValidated:false,
    productionSeasonalPipelineIntegrated:false
  }),
  note:"The clean proof retains only bounded numeric evidence and selected worst-region windows. The dense validation includes the previous-December winter-solstice part of the Tyme-style year-4006 catalogue. It does not copy Swiss Ephemeris/Owen source code or coefficient tables, and it does not claim that an ICRF geometric DE441 state is already an apparent direction."
});
