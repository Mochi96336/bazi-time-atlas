#!/usr/bin/env python3
"""Empirically decompose the Swiss year-4006 apparent-Sun RA correction chain.

This is reconnaissance only. Five-minute measurements prioritize later
source-derived proofs; they are never promoted into continuous hard bounds.
RA double differences are retained as a cancellation-sensitive diagnostic,
while correction acceleration ranking uses Swiss engine-speed differences.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import swisseph as swe

TARGET_YEAR = 4006
STEP_SECONDS = 300
STEP_DAYS = STEP_SECONDS / 86400.0
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "tmp/swiss-apparent-correction-recon-4006"))
EPHE_PATH = os.environ["SWISS_EPHE_PATH"]

BASE = swe.FLG_SWIEPH | swe.FLG_EQUATORIAL | swe.FLG_SPEED

LAYERS = [
    (
        "trueGeometricJ2000",
        BASE | swe.FLG_TRUEPOS | swe.FLG_J2000 | swe.FLG_NONUT | swe.FLG_NOABERR | swe.FLG_NOGDEFL,
        "post-SWIEPH geometric J2000, true position; no light-time/aberration/deflection/precession/nutation",
    ),
    (
        "lightTimeJ2000",
        BASE | swe.FLG_J2000 | swe.FLG_NONUT | swe.FLG_NOABERR | swe.FLG_NOGDEFL,
        "add geocentric light-time iteration",
    ),
    (
        "aberratedJ2000",
        BASE | swe.FLG_J2000 | swe.FLG_NONUT | swe.FLG_NOGDEFL,
        "add annual aberration",
    ),
    (
        "deflectedJ2000",
        BASE | swe.FLG_J2000 | swe.FLG_NONUT,
        "allow Swiss default relativistic light-deflection path",
    ),
    (
        "meanOfDate",
        BASE | swe.FLG_NONUT,
        "add precession from J2000 to mean equator/equinox of date",
    ),
    (
        "apparentOfDate",
        BASE,
        "add nutation / true equator-equinox of date",
    ),
]


def wrap_signed_degrees(value: float) -> float:
    return (value + 180.0) % 360.0 - 180.0


def jd(year: int, month: int, day: int) -> float:
    return swe.julday(year, month, day, 0.0, swe.GREG_CAL)


def sun_ra(jd_ut: float, flags: int) -> tuple[float, float, int]:
    values, retflag = swe.calc_ut(jd_ut, swe.SUN, flags)
    if not (retflag & swe.FLG_SWIEPH):
        raise RuntimeError(f"Sun did not use SWIEPH at JD {jd_ut}: retflag={retflag}")
    return float(values[0]), float(values[3]), int(retflag)


def blank_worst() -> dict[str, float | int | str]:
    return {"abs": -1.0, "signed": 0.0, "index": -1, "time": ""}


def update(worst: dict[str, float | int | str], value: float, index: int) -> None:
    magnitude = abs(value)
    if magnitude <= float(worst["abs"]):
        return
    timestamp = datetime(TARGET_YEAR, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=index * STEP_SECONDS)
    worst.update(abs=magnitude, signed=value, index=index, time=timestamp.isoformat())


def main() -> None:
    swe.set_ephe_path(EPHE_PATH)
    start = jd(TARGET_YEAR, 1, 1)
    end = jd(TARGET_YEAR + 1, 1, 1)
    intervals = round((end - start) / STEP_DAYS)
    if intervals != 105120:
        raise RuntimeError(f"unexpected interval count {intervals}")

    state: dict[str, dict[str, object]] = {}
    initial_ras: list[float] = []
    initial_speeds: list[float] = []
    for name, flags, description in LAYERS:
        ra, speed, retflag = sun_ra(start, flags)
        initial_ras.append(ra)
        initial_speeds.append(speed)
        state[name] = {
            "flags": flags,
            "description": description,
            "firstRetflag": retflag,
            "prevRa": ra,
            "prevForward": None,
            "speedMin": speed,
            "speedMax": speed,
            "maxAbsTotalForwardSlopeDegPerDay": blank_worst(),
            "maxAbsTotalSecondDifferenceDegPerDaySquared": blank_worst(),
        }

    correction_state: dict[str, dict[str, object]] = {}
    for i in range(1, len(LAYERS)):
        name = f"{LAYERS[i-1][0]}To{LAYERS[i][0]}"
        corr = wrap_signed_degrees(initial_ras[i] - initial_ras[i - 1])
        engine_speed_corr = initial_speeds[i] - initial_speeds[i - 1]
        correction_state[name] = {
            "from": LAYERS[i - 1][0],
            "to": LAYERS[i][0],
            "prevCorrectionDeg": corr,
            "prevForward": None,
            "prevEngineSpeedCorrection": engine_speed_corr,
            "maxAbsCorrectionArcsec": blank_worst(),
            "maxAbsCorrectionForwardSlopeDegPerDay": blank_worst(),
            "maxAbsCorrectionSecondDifferenceDegPerDaySquared": blank_worst(),
            "maxAbsEngineSpeedCorrectionDegPerDay": blank_worst(),
            "maxAbsEngineSpeedCorrectionAccelerationDegPerDaySquared": blank_worst(),
        }
        update(correction_state[name]["maxAbsCorrectionArcsec"], corr * 3600.0, 0)
        update(correction_state[name]["maxAbsEngineSpeedCorrectionDegPerDay"], engine_speed_corr, 0)

    for interval_index in range(intervals):
        current_ras: list[float] = []
        current_speeds: list[float] = []
        for name, flags, _ in LAYERS:
            ra, speed, _ = sun_ra(start + (interval_index + 1) * STEP_DAYS, flags)
            st = state[name]
            forward = wrap_signed_degrees(ra - float(st["prevRa"])) / STEP_DAYS
            update(st["maxAbsTotalForwardSlopeDegPerDay"], forward, interval_index)
            if st["prevForward"] is not None:
                second = (forward - float(st["prevForward"])) / STEP_DAYS
                update(st["maxAbsTotalSecondDifferenceDegPerDaySquared"], second, interval_index)
            st["prevRa"] = ra
            st["prevForward"] = forward
            st["speedMin"] = min(float(st["speedMin"]), speed)
            st["speedMax"] = max(float(st["speedMax"]), speed)
            current_ras.append(ra)
            current_speeds.append(speed)

        for i in range(1, len(LAYERS)):
            cname = f"{LAYERS[i-1][0]}To{LAYERS[i][0]}"
            cs = correction_state[cname]
            corr = wrap_signed_degrees(current_ras[i] - current_ras[i - 1])
            update(cs["maxAbsCorrectionArcsec"], corr * 3600.0, interval_index + 1)

            corr_forward = wrap_signed_degrees(corr - float(cs["prevCorrectionDeg"])) / STEP_DAYS
            update(cs["maxAbsCorrectionForwardSlopeDegPerDay"], corr_forward, interval_index)
            if cs["prevForward"] is not None:
                corr_second = (corr_forward - float(cs["prevForward"])) / STEP_DAYS
                update(cs["maxAbsCorrectionSecondDifferenceDegPerDaySquared"], corr_second, interval_index)
            cs["prevCorrectionDeg"] = corr
            cs["prevForward"] = corr_forward

            engine_speed_corr = current_speeds[i] - current_speeds[i - 1]
            update(cs["maxAbsEngineSpeedCorrectionDegPerDay"], engine_speed_corr, interval_index + 1)
            engine_acc = (engine_speed_corr - float(cs["prevEngineSpeedCorrection"])) / STEP_DAYS
            update(
                cs["maxAbsEngineSpeedCorrectionAccelerationDegPerDaySquared"],
                engine_acc,
                interval_index,
            )
            cs["prevEngineSpeedCorrection"] = engine_speed_corr

    layers_out = {}
    for name, flags, description in LAYERS:
        st = state[name]
        layers_out[name] = {
            "flags": int(flags),
            "description": description,
            "firstRetflag": int(st["firstRetflag"]),
            "engineRaSpeedObservedRangeDegPerDay": {
                "min": st["speedMin"],
                "max": st["speedMax"],
            },
            "worstObserved": {
                "totalForwardSlopeDegPerDay": st["maxAbsTotalForwardSlopeDegPerDay"],
                "totalSecondDifferenceDegPerDaySquared": st["maxAbsTotalSecondDifferenceDegPerDaySquared"],
            },
        }

    corrections_out = {}
    for name, cs in correction_state.items():
        corrections_out[name] = {
            "from": cs["from"],
            "to": cs["to"],
            "worstObserved": {
                "correctionArcsec": cs["maxAbsCorrectionArcsec"],
                "correctionForwardSlopeDegPerDay": cs["maxAbsCorrectionForwardSlopeDegPerDay"],
                "correctionSecondDifferenceDegPerDaySquared": cs["maxAbsCorrectionSecondDifferenceDegPerDaySquared"],
                "engineSpeedCorrectionDegPerDay": cs["maxAbsEngineSpeedCorrectionDegPerDay"],
                "engineSpeedCorrectionAccelerationDegPerDaySquared": cs[
                    "maxAbsEngineSpeedCorrectionAccelerationDegPerDaySquared"
                ],
            },
        }

    ranked_engine = sorted(
        (
            {
                "correction": name,
                "observedMaxAbsEngineSpeedCorrectionAccelerationDegPerDaySquared": float(
                    item["worstObserved"]["engineSpeedCorrectionAccelerationDegPerDaySquared"]["abs"]
                ),
            }
            for name, item in corrections_out.items()
        ),
        key=lambda x: x["observedMaxAbsEngineSpeedCorrectionAccelerationDegPerDaySquared"],
        reverse=True,
    )
    ranked_ra = sorted(
        (
            {
                "correction": name,
                "observedMaxAbsRaSecondDifferenceDegPerDaySquared": float(
                    item["worstObserved"]["correctionSecondDifferenceDegPerDaySquared"]["abs"]
                ),
            }
            for name, item in corrections_out.items()
        ),
        key=lambda x: x["observedMaxAbsRaSecondDifferenceDegPerDaySquared"],
        reverse=True,
    )

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "empirical decomposition of Swiss apparent-Sun RA correction curvature before source-derived certification",
        "targetYear": TARGET_YEAR,
        "cadenceSeconds": STEP_SECONDS,
        "intervals": intervals,
        "samplesIncludingTerminalEndpoint": intervals + 1,
        "layers": layers_out,
        "incrementalCorrections": corrections_out,
        "rankedByObservedEngineSpeedCorrectionAcceleration": ranked_engine,
        "rankedByObservedRaSecondDifference": ranked_ra,
        "interpretation": {
            "empiricalOnly": True,
            "flagDecompositionIsProofPrioritizationOnly": True,
            "sampledCorrectionCurvatureIsContinuousBound": False,
            "raSecondDifferenceCancellationSensitive": True,
            "engineSpeedDifferencePreferredForReconnaissance": True,
            "lightTimeCorrectionCertified": False,
            "aberrationCorrectionCertified": False,
            "deflectionCorrectionCertified": False,
            "precessionCorrectionCertified": False,
            "nutationCorrectionCertified": False,
            "apparentPositionCorrectionChainCertified": False,
            "swissEotSecondDerivativeCertified": False,
            "continuousResidualUpperBound": False,
            "recurrenceAuthorityGranted": False,
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
