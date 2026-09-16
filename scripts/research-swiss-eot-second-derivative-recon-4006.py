#!/usr/bin/env python3
"""Empirical year-4006 Swiss EoT second-derivative reconnaissance.

This script sizes a later source/interval proof. Observed second differences and
Swiss speed changes are not treated as certified continuous derivative bounds.
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
SOLAR_SECONDS_PER_DEGREE = 240.0
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "tmp/swiss-eot-second-derivative-recon-4006"))
EPHE_PATH = os.environ["SWISS_EPHE_PATH"]

CERTIFIED_SECOND_DERIVATIVE_THRESHOLD_DEG_PER_DAY2 = 104.94059155911904


def gregorian_jd(year: int, month: int, day: int, hour: float = 0.0) -> float:
    return swe.julday(year, month, day, hour, swe.GREG_CAL)


def wrap_signed_degrees(value: float) -> float:
    return (value + 180.0) % 360.0 - 180.0


def sidereal_residual_degrees(jd_ut: float) -> float:
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

    worst: dict[str, dict[str, float | int | str]] = {
        "eotForwardSlopeSolarSecondsPerDay": {"abs": -1.0},
        "eotObservedSecondDifferenceDegPerDaySquared": {"abs": -1.0},
        "siderealResidualObservedSecondDifferenceDegPerDaySquared": {"abs": -1.0},
        "sunRaForwardObservedSecondDifferenceDegPerDaySquared": {"abs": -1.0},
        "sunRaEngineSpeedObservedAccelerationDegPerDaySquared": {"abs": -1.0},
    }

    def update(name: str, value: float, index: int) -> None:
        magnitude = abs(value)
        if magnitude <= float(worst[name]["abs"]):
            return
        timestamp = datetime(TARGET_YEAR, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=index * STEP_SECONDS)
        worst[name] = {
            "abs": magnitude,
            "signed": value,
            "index": index,
            "time": timestamp.isoformat(),
        }

    jd0 = start_jd
    eot0 = eot_seconds(jd0)
    sid0 = sidereal_residual_degrees(jd0)
    ra0, ra_speed0, flag0 = sun_ra_and_speed(jd0)
    if not (flag0 & swe.FLG_SWIEPH):
        raise RuntimeError(f"Swiss Sun did not use SWIEPH at first sample: retflag={flag0}")

    prev_eot = eot0
    prev_sid = sid0
    prev_ra = ra0
    prev_ra_speed = ra_speed0
    prev_eot_forward = None
    prev_sid_forward = None
    prev_ra_forward = None

    min_ra_speed = ra_speed0
    max_ra_speed = ra_speed0
    swieph_samples = 1

    for interval_index in range(interval_count):
        jd = start_jd + (interval_index + 1) * STEP_DAYS
        eot = eot_seconds(jd)
        sid = sidereal_residual_degrees(jd)
        ra, ra_speed, retflag = sun_ra_and_speed(jd)
        if not (retflag & swe.FLG_SWIEPH):
            raise RuntimeError(
                f"Swiss Sun did not use SWIEPH at sample {interval_index + 1}: retflag={retflag}"
            )
        swieph_samples += 1
        min_ra_speed = min(min_ra_speed, ra_speed)
        max_ra_speed = max(max_ra_speed, ra_speed)

        eot_forward = (eot - prev_eot) / STEP_DAYS
        sid_forward = wrap_signed_degrees(sid - prev_sid) / STEP_DAYS
        ra_forward = wrap_signed_degrees(ra - prev_ra) / STEP_DAYS
        update("eotForwardSlopeSolarSecondsPerDay", eot_forward, interval_index)

        if prev_eot_forward is not None:
            eot_second_deg = (
                (eot_forward - prev_eot_forward) / STEP_DAYS / SOLAR_SECONDS_PER_DEGREE
            )
            sid_second_deg = (sid_forward - prev_sid_forward) / STEP_DAYS
            ra_second_deg = (ra_forward - prev_ra_forward) / STEP_DAYS
            update(
                "eotObservedSecondDifferenceDegPerDaySquared",
                eot_second_deg,
                interval_index,
            )
            update(
                "siderealResidualObservedSecondDifferenceDegPerDaySquared",
                sid_second_deg,
                interval_index,
            )
            update(
                "sunRaForwardObservedSecondDifferenceDegPerDaySquared",
                ra_second_deg,
                interval_index,
            )

        ra_engine_acceleration = (ra_speed - prev_ra_speed) / STEP_DAYS
        update(
            "sunRaEngineSpeedObservedAccelerationDegPerDaySquared",
            ra_engine_acceleration,
            interval_index,
        )

        prev_eot = eot
        prev_sid = sid
        prev_ra = ra
        prev_ra_speed = ra_speed
        prev_eot_forward = eot_forward
        prev_sid_forward = sid_forward
        prev_ra_forward = ra_forward

    observed_eot_second = float(
        worst["eotObservedSecondDifferenceDegPerDaySquared"]["abs"]
    )
    threshold_ratio = (
        observed_eot_second / CERTIFIED_SECOND_DERIVATIVE_THRESHOLD_DEG_PER_DAY2
    )

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "empirical sizing of a future certified Swiss EoT second-derivative bound",
        "targetYear": TARGET_YEAR,
        "cadenceSeconds": STEP_SECONDS,
        "intervals": interval_count,
        "samplesIncludingTerminalEndpoint": interval_count + 1,
        "swiephSamples": swieph_samples,
        "sunRaEngineSpeedDegPerDayObservedRange": {
            "min": min_ra_speed,
            "max": max_ra_speed,
        },
        "worstObserved": worst,
        "planning": {
            "requiredCertifiedSecondDerivativeBoundDegPerDaySquared":
                CERTIFIED_SECOND_DERIVATIVE_THRESHOLD_DEG_PER_DAY2,
            "observedSecondDifferenceToRequiredBoundRatio": threshold_ratio,
            "requiredBoundToObservedSecondDifferenceRatio": (
                CERTIFIED_SECOND_DERIVATIVE_THRESHOLD_DEG_PER_DAY2 / observed_eot_second
                if observed_eot_second > 0
                else None
            ),
        },
        "interpretation": {
            "empiricalOnly": True,
            "observedSecondDifferencesAreCertification": False,
            "swissPublicSpeedChangesAreCertification": False,
            "certifiedSwissEotSecondDerivativeBound": False,
            "certifiedSwissEotDerivativeBound": False,
            "continuousResidualUpperBound": False,
            "recurrenceAuthorityGranted": False,
            "reason": "Adjacent five-minute slopes and Swiss engine speed changes size the curvature scale only. They do not bound extrema between samples and therefore cannot replace a source/interval second-derivative certificate.",
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
