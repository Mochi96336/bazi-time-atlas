export const DE441_10026_SEASONAL_CROSSING_EVIDENCE = Object.freeze({
  id:"de441-10026-source-derived-seasonal-crossing-evidence-v1",
  validationKind:"source-derived-reconstruction",
  authority:"NASA/JPL DE441 + repository validated composition chain",
  sourceEphemeris:"DE441",
  catalogueYear:10026,
  referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  timeScale:"TT",
  researchRun:Object.freeze({
    pullRequest:456,
    workflowRunId:35_941_704_369,
    artifactId:10_785_076_771,
    artifactName:"de441-10026-seasonal-crossing-proof",
    artifactDigest:"sha256:b68b3d9d8fd2ca28f65d8d6d3f41dba93b674e2089478745e55fd83f582224dc"
  }),
  sourceStateEvidence:Object.freeze({
    id:"jpl-de441-10026-offline-state-capture-evidence-v1",
    captureSha256:"d1f7c06152771ffa2db8538dd2807b7f8d4785114e20b6d5655ee7cf1b110481"
  }),
  composition:Object.freeze({
    stateAdapter:"jpl-de441-10026-daily-state-proof-adapter",
    ttToTdb:"naif-spice-deltet-tt-tdb",
    apparentDirectionModel:"horizons-sun-center-apparent-direction-proof",
    frameProof:"swiss-owen-horizons-frame-proof-v1",
    frameIndependentValidationCatalogueYear:4006,
    solver:"solveSeasonalCrossingFromAbsoluteState"
  }),
  proofResult:Object.freeze({
    solvedCrossings:24,
    totalCrossings:24,
    rootToleranceSeconds:0.005,
    rootResidualGateArcsec:0.001,
    maxRootResidualArcsec:0.000048625270210322924,
    alternateSeedParityGateSeconds:0.02,
    maxAlternateSeedParitySeconds:0.0019311904907226562,
    minSpacingDays:14.842365080490708,
    maxSpacingDays:15.605526977218688,
    frameProbeCalls:1500
  }),
  liChun:Object.freeze({
    longitudeDegrees:315,
    ttJulianDay:5383013.532143416
  }),
  terms:Object.freeze([
    Object.freeze({ name:"冬至", longitudeDegrees:270, ttJulianDay:5382967.134805699 }),
    Object.freeze({ name:"小寒", longitudeDegrees:285, ttJulianDay:5382982.675608588 }),
    Object.freeze({ name:"大寒", longitudeDegrees:300, ttJulianDay:5382998.143253632 }),
    Object.freeze({ name:"立春", longitudeDegrees:315, ttJulianDay:5383013.532143416 }),
    Object.freeze({ name:"雨水", longitudeDegrees:330, ttJulianDay:5383028.818622854 }),
    Object.freeze({ name:"驚蟄", longitudeDegrees:345, ttJulianDay:5383044.01194351 }),
    Object.freeze({ name:"春分", longitudeDegrees:0, ttJulianDay:5383059.100808367 }),
    Object.freeze({ name:"清明", longitudeDegrees:15, ttJulianDay:5383074.108641097 }),
    Object.freeze({ name:"穀雨", longitudeDegrees:30, ttJulianDay:5383089.035849098 }),
    Object.freeze({ name:"立夏", longitudeDegrees:45, ttJulianDay:5383103.916487871 }),
    Object.freeze({ name:"小滿", longitudeDegrees:60, ttJulianDay:5383118.758852951 }),
    Object.freeze({ name:"芒種", longitudeDegrees:75, ttJulianDay:5383133.602204906 }),
    Object.freeze({ name:"夏至", longitudeDegrees:90, ttJulianDay:5383148.4572062 }),
    Object.freeze({ name:"小暑", longitudeDegrees:105, ttJulianDay:5383163.362276589 }),
    Object.freeze({ name:"大暑", longitudeDegrees:120, ttJulianDay:5383178.324251383 }),
    Object.freeze({ name:"立秋", longitudeDegrees:135, ttJulianDay:5383193.374968433 }),
    Object.freeze({ name:"處暑", longitudeDegrees:150, ttJulianDay:5383208.511896181 }),
    Object.freeze({ name:"白露", longitudeDegrees:165, ttJulianDay:5383223.755510551 }),
    Object.freeze({ name:"秋分", longitudeDegrees:180, ttJulianDay:5383239.090777016 }),
    Object.freeze({ name:"寒露", longitudeDegrees:195, ttJulianDay:5383254.523861856 }),
    Object.freeze({ name:"霜降", longitudeDegrees:210, ttJulianDay:5383270.027788247 }),
    Object.freeze({ name:"立冬", longitudeDegrees:225, ttJulianDay:5383285.594535519 }),
    Object.freeze({ name:"小雪", longitudeDegrees:240, ttJulianDay:5383301.189885302 }),
    Object.freeze({ name:"大雪", longitudeDegrees:255, ttJulianDay:5383316.79541228 })
  ]),
  claimBoundary:Object.freeze({
    independentTargetYearTruth:false,
    sourceDerivedTargetYear:true,
    frameIndependentlyValidatedAtTargetYear:false,
    civilTimeResolved:false,
    productionIntegrated:false,
    productionAuthorityGranted:false
  }),
  note:"Pinned source-derived year-10026 seasonal crossing result from PR #456. The DE441 state source is authoritative, while the target-year frame/crossing composition is an extrapolation of a path independently checked at year 4006. These epochs are reproducible research evidence, not independent Horizons truth and not production authority."
});
