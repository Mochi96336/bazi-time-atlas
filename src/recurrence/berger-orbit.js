// Berger (1978) long-term Earth-orbit approximation.
// Coefficients follow the public ORBPAR implementation attributed to Gary L. Russell
// and Berger, J. Atmos. Sci. 35 (1978), 2362–2367.
//
// IMPORTANT: This module is used only for long-term SHAPE comparisons.
// It does not predict civil-time solar-term instants, ΔT, or historical calendars.

export const BERGER_MODEL = Object.freeze({
  id: "berger-1978",
  epochYear: 1950,
  validityYearsFromEpoch: 1_000_000,
  normalizedTropicalYearDays: 365.2422
});

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const ECCENTRICITY_TERMS = Object.freeze([
  [0.01860798, 4.207205, 28.620089],
  [0.01627522, 7.346091, 193.788772],
  [-0.01300660, 17.857263, 308.307024],
  [0.00988829, 17.220546, 320.199637],
  [-0.00336700, 16.846733, 279.376984],
  [0.00333077, 5.199079, 87.195000],
  [-0.00235400, 18.231076, 349.129677],
  [0.00140015, 26.216758, 128.443387],
  [0.00100700, 6.359169, 154.143880],
  [0.00085700, 16.210016, 291.269597],
  [0.00064990, 3.065181, 114.860583],
  [0.00059900, 16.583829, 332.092251],
  [0.00037800, 18.493980, 296.414411],
  [-0.00033700, 6.190953, 145.769910],
  [0.00027600, 18.867793, 337.237063],
  [0.00018200, 17.425567, 152.092288],
  [-0.00017400, 6.186001, 126.839891],
  [-0.00012400, 18.417441, 210.667199],
  [0.00001250, 0.667863, 72.108838]
]);

const PRECESSION_TERMS = Object.freeze([
  [7391.0225890, 31.609974, 251.9025],
  [2555.1526947, 32.620504, 280.8325],
  [2022.7629188, 24.172203, 128.3057],
  [-1973.6517951, 0.636717, 348.1074],
  [1240.2321818, 31.983787, 292.7252],
  [953.8679112, 3.138886, 165.1686],
  [-931.7537108, 30.973257, 263.7951],
  [872.3795383, 44.828336, 15.3747],
  [606.3544732, 0.991874, 58.5749],
  [-496.0274038, 0.373813, 40.8226],
  [456.9608039, 43.668246, 308.4258],
  [346.9462320, 32.246691, 240.0099],
  [-305.8412902, 30.599444, 222.9725],
  [249.6173246, 2.147012, 106.5937],
  [-199.1027200, 10.511172, 114.5182],
  [191.0560889, 42.681324, 268.7809],
  [-175.2936572, 13.650058, 279.6869],
  [165.9068833, 0.986922, 39.6448],
  [161.1285917, 9.874455, 126.4108],
  [139.7878093, 13.013341, 291.5795],
  [-133.5228399, 0.262904, 307.2848],
  [117.0673811, 0.004952, 18.9300],
  [104.6907281, 1.142024, 273.7596],
  [95.3227476, 63.219948, 143.8050],
  [86.7824524, 0.205021, 191.8927],
  [86.0857729, 2.151964, 125.5237],
  [70.5893698, 64.230478, 172.7351],
  [-69.9719343, 43.836462, 316.7998],
  [-62.5817473, 47.439436, 319.6024],
  [61.5450059, 1.384343, 69.7526],
  [-57.9364011, 7.437771, 123.5968],
  [57.1899832, 18.829299, 217.6432],
  [-57.0236109, 9.500642, 85.5882],
  [-54.2119253, 0.431696, 156.2147],
  [53.2834147, 1.160090, 66.9489],
  [52.1223575, 55.782177, 20.2082],
  [-49.0059908, 12.639528, 250.7568],
  [-48.3118757, 1.155138, 48.0188],
  [-45.4191685, 0.168216, 8.3739],
  [-42.2357920, 1.647247, 17.0374],
  [-34.7971099, 10.884985, 155.3409],
  [34.4623613, 5.610937, 94.1709],
  [-33.8356643, 12.658184, 221.1120],
  [33.6689362, 1.010530, 28.9300],
  [-31.2521586, 1.983748, 117.1498],
  [-30.8798701, 14.023871, 320.5095],
  [28.4640769, 0.560178, 262.3602],
  [-27.1960802, 1.273434, 336.2148],
  [27.0860736, 12.021467, 233.0046],
  [-26.3437456, 62.583231, 155.6977],
  [24.7253740, 63.593761, 184.6277],
  [24.6732126, 76.438310, 267.2772],
  [24.4272733, 4.280910, 78.9281],
  [24.0127327, 13.218362, 123.4722],
  [21.7150294, 17.818769, 188.7132],
  [-21.5375347, 8.359495, 180.1364],
  [18.1148363, 56.792707, 49.1382],
  [-16.9603104, 8.448301, 152.5268],
  [-16.1765215, 1.978796, 98.2198],
  [15.5567653, 8.863925, 97.4808],
  [15.4846529, 0.186365, 221.5376],
  [15.2150632, 8.996212, 168.2438],
  [14.5047426, 6.771027, 161.1199],
  [-14.3873316, 45.815258, 55.0196],
  [13.1351419, 12.002811, 262.6495],
  [12.8776311, 75.278220, 200.3284],
  [11.9867234, 65.241008, 201.6651],
  [11.9385578, 18.870667, 294.6547],
  [11.7030822, 22.009553, 99.8233],
  [11.6018181, 64.604291, 213.5577],
  [-11.2617293, 11.498094, 154.1631],
  [-10.4664199, 0.578834, 232.7153],
  [10.4333970, 9.237738, 138.3034],
  [-10.2377466, 49.747842, 204.6609],
  [10.1934446, 2.147012, 106.5938],
  [-10.1280191, 1.196895, 250.4676],
  [10.0289441, 2.133898, 332.3345],
  [-10.0034259, 0.173168, 27.3039]
]);

export const JIE_LONGITUDES = Object.freeze([
  ["清明", 15], ["立夏", 45], ["芒種", 75], ["小暑", 105],
  ["立秋", 135], ["白露", 165], ["寒露", 195], ["立冬", 225],
  ["大雪", 255], ["小寒", 285], ["立春", 315], ["驚蟄", 345]
]);

function normalizeRadians(value) {
  return ((value % TAU) + TAU) % TAU;
}

function assertModelYear(year) {
  if (!Number.isFinite(year)) throw new RangeError("year must be finite");
  const distance = Math.abs(year - BERGER_MODEL.epochYear);
  if (distance > BERGER_MODEL.validityYearsFromEpoch) {
    throw new RangeError(`year ${year} lies outside Berger 1978 ±${BERGER_MODEL.validityYearsFromEpoch.toLocaleString("en-US")}-year precision range`);
  }
}

export function bergerOrbitalParameters(year) {
  assertModelYear(year);
  const t = year - BERGER_MODEL.epochYear;

  let eSinPi = 0;
  let eCosPi = 0;
  for (const [amplitude, frequencyArcsecPerYear, phaseDegrees] of ECCENTRICITY_TERMS) {
    const argument = (t * frequencyArcsecPerYear / 3600 + phaseDegrees) * DEG;
    eSinPi += amplitude * Math.sin(argument);
    eCosPi += amplitude * Math.cos(argument);
  }

  const eccentricity = Math.hypot(eSinPi, eCosPi);
  const pie = Math.atan2(eSinPi, eCosPi);

  let periodicPrecessionArcsec = 0;
  for (const [amplitudeArcsec, frequencyArcsecPerYear, phaseDegrees] of PRECESSION_TERMS) {
    const argument = (t * frequencyArcsecPerYear / 3600 + phaseDegrees) * DEG;
    periodicPrecessionArcsec += amplitudeArcsec * Math.sin(argument);
  }

  const psi = (3.392506 + (t * 50.439273 + periodicPrecessionArcsec) / 3600) * DEG;
  const perihelionLongitudeRadians = normalizeRadians(pie + psi + Math.PI);

  return Object.freeze({
    year,
    eccentricity,
    perihelionLongitudeRadians,
    perihelionLongitudeDegrees: perihelionLongitudeRadians / DEG
  });
}

function meanAnomalyAtSolarLongitude(parameters, solarLongitudeDegrees) {
  const earthTrueLongitude = normalizeRadians((solarLongitudeDegrees + 180) * DEG);
  const trueAnomaly = normalizeRadians(earthTrueLongitude - parameters.perihelionLongitudeRadians);
  const e = parameters.eccentricity;

  const eccentricAnomaly = normalizeRadians(2 * Math.atan2(
    Math.sqrt(1 - e) * Math.sin(trueAnomaly / 2),
    Math.sqrt(1 + e) * Math.cos(trueAnomaly / 2)
  ));

  return normalizeRadians(eccentricAnomaly - e * Math.sin(eccentricAnomaly));
}

export function normalizedSolarLongitudeOffsetDays(year, solarLongitudeDegrees) {
  const parameters = bergerOrbitalParameters(year);
  const startMeanAnomaly = meanAnomalyAtSolarLongitude(parameters, 0);
  const targetMeanAnomaly = meanAnomalyAtSolarLongitude(parameters, solarLongitudeDegrees);
  const phase = normalizeRadians(targetMeanAnomaly - startMeanAnomaly) / TAU;
  return phase * BERGER_MODEL.normalizedTropicalYearDays;
}

export function solarTermShapeResiduals(baseYear, targetYear) {
  const baseParameters = bergerOrbitalParameters(baseYear);
  const targetParameters = bergerOrbitalParameters(targetYear);

  const terms = JIE_LONGITUDES.map(([name, longitude]) => {
    const baseOffsetDays = normalizedSolarLongitudeOffsetDays(baseYear, longitude);
    const targetOffsetDays = normalizedSolarLongitudeOffsetDays(targetYear, longitude);
    const residualDays = targetOffsetDays - baseOffsetDays;
    return Object.freeze({
      name,
      longitude,
      baseOffsetDays,
      targetOffsetDays,
      residualDays,
      residualHours: residualDays * 24
    });
  });

  const residualHours = terms.map(term => term.residualHours);
  const maxAbsHours = Math.max(...residualHours.map(Math.abs));
  const rmsHours = Math.sqrt(residualHours.reduce((sum, value) => sum + value * value, 0) / residualHours.length);
  const minHours = Math.min(...residualHours);
  const maxHours = Math.max(...residualHours);

  return Object.freeze({
    model: BERGER_MODEL,
    baseYear,
    targetYear,
    baseParameters,
    targetParameters,
    anchor: "vernal-equinox-solar-longitude-0",
    normalizationDays: BERGER_MODEL.normalizedTropicalYearDays,
    terms: Object.freeze(terms),
    maxAbsHours,
    rmsHours,
    minHours,
    maxHours,
    closed: maxAbsHours < 1e-9
  });
}
