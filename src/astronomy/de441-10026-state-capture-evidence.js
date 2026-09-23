export const DE441_10026_STATE_CAPTURE_EVIDENCE = Object.freeze({
  id:"jpl-de441-10026-offline-state-capture-evidence-v1",
  authority:"NASA/JPL NAIF",
  sourceEphemeris:"DE441",
  catalogueYear:10026,
  sourceKernel:Object.freeze({
    filename:"de441_part-2.bsp",
    url:"https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-2.bsp",
    bytes:1_656_830_976,
    officialMd5:"ad8dfa4e505ef0e3a5d587a5b4705632",
    observedMd5:"ad8dfa4e505ef0e3a5d587a5b4705632",
    observedSha256:"3abb17dae2d78dd34880377544aacb54892104a0d4462b322cb9f4454d4887f6"
  }),
  researchRun:Object.freeze({
    pullRequest:450,
    workflowRunId:35_929_146_374,
    artifactId:10_780_616_042,
    artifactName:"de441-10026-state-capture",
    artifactDigest:"sha256:d133db4bd66e871827a9024bfc11aad6fd975a68e10a3497538f56ca6e0e31e9",
    artifactBytes:88_552
  }),
  capture:Object.freeze({
    filename:"de441-10026-state-capture.json",
    bytes:203_158,
    sha256:"d1f7c06152771ffa2db8538dd2807b7f8d4785114e20b6d5655ee7cf1b110481",
    dailyStartTdbJulianDay:5_382_950.5,
    dailyEndTdbJulianDay:5_383_345.5,
    dailySamples:396,
    withheldMidpointSamples:395,
    cadenceDays:1,
    midpointPhaseDays:.5
  }),
  software:Object.freeze({
    python:"3.12.14",
    jplephem:"2.24",
    numpy:"2.5.3"
  }),
  vectorContract:Object.freeze({
    center:"Solar System barycenter (0)",
    referenceFrame:"ICRF",
    timeScale:"TDB",
    units:"AU/day",
    corrections:"NONE (geometric)",
    earthRoute:Object.freeze([[0, 3], [3, 399]]),
    sunRoute:Object.freeze([[0, 10]])
  }),
  interpolation:Object.freeze({
    method:"one-day cubic Hermite against withheld half-day DE441 states",
    earth:Object.freeze({
      sampleCount:395,
      maxPositionErrorMeters:98.71815330585908,
      meanPositionErrorMeters:46.306331516194334,
      maxVelocityErrorMetersPerSecond:5.588381501275641e-05,
      meanVelocityErrorMetersPerSecond:2.187653038999003e-05
    }),
    sun:Object.freeze({
      sampleCount:395,
      maxPositionErrorMeters:0.003793283011203332,
      meanPositionErrorMeters:0.0013037810969513165,
      maxVelocityErrorMetersPerSecond:1.5334046715553117e-09,
      meanVelocityErrorMetersPerSecond:4.464783825299209e-10
    })
  }),
  promotionBoundary:Object.freeze({
    absoluteStateCaptured:true,
    stateInterpolationValidated:true,
    meanEclipticOfDateTransformResolved:false,
    apparentDirectionModelValidated:false,
    apparentSeasonalCrossingResolved:false,
    civilTimeResolved:false,
    productionIntegrated:false
  }),
  note:"Year 10026 now has reproducible DE441 ICRF/TDB absolute-state evidence with exhaustive withheld-midpoint interpolation validation. This does not yet provide the mean-ecliptic-of-date frame or apparent seasonal crossing required to publish a Li Chun TT epoch."
});
