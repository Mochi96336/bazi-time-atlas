#!/usr/bin/env python3
"""Research-only IAS15 + GR + solar-mass-loss state projection to year 26026.

This extends the calibrated absolute orbital-state lane beyond DE441 coverage
without pretending that an orbital state is already a seasonal-event epoch.

The script has two jobs:

1. re-run the established year-10026 solar-mass-loss checkpoints and require the
   #565/#568 direction-error regression to remain unchanged;
2. propagate the same model to year 26026 and emit dense Earth/Sun ICRF/TDB
   state windows around Li Chun, March equinox and September equinox.

A 1-year mass-loss segmentation is run in parallel only as a numerical
convergence check against the established 10-year midpoint segmentation.
No asteroid343 differential, long-term frame transform, apparent-direction
correction, or seasonal root solve is applied here.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from jplephem.spk import SPK

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "scripts" / "research-rebound-de441-state-baseline.py"

JULIAN_YEAR_DAYS = 365.25
SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR = -9.0e-14
PRIMARY_SEGMENT_YEARS = 10.0
CONVERGENCE_SEGMENT_YEARS = 1.0

CALIBRATION_YEAR = 10026
TARGET_YEAR = 26026

CHECKPOINTS = (
    (2, 4.5, "li-chun-window"),
    (3, 20.5, "march-equinox-window"),
    (9, 22.5, "september-equinox-window"),
)

MASS_LOSS_10Y_REFERENCE_ARCSEC = {
    "li-chun-window": 0.9003296313530997,
    "march-equinox-window": 1.024500200585229,
    "september-equinox-window": 0.969461565570375,
}

MAX_CALIBRATION_REGRESSION_ARCSEC = 0.002
MAX_DEEP_SEGMENT_CONVERGENCE_ARCSEC = 0.05

WINDOW_HALF_WIDTH_DAYS = 16.0
WINDOW_STEP_DAYS = 0.5


def load_baseline_module():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load REBOUND baseline module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def set_solar_mass(sim, initial_mass: float, elapsed_days: float):
    years = elapsed_days / JULIAN_YEAR_DAYS
    sim.particles[0].m = initial_mass * (
        1.0 + SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR * years
    )


def integrate_mass_loss(
    sim,
    target_days: float,
    initial_mass: float,
    segment_years: float,
):
    if target_days < sim.t:
        raise ValueError("forward integration only")
    segment_days = segment_years * JULIAN_YEAR_DAYS
    while sim.t < target_days:
        end = min(target_days, sim.t + segment_days)
        midpoint = 0.5 * (sim.t + end)
        set_solar_mass(sim, initial_mass, midpoint)
        sim.integrate(end, exact_finish_time=1)
    set_solar_mass(sim, initial_mass, target_days)


def snapshot_dict(baseline, sim, tdb_julian_day: float):
    ep, ev, sp, sv = baseline.snapshot(sim)
    geo = sp - ep
    geo_v = sv - ev
    return {
        "tdbJulianDay": float(tdb_julian_day),
        "earth": {
            "positionAu": [float(x) for x in ep],
            "velocityAuPerDay": [float(x) for x in ev],
        },
        "sun": {
            "positionAu": [float(x) for x in sp],
            "velocityAuPerDay": [float(x) for x in sv],
        },
        "geocentricSun": {
            "positionAu": [float(x) for x in geo],
            "velocityAuPerDay": [float(x) for x in geo_v],
            "rangeAu": float(np.linalg.norm(geo)),
        },
        "sunMassFactor": float(sim.particles[0].m),
    }


def truth_geo_state(baseline, kernel, jd):
    ep, _ = baseline.state_from_route(kernel, jd, ((0, 3), (3, 399)))
    sp, _ = baseline.state_from_route(kernel, jd, ((0, 10),))
    return sp - ep


def model_geo_state(baseline, sim):
    ep, _, sp, _ = baseline.snapshot(sim)
    return sp - ep


def integrate_to_jd(
    baseline,
    sim,
    initial_mass: float,
    segment_years: float,
    jd: float,
):
    target_days = jd - baseline.J2000_TDB_JD
    integrate_mass_loss(sim, target_days, initial_mass, segment_years)
    return target_days


def calibration_rows(baseline, kernel, primary_sim, primary_initial_mass):
    rows = []
    for month, day, label in CHECKPOINTS:
        jd = baseline.gregorian_julian_day(CALIBRATION_YEAR, month, day)
        integrate_to_jd(
            baseline,
            primary_sim,
            primary_initial_mass,
            PRIMARY_SEGMENT_YEARS,
            jd,
        )
        model_geo = model_geo_state(baseline, primary_sim)
        truth_geo = truth_geo_state(baseline, kernel, jd)
        direction_error = baseline.vector_angle_arcsec(model_geo, truth_geo)
        expected = MASS_LOSS_10Y_REFERENCE_ARCSEC[label]
        rows.append({
            "year": CALIBRATION_YEAR,
            "label": label,
            "tdbJulianDay": jd,
            "directionErrorArcsec": direction_error,
            "referenceDirectionErrorArcsec": expected,
            "regressionArcsec": direction_error - expected,
        })
        print(
            f"[26026-state-calibration] {label}: "
            f"observed={direction_error:.9f} arcsec "
            f"reference={expected:.9f} "
            f"delta={direction_error - expected:+.9f}",
            flush=True,
        )
    return rows


def deep_checkpoint_rows(
    baseline,
    primary_sim,
    primary_initial_mass,
    convergence_sim,
    convergence_initial_mass,
):
    rows = []
    for month, day, label in CHECKPOINTS:
        jd = baseline.gregorian_julian_day(TARGET_YEAR, month, day)
        integrate_to_jd(
            baseline,
            primary_sim,
            primary_initial_mass,
            PRIMARY_SEGMENT_YEARS,
            jd,
        )
        integrate_to_jd(
            baseline,
            convergence_sim,
            convergence_initial_mass,
            CONVERGENCE_SEGMENT_YEARS,
            jd,
        )
        primary_geo = model_geo_state(baseline, primary_sim)
        convergence_geo = model_geo_state(baseline, convergence_sim)
        angular_separation = baseline.vector_angle_arcsec(
            primary_geo, convergence_geo
        )
        position_separation_km = float(
            np.linalg.norm(primary_geo - convergence_geo) * baseline.AU_KM
        )
        row = {
            "year": TARGET_YEAR,
            "label": label,
            "tdbJulianDay": jd,
            "primarySegmentYears": PRIMARY_SEGMENT_YEARS,
            "convergenceSegmentYears": CONVERGENCE_SEGMENT_YEARS,
            "primary": snapshot_dict(baseline, primary_sim, jd),
            "convergence": snapshot_dict(baseline, convergence_sim, jd),
            "primaryMinusConvergenceDirectionArcsec": angular_separation,
            "primaryMinusConvergencePositionKm": position_separation_km,
        }
        rows.append(row)
        print(
            f"[26026-state-checkpoint] {label}: "
            f"10y-vs-1y={angular_separation:.9f} arcsec; "
            f"geo-pos={position_separation_km:.6f} km",
            flush=True,
        )
    return rows


def deep_windows(baseline, kernel, segment_years: float):
    # Start a fresh simulation so the window samples are independent of the
    # convergence-check call sequence above.  This also makes the emitted state
    # windows reusable by a later seasonal-frame/root-solve experiment.
    sim, rebx = baseline.make_simulation(
        kernel, 0.5, physics="gr", integrator="ias15"
    )
    _ = rebx
    initial_mass = float(sim.particles[0].m)

    samples = []
    for month, day, label in CHECKPOINTS:
        center_jd = baseline.gregorian_julian_day(TARGET_YEAR, month, day)
        start_jd = center_jd - WINDOW_HALF_WIDTH_DAYS
        sample_count = int(round((2 * WINDOW_HALF_WIDTH_DAYS) / WINDOW_STEP_DAYS)) + 1
        rows = []
        for index in range(sample_count):
            jd = start_jd + index * WINDOW_STEP_DAYS
            integrate_to_jd(
                baseline,
                sim,
                initial_mass,
                segment_years,
                jd,
            )
            rows.append(snapshot_dict(baseline, sim, jd))
        samples.append({
            "label": label,
            "catalogueYear": TARGET_YEAR,
            "centerTdbJulianDay": center_jd,
            "startTdbJulianDay": start_jd,
            "stepDays": WINDOW_STEP_DAYS,
            "sampleCount": len(rows),
            "samples": rows,
        })
        print(
            f"[26026-state-window] {label}: "
            f"{len(rows)} samples from {rows[0]['tdbJulianDay']:.6f} "
            f"to {rows[-1]['tdbJulianDay']:.6f}",
            flush=True,
        )
    return samples


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")

    kernel = SPK.open(str(args.kernel))
    try:
        primary_sim, primary_rebx = baseline.make_simulation(
            kernel, 0.5, physics="gr", integrator="ias15"
        )
        convergence_sim, convergence_rebx = baseline.make_simulation(
            kernel, 0.5, physics="gr", integrator="ias15"
        )
        _ = primary_rebx, convergence_rebx
        primary_initial_mass = float(primary_sim.particles[0].m)
        convergence_initial_mass = float(convergence_sim.particles[0].m)

        calibration = calibration_rows(
            baseline,
            kernel,
            primary_sim,
            primary_initial_mass,
        )
        deep = deep_checkpoint_rows(
            baseline,
            primary_sim,
            primary_initial_mass,
            convergence_sim,
            convergence_initial_mass,
        )
        windows = deep_windows(baseline, kernel, PRIMARY_SEGMENT_YEARS)
    finally:
        kernel.close()

    max_calibration_regression = max(
        abs(row["regressionArcsec"]) for row in calibration
    )
    max_deep_segment_convergence = max(
        abs(row["primaryMinusConvergenceDirectionArcsec"]) for row in deep
    )

    accepted = (
        max_calibration_regression <= MAX_CALIBRATION_REGRESSION_ARCSEC
        and max_deep_segment_convergence <= MAX_DEEP_SEGMENT_CONVERGENCE_ARCSEC
    )

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "sourceEphemeris": "DE441",
        "initialEpochTdbJulianDay": baseline.J2000_TDB_JD,
        "model": {
            "integrator": "IAS15",
            "physics": "REBOUNDx gr",
            "fractionalSolarMassLossPerYear": SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR,
            "primaryMassLossSegmentYears": PRIMARY_SEGMENT_YEARS,
            "convergenceMassLossSegmentYears": CONVERGENCE_SEGMENT_YEARS,
            "bodies": [name for name, _ in baseline.BODIES],
            "asteroid343Included": False,
        },
        "calibration": {
            "year": CALIBRATION_YEAR,
            "rows": calibration,
            "maxRegressionArcsec": max_calibration_regression,
            "accepted": max_calibration_regression
            <= MAX_CALIBRATION_REGRESSION_ARCSEC,
        },
        "target": {
            "year": TARGET_YEAR,
            "checkpoints": deep,
            "stateWindows": windows,
            "maxTenYearVsOneYearDirectionArcsec": max_deep_segment_convergence,
        },
        "summary": {
            "acceptedAsOrbitalStateProjection": accepted,
            "maxCalibrationRegressionArcsec": max_calibration_regression,
            "maxTenYearVsOneYearDirectionArcsec": max_deep_segment_convergence,
        },
        "claimBoundary": {
            "year10026MassLossRegressionReproduced": (
                max_calibration_regression <= MAX_CALIBRATION_REGRESSION_ARCSEC
            ),
            "year26026AbsoluteOrbitalStateProjected": True,
            "year26026Asteroid343Included": False,
            "year26026LongTermFrameApplied": False,
            "year26026ApparentDirectionResolved": False,
            "year26026SeasonalCrossingResolved": False,
            "year26026CivilTimeResolved": False,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(
        f"[26026-state-summary] accepted={accepted}; "
        f"max-calibration-regression={max_calibration_regression:.9f} arcsec; "
        f"max-10y-vs-1y={max_deep_segment_convergence:.9f} arcsec",
        flush=True,
    )

    if not accepted:
        raise RuntimeError("year-26026 orbital-state projection failed evidence gates")


if __name__ == "__main__":
    main()
