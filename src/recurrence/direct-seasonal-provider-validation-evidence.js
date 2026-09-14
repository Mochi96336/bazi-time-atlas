const freezeTerms = terms => Object.freeze(terms.map(term => Object.freeze(term)));

/**
 * Offline evidence captured from NASA/JPL Horizons observer tables.
 *
 * Quantity #31 is the Earth-season observable recommended by Horizons: the
 * geocentric apparent ecliptic longitude of the Sun, using the mean ecliptic
 * plane of date. The live research probes are intentionally not production
 * dependencies; only their pinned results live here.
 */
export const JPL_DE441_SHOUXING_2026_CROSSCHECK = Object.freeze({
  id:"jpl-horizons-de441-shouxing-2026-24-term",
  providerId:"tyme4ts-1.5.2-shouxing-direct",
  kind:"independent-ephemeris",
  referenceFamily:"jpl-planetary-ephemeris",
  referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  timeScale:"TT",
  sourceEphemeris:"DE441",
  authority:"NASA/JPL Horizons",
  target:"Sun (10)",
  observerCenter:"Earth geocenter (399)",
  quantity:"31 · observer-centered Earth ecliptic longitude/latitude",
  catalogueYear:2026,
  sampledYears:Object.freeze([2026]),
  samplesByYear:Object.freeze({ 2026:24 }),
  maxEpochErrorSeconds:2.452371,
  meanAbsEpochErrorSeconds:0.986556709,
  researchWorkflowRunId:34822724730,
  note:"Modern-era control only. The 24 raw quantity-31 crossings and ShouXing direct roots agree at about one second mean absolute epoch error; this record does not widen provider coverage.",
  terms:freezeTerms([
    { name:"春分", longitudeDegrees:0, epochErrorSeconds:0.130476 },
    { name:"清明", longitudeDegrees:15, epochErrorSeconds:-0.289598 },
    { name:"穀雨", longitudeDegrees:30, epochErrorSeconds:0.557390 },
    { name:"立夏", longitudeDegrees:45, epochErrorSeconds:-1.007639 },
    { name:"小滿", longitudeDegrees:60, epochErrorSeconds:-0.251296 },
    { name:"芒種", longitudeDegrees:75, epochErrorSeconds:-2.012824 },
    { name:"夏至", longitudeDegrees:90, epochErrorSeconds:-1.611176 },
    { name:"小暑", longitudeDegrees:105, epochErrorSeconds:-1.450163 },
    { name:"大暑", longitudeDegrees:120, epochErrorSeconds:-1.121619 },
    { name:"立秋", longitudeDegrees:135, epochErrorSeconds:-2.452371 },
    { name:"處暑", longitudeDegrees:150, epochErrorSeconds:-1.094462 },
    { name:"白露", longitudeDegrees:165, epochErrorSeconds:-2.108739 },
    { name:"秋分", longitudeDegrees:180, epochErrorSeconds:-0.609009 },
    { name:"寒露", longitudeDegrees:195, epochErrorSeconds:-1.347488 },
    { name:"霜降", longitudeDegrees:210, epochErrorSeconds:-0.269039 },
    { name:"立冬", longitudeDegrees:225, epochErrorSeconds:-1.154329 },
    { name:"小雪", longitudeDegrees:240, epochErrorSeconds:-0.581490 },
    { name:"大雪", longitudeDegrees:255, epochErrorSeconds:-0.867587 },
    { name:"冬至", longitudeDegrees:270, epochErrorSeconds:-1.212788 },
    { name:"小寒", longitudeDegrees:285, epochErrorSeconds:-0.516714 },
    { name:"大寒", longitudeDegrees:300, epochErrorSeconds:-0.975895 },
    { name:"立春", longitudeDegrees:315, epochErrorSeconds:-0.843890 },
    { name:"雨水", longitudeDegrees:330, epochErrorSeconds:-0.676198 },
    { name:"驚蟄", longitudeDegrees:345, epochErrorSeconds:-0.535181 }
  ])
});

export const JPL_DE441_SHOUXING_4006_CROSSCHECK = Object.freeze({
  id:"jpl-horizons-de441-shouxing-4006-24-term",
  providerId:"tyme4ts-1.5.2-shouxing-direct",
  kind:"independent-ephemeris",
  referenceFamily:"jpl-planetary-ephemeris",
  referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  timeScale:"TT",
  sourceEphemeris:"DE441",
  authority:"NASA/JPL Horizons",
  target:"Sun (10)",
  observerCenter:"Earth geocenter (399)",
  quantity:"31 · observer-centered Earth ecliptic longitude/latitude",
  catalogueYear:4006,
  sampledYears:Object.freeze([4006]),
  samplesByYear:Object.freeze({ 4006:24 }),
  maxEpochErrorSeconds:270.174636,
  meanAbsEpochErrorSeconds:261.124517,
  researchWorkflowRunId:34821974880,
  sourceCaptureSha256:"3f0c4d25473abc79477b120bc8ec4f85226e2155bb29e1c74210044f11ef3d6b",
  note:"Independent deep-time rejection evidence. All 24 catalogue crossings were compared in TT against Horizons quantity #31 using DE441; the roughly 4.3-minute systematic epoch drift exceeds the two-second promotion budget.",
  terms:freezeTerms([
    { name:"春分", longitudeDegrees:0, shouXingTtJulianDay:3184300.181444289, jplDe441TtJulianDay:3184300.178494792, epochErrorSeconds:254.836558 },
    { name:"清明", longitudeDegrees:15, shouXingTtJulianDay:3184315.093659071, jplDe441TtJulianDay:3184315.09070625, epochErrorSeconds:255.123702 },
    { name:"穀雨", longitudeDegrees:30, shouXingTtJulianDay:3184330.101328401, jplDe441TtJulianDay:3184330.098353298, epochErrorSeconds:257.048897 },
    { name:"立夏", longitudeDegrees:45, shouXingTtJulianDay:3184345.233715398, jplDe441TtJulianDay:3184345.230730463, epochErrorSeconds:257.898380 },
    { name:"小滿", longitudeDegrees:60, shouXingTtJulianDay:3184360.48350246, jplDe441TtJulianDay:3184360.480488553, epochErrorSeconds:260.401525 },
    { name:"芒種", longitudeDegrees:75, shouXingTtJulianDay:3184375.863625844, jplDe441TtJulianDay:3184375.860595695, epochErrorSeconds:261.804856 },
    { name:"夏至", longitudeDegrees:90, shouXingTtJulianDay:3184391.350420211, jplDe441TtJulianDay:3184391.347367893, epochErrorSeconds:263.720235 },
    { name:"小暑", longitudeDegrees:105, shouXingTtJulianDay:3184406.938802908, jplDe441TtJulianDay:3184406.935732442, epochErrorSeconds:265.288241 },
    { name:"大暑", longitudeDegrees:120, shouXingTtJulianDay:3184422.592104822, jplDe441TtJulianDay:3184422.589006019, epochErrorSeconds:267.736588 },
    { name:"立秋", longitudeDegrees:135, shouXingTtJulianDay:3184438.289565627, jplDe441TtJulianDay:3184438.286468762, epochErrorSeconds:267.569138 },
    { name:"處暑", longitudeDegrees:150, shouXingTtJulianDay:3184453.990473236, jplDe441TtJulianDay:3184453.987346215, epochErrorSeconds:270.174636 },
    { name:"白露", longitudeDegrees:165, shouXingTtJulianDay:3184469.665328996, jplDe441TtJulianDay:3184469.662216018, epochErrorSeconds:268.961325 },
    { name:"秋分", longitudeDegrees:180, shouXingTtJulianDay:3184485.280431198, jplDe441TtJulianDay:3184485.27731228, epochErrorSeconds:269.474499 },
    { name:"寒露", longitudeDegrees:195, shouXingTtJulianDay:3184500.807245694, jplDe441TtJulianDay:3184500.804162118, epochErrorSeconds:266.420925 },
    { name:"霜降", longitudeDegrees:210, shouXingTtJulianDay:3184516.228416373, jplDe441TtJulianDay:3184516.22533368, epochErrorSeconds:266.344683 },
    { name:"立冬", longitudeDegrees:225, shouXingTtJulianDay:3184531.525263068, jplDe441TtJulianDay:3184531.52221985, epochErrorSeconds:262.934040 },
    { name:"小雪", longitudeDegrees:240, shouXingTtJulianDay:3184546.700571445, jplDe441TtJulianDay:3184546.697540544, epochErrorSeconds:261.869833 },
    { name:"大雪", longitudeDegrees:255, shouXingTtJulianDay:3184561.750134193, jplDe441TtJulianDay:3184561.747132558, epochErrorSeconds:259.341301 },
    { name:"冬至", longitudeDegrees:270, shouXingTtJulianDay:3184211.445395395, jplDe441TtJulianDay:3184211.442412836, epochErrorSeconds:257.693110 },
    { name:"小寒", longitudeDegrees:285, shouXingTtJulianDay:3184226.30135852, jplDe441TtJulianDay:3184226.298395764, epochErrorSeconds:255.982116 },
    { name:"大寒", longitudeDegrees:300, shouXingTtJulianDay:3184241.08528289, jplDe441TtJulianDay:3184241.082333345, epochErrorSeconds:254.840702 },
    { name:"立春", longitudeDegrees:315, shouXingTtJulianDay:3184255.840260557, jplDe441TtJulianDay:3184255.837325938, epochErrorSeconds:253.551109 },
    { name:"雨水", longitudeDegrees:330, shouXingTtJulianDay:3184270.582650339, jplDe441TtJulianDay:3184270.579706053, epochErrorSeconds:254.386309 },
    { name:"驚蟄", longitudeDegrees:345, shouXingTtJulianDay:3184285.358026212, jplDe441TtJulianDay:3184285.355091192, epochErrorSeconds:253.585710 }
  ])
});

export const DIRECT_SEASONAL_INDEPENDENT_EVIDENCE = Object.freeze([
  JPL_DE441_SHOUXING_2026_CROSSCHECK,
  JPL_DE441_SHOUXING_4006_CROSSCHECK
]);
