import { writeFile } from "node:fs/promises";
import { solarTerms } from "../src/data.js";
import { solveSolarLongitude } from "../src/astronomy/direct-seasonal-event-provider.js";

const candidates = solarTerms.map(term => {
  const solved = solveSolarLongitude({ year:2026, longitudeDegrees:term.longitude });
  return {
    name:term.name,
    longitudeDegrees:term.longitude,
    shouXingTtJulianDay:solved.ttJulianDay
  };
});
await writeFile("shouxing-2026-candidates.json", `${JSON.stringify(candidates, null, 2)}\n`);
console.log(JSON.stringify(candidates));
