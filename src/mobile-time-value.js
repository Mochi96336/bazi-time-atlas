export const MOBILE_ATLAS_UTC_OFFSET_HOURS = 8;

const INPUT_RE = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;

function pad(value, size = 2) {
  return String(value).padStart(size, "0");
}

export function formatMobileAtlasInput(ms) {
  if (!Number.isFinite(ms)) return "";
  const shifted = new Date(ms + MOBILE_ATLAS_UTC_OFFSET_HOURS * 3_600_000);
  if (!Number.isFinite(shifted.getTime())) return "";
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
    + `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
}

export function parseMobileAtlasInput(value) {
  const match = INPUT_RE.exec(String(value ?? ""));
  if (!match) return null;

  const [, y, mo, d, h, min, sec, fraction = ""] = match;
  const fields = {
    year:Number(y),
    month:Number(mo),
    day:Number(d),
    hour:Number(h),
    minute:Number(min),
    second:Number(sec),
    millisecond:Number(fraction.padEnd(3, "0") || 0)
  };
  if (
    fields.month < 1 || fields.month > 12
    || fields.day < 1 || fields.day > 31
    || fields.hour < 0 || fields.hour > 23
    || fields.minute < 0 || fields.minute > 59
    || fields.second < 0 || fields.second > 59
  ) return null;

  const shifted = new Date(0);
  shifted.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  shifted.setUTCHours(fields.hour, fields.minute, fields.second, fields.millisecond);
  if (!Number.isFinite(shifted.getTime())) return null;
  if (
    shifted.getUTCFullYear() !== fields.year
    || shifted.getUTCMonth() + 1 !== fields.month
    || shifted.getUTCDate() !== fields.day
    || shifted.getUTCHours() !== fields.hour
    || shifted.getUTCMinutes() !== fields.minute
    || shifted.getUTCSeconds() !== fields.second
  ) return null;

  return shifted.getTime() - MOBILE_ATLAS_UTC_OFFSET_HOURS * 3_600_000;
}
