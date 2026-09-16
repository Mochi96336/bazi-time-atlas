#!/usr/bin/env python3
import json
import math
import os
from pathlib import Path

import swisseph as swe

TARGET_YEAR = 4006
STEP_MINUTES = 5
STEP_DAYS = STEP_MINUTES / 1440.0
EXPECTED_INTERIOR_SAMPLES = 105120
EXPECTED_TOTAL_SAMPLES = EXPECTED_INTERIOR_SAMPLES + 1
SECONDS_PER_DAY = 86400.0
SOLAR_SECONDS_PER_DEGREE = 240.0
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "tmp/swiss-eot-derivative-components-4006"))


def is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def month_lengths(year: int):
    return [31, 29 if is_leap_year(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def sample_grid(year: int):
    rows = []
    for month, days in enumerate(month_lengths(year), start=1):
        for day in range(1, days + 1):
            for minute_of_day in range(0, 1440, STEP_MINUTES):
                rows.append((year, month, day, minute_of_day // 60, minute_of_day % 60, 0.0))
    rows.append((year + 1, 1, 1, 0, 0, 0.0))
    return rows


def label(parts):
    year, month, day, hour, minute, second = parts
    return f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{int(second):02d}"


def angular_delta_degrees(start: float, end: float) -> float:
    return ((end - start + 180.0) % 360.0) - 180.0


def corrected_sidereal_angle_degrees(jd_ut: float) -> float:
    # Mirrors swe_time_equ(): sidereal hours -> degrees, then removes the
    # UT day-fraction 360-degree rotation. The remaining continuous lift is
    # the long-term sidereal correction compared against apparent Sun RA.
    sidereal_degrees = swe.sidtime(jd_ut) * 15.0
    fraction = (jd_ut + 0.5) - math.floor(jd_ut + 0.5)
    return (sidereal_degrees - fraction * 360.0) % 360.0


def require_swisseph(jd_ut: float, body: int, flags: int, name: str):
    values, retflags = swe.calc_ut(jd_ut, body, flags)
    ephemeris_flag = int(retflags & (swe.FLG_JPLEPH | swe.FLG_SWIEPH | swe.FLG_MOSEPH))
    if ephemeris_flag != swe.FLG_SWIEPH:
        raise RuntimeError(f"Swiss Ephemeris did not use SWIEPH for {name}: retflags={retflags}")
    return values, retflags


def summarize(values):
    return {
        "count": len(values),
        "min": min(values),
        "max": max(values),
        "maxAbs": max(abs(v) for v in values),
        "mean": sum(values) / len(values),
    }


def main():
    ephe_path = os.environ.get("SWISSEPH_EPHE_PATH")
    if not ephe_path:
        raise RuntimeError("SWISSEPH_EPHE_PATH is required")
    swe.set_ephe_path(ephe_path)

    samples = sample_grid(TARGET_YEAR)
    if len(samples) != EXPECTED_TOTAL_SAMPLES:
        raise RuntimeError(f"expected {EXPECTED_TOTAL_SAMPLES} samples, got {len(samples)}")

    rows = []
    sun_flags = swe.FLG_SWIEPH | swe.FLG_EQUATORIAL | swe.FLG_SPEED
    moon_flags = swe.FLG_SWIEPH

    for index, parts in enumerate(samples):
        year, month, day, hour, minute, second = parts
        jd_ut = swe.julday(year, month, day, hour + minute / 60.0 + second / 3600.0, swe.GREG_CAL)
        sun, sun_retflags = require_swisseph(jd_ut, swe.SUN, sun_flags, "Sun")
        _, moon_retflags = require_swisseph(jd_ut, swe.MOON, moon_flags, "Moon")
        eot_seconds = float(swe.time_equ(jd_ut)) * SECONDS_PER_DAY
        rows.append({
            "index": index,
            "label": label(parts),
            "julianDayUt": jd_ut,
            "equationOfTimeSeconds": eot_seconds,
            "correctedSiderealAngleDegrees": corrected_sidereal_angle_degrees(jd_ut),
            "sunRightAscensionDegrees": float(sun[0]),
            "sunDeclinationDegrees": float(sun[1]),
            "sunDistanceAu": float(sun[2]),
            "sunRightAscensionSpeedDegreesPerDay": float(sun[3]),
            "sunDeclinationSpeedDegreesPerDay": float(sun[4]),
            "sunDistanceSpeedAuPerDay": float(sun[5]),
            "deltaTSeconds": float(swe.deltat_ex(jd_ut, swe.FLG_SWIEPH)) * SECONDS_PER_DAY,
            "sunRetflags": int(sun_retflags),
            "moonRetflags": int(moon_retflags),
        })

    intervals = []
    for index in range(len(rows) - 1):
        start = rows[index]
        end = rows[index + 1]
        dt_days = end["julianDayUt"] - start["julianDayUt"]
        if abs(dt_days - STEP_DAYS) > 5e-10:
            raise RuntimeError(f"unexpected interval {dt_days} days at {start['label']}")
        sidereal_rate = angular_delta_degrees(
            start["correctedSiderealAngleDegrees"], end["correctedSiderealAngleDegrees"]
        ) / dt_days
        ra_secant_rate = angular_delta_degrees(
            start["sunRightAscensionDegrees"], end["sunRightAscensionDegrees"]
        ) / dt_days
        eot_secant_seconds_per_day = (
            end["equationOfTimeSeconds"] - start["equationOfTimeSeconds"]
        ) / dt_days
        component_secant_seconds_per_day = (
            sidereal_rate - ra_secant_rate
        ) * SOLAR_SECONDS_PER_DEGREE
        speed_component_seconds_per_day = (
            sidereal_rate - start["sunRightAscensionSpeedDegreesPerDay"]
        ) * SOLAR_SECONDS_PER_DEGREE
        intervals.append({
            "index": index,
            "start": start["label"],
            "end": end["label"],
            "siderealCorrectedForwardDegreesPerDay": sidereal_rate,
            "sunRaForwardDegreesPerDay": ra_secant_rate,
            "sunRaSpeedAtStartDegreesPerDay": start["sunRightAscensionSpeedDegreesPerDay"],
            "eotForwardSecondsPerDay": eot_secant_seconds_per_day,
            "componentForwardSecondsPerDay": component_secant_seconds_per_day,
            "speedComponentAtStartSecondsPerDay": speed_component_seconds_per_day,
            "componentVsEotForwardMismatchSecondsPerDay": (
                component_secant_seconds_per_day - eot_secant_seconds_per_day
            ),
        })

    def values(field):
        return [row[field] for row in intervals]

    worst_eot = max(intervals, key=lambda row: abs(row["eotForwardSecondsPerDay"]))
    worst_component = max(intervals, key=lambda row: abs(row["componentForwardSecondsPerDay"]))
    worst_speed_component = max(intervals, key=lambda row: abs(row["speedComponentAtStartSecondsPerDay"]))
    max_component_mismatch = max(abs(row["componentVsEotForwardMismatchSecondsPerDay"]) for row in intervals)

    manifest = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "purpose": "empirical component reconnaissance for a future certified Swiss Equation-of-Time derivative bound",
        "semantics": {
            "empiricalOnly": True,
            "sunRaSpeedSamplesAreNotGlobalBounds": True,
            "siderealSecantsAreNotDerivativeBounds": True,
            "certifiedSwissDerivativeBound": False,
            "certifiedResidualDerivativeBound": False,
            "continuousResidualUpperBound": False,
            "deterministicMembership": False,
            "recurrenceAuthorityGranted": False,
        },
        "target": {
            "year": TARGET_YEAR,
            "calendar": "proleptic Gregorian",
            "inputTimeScale": "UT",
            "samples": len(rows),
            "intervals": len(intervals),
            "cadenceMinutes": STEP_MINUTES,
            "terminalEndpoint": "4007-01-01T00:00:00",
        },
        "reference": {
            "library": "Swiss Ephemeris",
            "version": swe.version,
            "equationOfTimeFunction": "swe_time_equ(tjd_ut)",
            "siderealFunction": "swe_sidtime(tjd_ut)",
            "sunStateFunction": "swe_calc_ut(tjd_ut, SE_SUN, SEFLG_SWIEPH|SEFLG_EQUATORIAL|SEFLG_SPEED)",
            "ephemerisPath": ephe_path,
        },
        "observed": {
            "correctedSiderealForwardDegreesPerDay": summarize(values("siderealCorrectedForwardDegreesPerDay")),
            "sunRaForwardDegreesPerDay": summarize(values("sunRaForwardDegreesPerDay")),
            "sunRaSpeedAtStartDegreesPerDay": summarize(values("sunRaSpeedAtStartDegreesPerDay")),
            "eotForwardSecondsPerDay": summarize(values("eotForwardSecondsPerDay")),
            "componentForwardSecondsPerDay": summarize(values("componentForwardSecondsPerDay")),
            "speedComponentAtStartSecondsPerDay": summarize(values("speedComponentAtStartSecondsPerDay")),
            "componentVsEotForwardMaxMismatchSecondsPerDay": max_component_mismatch,
            "worstEotForward": worst_eot,
            "worstComponentForward": worst_component,
            "worstSpeedComponentAtStart": worst_speed_component,
        },
        "planning": {
            "remainingSwissDerivativeBudgetSecondsPerDay": 114.00594286480292,
            "remainingSwissDerivativeBudgetDegreesPerDay": 114.00594286480292 / SOLAR_SECONDS_PER_DEGREE,
            "comparisonIsCertification": False,
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    with (OUTPUT_DIR / "component-series.ndjson").open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, separators=(",", ":")) + "\n")
    with (OUTPUT_DIR / "interval-series.ndjson").open("w", encoding="utf-8") as handle:
        for row in intervals:
            handle.write(json.dumps(row, separators=(",", ":")) + "\n")

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
