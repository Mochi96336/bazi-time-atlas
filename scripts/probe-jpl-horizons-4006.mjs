import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { JulianDay, ShouXingUtil, SolarTime } from "../vendor/tyme4ts-1.5.2.mjs";
import { solarTerms } from "../src/data.js";

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const DAY_SECONDS = 86400;
const TROPICAL_YEAR_DAYS = 365.2422;
const TARGET_YEAR = 4006;
const API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function signedAngularDelta(actualDegrees, targetDegrees) {
  return ((actualDegrees - targetDegrees + 540) % 360) - 180;
}

function shouXingCandidateTtJulianDay(year, longitudeDegrees) {
  const targetLongitudeDegrees = normalizeDegrees(longitudeDegrees);
  const marchEquinoxGuess = SolarTime.fromYmdHms(year, 3, 20, 12, 0, 0)
    .getJulianDay()
    .getDay();
  let tropicalYearFraction = targetLongitudeDegrees / 360;
  if (targetLongitudeDegrees >= 270) tropicalYearFraction -= 1;
  const roughJulianDay = marchEquinoxGuess + tropicalYearFraction * TROPICAL_YEAR_DAYS;
  const roughTtCenturies = (roughJulianDay - JulianDay.J2000) / 36525;
  const roughUnwrappedLongitude = ShouXingUtil.saLon(roughTtCenturies, -1);
  const targetBaseRadians = targetLongitudeDegrees * DEG_TO_RAD;
  const turns = Math.round((roughUnwrappedLongitude - targetBaseRadians) / TWO_PI);
  const targetUnwrappedRadians = targetBaseRadians + turns * TWO_PI;
  return JulianDay.J2000 + ShouXingUtil.saLonT(targetUnwrappedRadians) * 36525;
}

async function horizonsTable({ startJd, stopJd, stepSize }) {
  const params = new URLSearchParams({
    format:"text",
    COMMAND:"'10'",
    OBJ_DATA:"'YES'",
    MAKE_EPHEM:"'YES'",
    EPHEM_TYPE:"'OBSERVER'",
    CENTER:"'500@399'",
    START_TIME:`'JD${startJd.toFixed(9)}'`,
    STOP_TIME:`'JD${stopJd.toFixed(9)}'`,
    STEP_SIZE:`'${stepSize}'`,
    QUANTITIES:"'31'",
    TIME_TYPE:"'TT'",
    TIME_DIGITS:"'FRACSEC'",
    CAL_FORMAT:"'BOTH'",
    ANG_FORMAT:"'DEG'",
    CSV_FORMAT:"'YES'",
    EXTRA_PREC:"'YES'"
  });
  const response = await fetch(`${API_URL}?${params}`);
  if (!response.ok) throw new Error(`Horizons HTTP ${response.status}`);
  const text = await response.text();
  if (!/Target body name:\s+Sun \(10\).*\{source: DE441\}/.test(text)) {
    throw new Error("Horizons response did not identify Sun source as DE441");
  }
  if (!/Center body name:\s+Earth \(399\).*\{source: DE441\}/.test(text)) {
    throw new Error("Horizons response did not identify Earth source as DE441");
  }
  if (!/Terrestrial Time \("TT"\) output was requested/.test(text)) {
    throw new Error("Horizons response did not confirm TT output");
  }
  const table = text.match(/\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/)?.[1];
  if (!table) throw new Error("Horizons response did not contain an ephemeris table");
  const rows = table.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const fields = line.split(",").map(field => field.trim());
    return {
      calendarTt:fields[0],
      jdTt:Number(fields[1]),
      longitudeDegrees:Number(fields[4])
    };
  });
  if (!rows.length || rows.some(row => !Number.isFinite(row.jdTt) || !Number.isFinite(row.longitudeDegrees))) {
    throw new Error("Horizons table parse failed");
  }
  return rows;
}

function interpolateCrossing(rows, targetDegrees) {
  for (let index = 1; index < rows.length; index += 1) {
    const left = rows[index - 1];
    const right = rows[index];
    const leftDelta = signedAngularDelta(left.longitudeDegrees, targetDegrees);
    const rightDelta = signedAngularDelta(right.longitudeDegrees, targetDegrees);
    if (leftDelta <= 0 && rightDelta >= 0 && rightDelta - leftDelta < 5) {
      const fraction = -leftDelta / (rightDelta - leftDelta);
      return left.jdTt + fraction * (right.jdTt - left.jdTt);
    }
  }
  throw new Error(`No ${targetDegrees}° crossing found in Horizons table`);
}

async function solveHorizonsCrossing(candidateJd, targetDegrees) {
  const coarseRows = await horizonsTable({
    startJd:candidateJd - 0.5,
    stopJd:candidateJd + 0.5,
    stepSize:"10 m"
  });
  const coarseJd = interpolateCrossing(coarseRows, targetDegrees);
  const refineHalfWindowDays = 2 / 1440;
  const refinedRows = await horizonsTable({
    startJd:coarseJd - refineHalfWindowDays,
    stopJd:coarseJd + refineHalfWindowDays,
    stepSize:"240"
  });
  return interpolateCrossing(refinedRows, targetDegrees);
}

const evidenceTerms = [];
for (const term of solarTerms) {
  const candidateJd = shouXingCandidateTtJulianDay(TARGET_YEAR, term.longitude);
  const jplJd = await solveHorizonsCrossing(candidateJd, term.longitude);
  const errorSeconds = (candidateJd - jplJd) * DAY_SECONDS;
  evidenceTerms.push({
    name:term.name,
    longitudeDegrees:term.longitude,
    shouXingTtJulianDay:Number(candidateJd.toFixed(9)),
    jplDe441TtJulianDay:Number(jplJd.toFixed(9)),
    errorSeconds:Number(errorSeconds.toFixed(6))
  });
  console.error(`${term.name.padEnd(2)} ${String(term.longitude).padStart(3)}° error ${errorSeconds.toFixed(6)} s`);
}

const absoluteErrors = evidenceTerms.map(term => Math.abs(term.errorSeconds));
const evidence = {
  schemaVersion:1,
  id:"jpl-horizons-de441-4006-24-term",
  authority:"NASA/JPL Horizons",
  referenceFamily:"jpl-de441",
  sourceEphemeris:"DE441",
  target:"Sun (10)",
  observerCenter:"Earth geocenter (399)",
  quantity:"31 · observer-centered IAU76/80 ecliptic-of-date apparent longitude",
  referenceSemantics:"apparent-geocentric-solar-longitude-of-date",
  timeScale:"TT",
  providerCandidate:"tyme4ts-1.5.2-shouxing-direct",
  providerModelFamily:"shouxing",
  catalogueYear:TARGET_YEAR,
  samples:evidenceTerms.length,
  maxAbsEpochErrorSeconds:Number(Math.max(...absoluteErrors).toFixed(6)),
  meanAbsEpochErrorSeconds:Number((absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length).toFixed(6)),
  terms:evidenceTerms
};

const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
const sha256 = createHash("sha256").update(serialized).digest("hex");
await writeFile("jpl-horizons-4006-evidence.json", serialized);
console.log(serialized);
console.log(`SHA256 ${sha256}`);
