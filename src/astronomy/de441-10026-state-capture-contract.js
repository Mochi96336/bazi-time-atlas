export const DE441_10026_STATE_CAPTURE_CONTRACT = Object.freeze({
  id:"jpl-de441-10026-offline-state-capture-v1",
  authority:"NASA/JPL NAIF",
  sourceEphemeris:"DE441",
  sourceKernel:Object.freeze({
    filename:"de441_part-2.bsp",
    url:"https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-2.bsp",
    officialMd5:"ad8dfa4e505ef0e3a5d587a5b4705632"
  }),
  sampler:Object.freeze({
    library:"jplephem",
    version:"2.24",
    targetCatalogueYear:10026,
    referenceFrame:"ICRF",
    timeScale:"TDB",
    center:"Solar System barycenter",
    units:"AU/day",
    corrections:"NONE (geometric)",
    dailyWindow:Object.freeze({
      start:Object.freeze({ year:10025, month:12, day:1 }),
      end:Object.freeze({ year:10026, month:12, day:31 }),
      cadenceDays:1
    }),
    withheldMidpointPhaseDays:0.5
  }),
  bodyRoutes:Object.freeze({
    sun:Object.freeze([[0, 10]]),
    earth:Object.freeze([[0, 3], [3, 399]])
  }),
  interpolationValidation:Object.freeze({
    method:"one-day cubic Hermite against withheld half-day DE441 states",
    earthMaxPositionErrorMeters:125,
    earthMaxVelocityErrorMetersPerSecond:0.00007,
    sunMaxPositionErrorMeters:0.01,
    sunMaxVelocityErrorMetersPerSecond:0.000000003
  }),
  researchOnly:true,
  absoluteStateCaptured:false,
  meanEclipticOfDateTransformResolved:false,
  apparentSeasonalCrossingResolved:false,
  productionIntegrated:false,
  note:"This contract only defines the reproducible offline DE441 state-capture experiment for catalogue year 10026. Passing it must not be interpreted as a seasonal TT epoch, civil Li Chun position, or year-pillar proof."
});
