#!/usr/bin/env python3
"""Focused IAS15 + GR solar-mass-loss A/B against DE441.

The DE440/441 integration constants include GMSDOT=-9e-14, consistent with the
well-known present-day fractional solar mass-loss scale of ~-9e-14/yr.  This
experiment keeps the J2000 DE441 state and the compact 11-body model unchanged,
and changes only the Sun's mass secularly.

The time-varying mass is implemented as midpoint-constant segments.  Two segment
sizes are run to expose discretization error.  No asteroid/KBO/J2/LT terms are
mixed into this diagnostic.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

from jplephem.spk import SPK

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "scripts" / "research-rebound-de441-state-baseline.py"

JULIAN_YEAR_DAYS = 365.25
SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR = -9.0e-14

CHECKPOINTS = (
    (2, 4.5, "li-chun-window"),
    (3, 20.5, "march-equinox-window"),
    (9, 22.5, "september-equinox-window"),
)


def load_baseline_module():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load REBOUND baseline module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def set_solar_mass_for_midpoint(sim, initial_mass: float, midpoint_days: float):
    years = midpoint_days / JULIAN_YEAR_DAYS
    factor = 1.0 + SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR * years
    sim.particles[0].m = initial_mass * factor


def integrate_with_mass_loss(sim, target_days: float, segment_days: float, initial_mass: float):
    if target_days < sim.t:
        raise ValueError("mass-loss experiment only supports forward integration")
    while sim.t < target_days:
        end = min(target_days, sim.t + segment_days)
        midpoint = 0.5 * (sim.t + end)
        set_solar_mass_for_midpoint(sim, initial_mass, midpoint)
        sim.integrate(end, exact_finish_time=1)
    # Leave the mass synchronized to the physical endpoint for inspection.
    years = target_days / JULIAN_YEAR_DAYS
    sim.particles[0].m = initial_mass * (
        1.0 + SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR * years
    )


def compare_year(baseline, kernel, segment_years: float, year: int):
    base, base_rebx = baseline.make_simulation(
        kernel, 0.5, physics="gr", integrator="ias15"
    )
    variant, variant_rebx = baseline.make_simulation(
        kernel, 0.5, physics="gr", integrator="ias15"
    )
    _ = base_rebx, variant_rebx
    initial_sun_mass = float(variant.particles[0].m)
    segment_days = segment_years * JULIAN_YEAR_DAYS

    rows = []
    for month, day, label in CHECKPOINTS:
        jd = baseline.gregorian_julian_day(year, month, day)
        t = jd - baseline.J2000_TDB_JD

        base.integrate(t, exact_finish_time=1)
        integrate_with_mass_loss(variant, t, segment_days, initial_sun_mass)

        base_metric = baseline.compare_at(kernel, base, jd)
        # compare_at would integrate again; at the same t this is harmless and
        # keeps all metric definitions identical to the established baseline.
        variant_metric = baseline.compare_at(kernel, variant, jd)

        before = base_metric["geocentricSunDirectionErrorArcsec"]
        after = variant_metric["geocentricSunDirectionErrorArcsec"]
        rows.append({
            "year": year,
            "label": label,
            "segmentYears": segment_years,
            "baselineDirectionErrorArcsec": before,
            "massLossDirectionErrorArcsec": after,
            "directionImprovementArcsec": before - after,
            "directionImprovementFraction": ((before - after) / before if before else 0.0),
            "baselineGeocentricPositionErrorKm": base_metric["geocentricSunPositionErrorKm"],
            "massLossGeocentricPositionErrorKm": variant_metric["geocentricSunPositionErrorKm"],
            "positionImprovementKm": (
                base_metric["geocentricSunPositionErrorKm"]
                - variant_metric["geocentricSunPositionErrorKm"]
            ),
            "sunMassFactorAtCheckpoint": (
                float(variant.particles[0].m) / initial_sun_mass
            ),
        })
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--segment-years", type=float, default=1.0)
    parser.add_argument("--years", nargs="+", type=int, default=[4006, 10026])
    args = parser.parse_args()

    if args.segment_years <= 0:
        raise ValueError("segment-years must be positive")

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")

    kernel = SPK.open(str(args.kernel))
    try:
        rows = []
        for year in args.years:
            result = compare_year(
                baseline, kernel, args.segment_years, year
            )
            rows.extend(result)
            print(
                f"[solar-mass-loss-checkpoint] year={year} segment={args.segment_years}yr",
                flush=True,
            )
            for row in result:
                print(
                    f"[solar-mass-loss] {year} {row['label']}: "
                    f"{row['baselineDirectionErrorArcsec']:.6f} -> "
                    f"{row['massLossDirectionErrorArcsec']:.6f} arcsec; "
                    f"improvement={row['directionImprovementArcsec']:.6f} "
                    f"({row['directionImprovementFraction']*100:.3f}%); "
                    f"geo-pos-improvement={row['positionImprovementKm']:.3f} km; "
                    f"M/M0={row['sunMassFactorAtCheckpoint']:.12f}",
                    flush=True,
                )
    finally:
        kernel.close()

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "sourceEphemeris": "DE441",
        "experiment": "IAS15 + gr + secular solar mass loss",
        "fractionalSolarMassLossPerYear": SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR,
        "segmentYears": args.segment_years,
        "rows": rows,
        "claimBoundary": {
            "isolatesSolarMassLoss": True,
            "usesPiecewiseMidpointMass": True,
            "includesSolarJ2": False,
            "includesAsteroids": False,
            "includesKboPerturbations": False,
            "year26026Resolved": False,
            "productionAuthorityGranted": False,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
