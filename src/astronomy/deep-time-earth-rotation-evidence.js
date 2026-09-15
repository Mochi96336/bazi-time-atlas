export const DEEP_TIME_EARTH_ROTATION_EVIDENCE = Object.freeze({
  id:"deep-time-earth-rotation-deltat-extrapolation-v1",
  observable:"delta-t-tt-minus-ut1",
  inputTimeScale:"TT",
  outputTimeScale:"UT1",
  estimateAuthority:"NASA GSFC Eclipse Web Site / Espenak and Meeus",
  estimateSourceUrl:"https://eclipse.gsfc.nasa.gov/SEcat5/deltat.html",
  polynomialSourceUrl:"https://eclipse.gsfc.nasa.gov/LEcat5/deltatpoly.html",
  uncertaintyAuthority:"NASA GSFC Eclipse Web Site / Huber (2000) model as reproduced by Espenak",
  uncertaintySourceUrl:"https://eclipse.gsfc.nasa.gov/SEcat5/uncertainty.html",
  operationalPredictionAuthority:"IERS Rapid Service / Prediction Centre",
  operationalPredictionSourceUrl:"https://datacenter.iers.org/productMetadata.php?id=6",
  modernRotationReference:Object.freeze({
    citation:"Stephenson, Morrison & Hohenkerk (2016), Proc. R. Soc. A 472:20160404",
    doi:"10.1098/rspa.2016.0404",
    observedMeanLodIncreaseMsPerCentury:1.8,
    note:"Observed Earth rotation is non-uniform and includes decadal-to-centennial fluctuations around the long-term trend."
  }),
  updatedRotationReference:Object.freeze({
    citation:"Morrison, Stephenson, Hohenkerk & Zawilski (2021), Proc. R. Soc. A 477:20200776",
    doi:"10.1098/rspa.2020.0776",
    note:"Updated eclipse evidence still shows a non-tidal accelerative component and an approximately 14-century oscillatory variation; it does not provide deterministic millennial UT1 prediction."
  }),
  longTermEstimate:Object.freeze({
    equation:"deltaTSeconds = -20 + 32 * ((decimalYear - 1820) / 100)^2",
    role:"point-estimate-only",
    observationallyConstrainedFuture:false,
    note:"NASA describes future Delta T as uncertain and the long-term parabola as an extrapolation outside observations."
  }),
  futureUncertainty:Object.freeze({
    calibrationYear:2005,
    observedSpanYears:2500,
    qMillisecondsSquaredPerYear:0.058,
    equation:"sigmaSeconds = 365.25*N*sqrt((N*Q/3)*(1+N/M))/1000",
    semantics:"one-standard-error-not-hard-bound",
    nasaTable4000SigmaSeconds:6068,
    note:"The uncertainty model is statistical. A ±1 sigma interval is not a guaranteed bound and therefore cannot by itself certify a unique civil date or hour branch."
  }),
  operationalPrediction:Object.freeze({
    parameter:"UT1-UTC",
    maximumPredictionHorizonDays:365,
    deepTimeCoverage:false,
    note:"IERS Bulletin A operational predictions extend only up to 365 days beyond the latest observations."
  }),
  promotionBoundary:Object.freeze({
    ttToUt1PointEstimateAvailable:true,
    deepTimeUncertaintyQuantified:true,
    deterministicUt1Validated:false,
    utcFuturePolicyKnown:false,
    deterministicCivilTimeValidated:false,
    dayPillarUniquenessValidated:false,
    hourPillarUniquenessValidated:false
  }),
  note:"Evidence contract for deep-time Earth rotation. It permits an explicitly uncertain TT→UT1 estimate, but forbids treating that estimate as an exact future civil timestamp or deterministic Day/Hour-pillar bridge."
});