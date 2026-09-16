#!/usr/bin/env python3
"""Empirical decomposition of Swiss Ephemeris year-4006 EoT derivative.

This is a reconnaissance aid for a later certificate. It deliberately does not
promote sampled component speeds to a certified derivative bound.
"""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import swisseph as swe

TARGET_YEAR = 4006
STEP_SECONDS = 300
STEP_DAYS = STEP_SECONDS / 86400.0
SECONDS_PER_DEGREE = 240.0
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "tmp/swiss-eot-derivative-components-4006"))
EPHE_PATH = os.environ["SWISS_EPHE_PATH"]

# Same immutable planning budget left after the production analytic certificate.
SWISS_PLANNING_BUDGET_SECONDS_PER_DAY = 114.00594286480292


def gregorian_jd(year: int, month: int, day: int, hour: float = 0.0) -> float:
    return swe.julday(year, month, day, hour, swe.GREG_CAL)


def wrap_signed_degrees(value: float) -> float:
    return (value + 180.0) % 360.0 - 180.0


def sidereal_residual_degrees(jd_ut: float) -> float:
    """Swiss swe_time_equ's sidereal term after removing 360 deg / UT day.

    swe_time_equ() computes swe_sidtime(tjd_ut), then subtracts the fractional
    UT day in 24-hour units before converting hours to degrees. This function
    reconstructs exactly that public-API quantity modulo a full turn.
    """
    sidereal_degrees = swe.sidtime(jd_ut) * 15.0
    fractional_day = (jd_ut + 0.5) - math.floor(jd_ut + 0.5)
    return (sidereal_degrees - fractional_day * 360.0) % 360.0


def sun_ra_and_speed(jd_ut: float) -> tuple[float, float, int]:
    flags = swe.FLG_SWIEPH | swe.FLG_EQUATORIAL | swe.FLG_SPEED
    values, retflag = swe.calc_ut(jd_ut, swe.SUN, flags)
    return float(values[0]), float(values[3]), int(retflag)


def eot_seconds(jd_ut: float) -> float:
    return float(swe.time_equ(jd_ut)) * 86400.0


def main() -> None:
    swe.set_ephe_path(EPHE_PATH)
    start_jd = gregorian_jd(TARGET_YEAR, 1, 1)
    end_jd = gregorian_jd(TARGET_YEAR + 1, 1, 1)
    interval_count = round((end_jd - start_jd) / STEP_DAYS)
    if interval_count != 105120:
        raise RuntimeError(f"unexpected interval count {interval_count}")

    worst = {
        "siderealResidualForwardSlopeDegPerDay": {"abs": -1.0},
        "sunRaForwardSlopeDegPerDay": {"abs": -1.0},
        "sunRaEngineSpeedDegPerDay": {"abs": -1.0},
        "componentDifferenceForwardSolarSecondsPerDay": {"abs": -1.0},
        "eotForwardSolarSecondsPerDay": {"abs": -1.0},
        "componentVsEotMismatchSolarSecondsPerDay": {"abs": -1.0},
    }

    def update(name: str, value: float, index: int, **extra: object) -> None:
        magnitude = abs(value)
        if magnitude > worst[name]["abs"]:
            timestamp = datetime(TARGET_YEAR, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=index * STEP_SECONDS)
            worst[name] = {
                "abs": magnitude,
                "signed": value,
                "index": index,
                "start": timestamp.isoformat(),
                "end": (timestamp + timedelta(seconds=STEP_SECONDS)).isoformat(),
                **extra,
            }

    prev_jd = start_jd
    prev_sid = sidereal_residual_degrees(prev_jd)
    prev_ra, prev_ra_speed, prev_flag = sun_ra_and_speed(prev_jd)
    prev_eot = eot_seconds(prev_jd)
    if not (prev_flag & swe.FLG_SWIEPH):
        raise RuntimeError(f"Swiss Sun did not use SWIEPH at first sample: retflag={prev_flag}")

    max_ra_speed_vs_forward_diff = 0.0
    swieph_samples = 1

    for index in range(interval_count):
        jd = start_jd + (index + 1) * STEP_DAYS
        sid = sidereal_residual_degrees(jd)
        ra, ra_speed, retflag = sun_ra_and_speed(jd)
        eot = eot_seconds(jd)
        if not (retflag & swe.FLG_SWIEPH):
            raise RuntimeError(f"Swiss Sun did not use SWIEPH at sample {index + 1}: retflag={retflag}")
        swieph_samples += 1

        sid_forward = wrap_signed_degrees(sid - prev_sid) / STEP_DAYS
        ra_forward = wrap_signed_degrees(ra - prev_ra) / STEP_DAYS
        component_difference = (sid_forward - ra_forward) * SECONDS_PER_DEGREE
        eot_forward = (eot - prev_eot) / STEP_DAYS
        mismatch = component_difference - eot_forward
        max_ra_speed_vs_forward_diff = max(
            max_ra_speed_vs_forward_diff,
            abs(prev_ra_speed - ra_forward),
            abs(ra_speed - ra_forward),
        )

        update("siderealResidualForwardSlopeDegPerDay", sid_forward, index)
        update("sunRaForwardSlopeDegPerDay", ra_forward, index)
        update("sunRaEngineSpeedDegPerDay", prev_ra_speed, index)
        update("sunRaEngineSpeedDegPerDay", ra_speed, index)
        update("componentDifferenceForwardSolarSecondsPerDay", component_difference, index)
        update("eotForwardSolarSecondsPerDay", eot_forward, index)
        update("componentVsEotMismatchSolarSecondsPerDay", mismatch, index)

        prev_jd = jd
        prev_sid = sid
        prev_ra = ra
        prev_ra_speed = ra_speed
        prev_eot = eot

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "empirical decomposition of Swiss swe_time_equ derivative components before interval certification",
        "targetYear": TARGET_YEAR,
        "cadenceSeconds": STEP_SECONDS,
        "intervals": interval_count,
        "samplesIncludingTerminalEndpoint": interval_count + 1,
        "swiephSamples": swieph_samples,
        "formula": {
            "continuousLift": "EoT_angle = (sidereal_time - 360deg*fractional_UT_day) - Sun_apparent_RA - 180deg",
            "derivative": "EoT_angle' = sidereal_residual' - Sun_apparent_RA'",
            "solarSecondsPerDegree": SECONDS_PER_DEGREE,
        },
        "worstObserved": worst,
        "sunRaEngineSpeedVsFiveMinuteForwardDifferenceMaxDegPerDay": max_ra_speed_vs_forward_diff,
        "planning": {
            "remainingSwissDerivativeBudgetSolarSecondsPerDay": SWISS_PLANNING_BUDGET_SECONDS_PER_DAY,
            "observedEotDerivativeToBudgetRatio": worst["eotForwardSolarSecondsPerDay"]["abs"] / SWISS_PLANNING_BUDGET_SECONDS_PER_DAY,
        },
        "interpretation": {
            "empiricalOnly": True,
            "usesSwissPublicSpeedOutput": True,
            "certifiedSiderealDerivativeBound": False,
            "certifiedSunRaDerivativeBound": False,
            "certifiedSwissEotDerivativeBound": False,
            "residualDerivativeCertified": False,
            "continuousResidualUpperBound": False,
            "recurrenceAuthorityGranted": False,
            "reason": "Five-minute forward differences and Swiss public speed outputs identify the component scale and cancellation but do not certify extrema between samples or bound the full continuous derivative.",
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
