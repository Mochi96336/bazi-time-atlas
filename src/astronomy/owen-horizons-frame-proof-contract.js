export const OWEN_HORIZONS_FRAME_PROOF_CONTRACT = Object.freeze({
  id:"swiss-owen-horizons-frame-proof-v1",
  pinnedSwissCommit:"9083a12d59e98034fb2337061481ac8800c16e64",
  sourceModel:"Owen 1990 / Swiss SEFLG_JPLHOR ICRS path + pinned IERS EOP14 IAU1980 correction",
  inputFrame:"ICRF apparent direction (Horizons quantity #45)",
  outputFrame:"Earth mean ecliptic-of-date direction (Horizons quantity #31)",
  stages:Object.freeze([
    "preserve inertial ICRF axes under Swiss JPLHOR SEFLG_ICRS semantics",
    "JPLHOR Owen long-term precession",
    "IAU1980 nutation plus pinned terminal IERS dPsi/dEps correction",
    "Owen long-term mean obliquity",
    "equatorial-of-date to Earth ecliptic-of-date apparent longitude frame"
  ]),
  eopSource:Object.freeze({
    authority:"IERS Earth Orientation Centre",
    product:"EOP 14 C04 IAU1980 dPsi/dEps 0hUTC 1962-now",
    sourceUrl:"https://datacenter.iers.org/data/223/eopc04_14.62-now.txt",
    terminalDate:"2026-01-05",
    terminalMjd:61045,
    terminalDPsiArcsec:-0.113478,
    terminalDEpsArcsec:-0.006944,
    sha256:"40347f18a10eb72b15e4f84e647b5f1b7da4709534d935e2e1289697bdfa79df",
    farFutureSemantics:"terminal correction held constant, matching pinned Swiss JPLHOR table behavior"
  }),
  seasonalPlaneSemantics:"mean-ecliptic-of-date",
  apparentEquinoxCorrectionTested:true,
  fullTrueEclipticClaim:false,
  validation:Object.freeze({
    catalogueYear:4006,
    pinnedDirectionCount:18,
    maximumAngularResidualArcsec:0.05,
    observedMaximumAngularResidualArcsec:0.006212691901953827
  }),
  proofOnly:true,
  year10026FramePromoted:false,
  productionIntegrated:false,
  note:"The first gate asks whether the source-derived Swiss JPLHOR ICRS/Owen/IAU1980+IERS path reproduces already-pinned Horizons year-4006 frame truth. Passing it does not independently validate Owen at year 10026."
});
