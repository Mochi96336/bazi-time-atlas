export const OWEN_HORIZONS_FRAME_PROOF_CONTRACT = Object.freeze({
  id:"swiss-owen-horizons-frame-proof-v1",
  pinnedSwissCommit:"9083a12d59e98034fb2337061481ac8800c16e64",
  sourceModel:"Owen 1990 / Swiss SEFLG_JPLHOR",
  inputFrame:"ICRF apparent direction (Horizons quantity #45)",
  outputFrame:"Earth mean ecliptic-of-date direction (Horizons quantity #31)",
  stages:Object.freeze([
    "ICRF-to-dynamical-J2000 frame bias",
    "JPLHOR Owen long-term precession",
    "JPLHOR Owen long-term mean obliquity",
    "equatorial-of-date to mean-ecliptic-of-date rotation"
  ]),
  nutationApplied:false,
  validation:Object.freeze({
    catalogueYear:4006,
    pinnedDirectionCount:18,
    maximumAngularResidualArcsec:0.05
  }),
  proofOnly:true,
  year10026FramePromoted:false,
  productionIntegrated:false,
  note:"The first gate only asks whether a source-derived Owen/JPLHOR frame reproduces already-pinned Horizons year-4006 frame truth. Passing it does not independently validate Owen at year 10026."
});
