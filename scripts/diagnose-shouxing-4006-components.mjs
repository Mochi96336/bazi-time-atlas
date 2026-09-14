import { JulianDay, ShouXingUtil } from "../vendor/tyme4ts-1.5.2.mjs";

const RAD_TO_ARCSEC = 180 / Math.PI * 3600;
const samples = [
  ["冬至", 3184211.445395395],
  ["立春", 3184255.840260557],
  ["春分", 3184300.181444289],
  ["夏至", 3184391.350420211],
  ["秋分", 3184485.280431198]
];

for (const [name, jd] of samples) {
  const t = (jd - JulianDay.J2000) / 36525;
  console.log(JSON.stringify({
    name,
    ttJulianDay:jd,
    centuriesFromJ2000:t,
    nutationLonArcseconds:ShouXingUtil.nutationLon2(t) * RAD_TO_ARCSEC,
    solarAberrationLonArcseconds:ShouXingUtil.gxcSunLon(t) * RAD_TO_ARCSEC,
    solarApparentLongitudeRadians:ShouXingUtil.saLon(t, -1)
  }));
}
