#!/usr/bin/env python3
"""Focused IAS15 + GR versus IAS15 + GR + solar Lense-Thirring A/B.

Research-only diagnostic for the remaining long-range Earth-Sun phase residual.
The only physical difference between the two runs is the solar gravitomagnetic
(Lense-Thirring) term.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path

import rebound
from jplephem.spk import SPK

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "scripts" / "research-rebound-de441-state-baseline.py"

SOLAR_MOI_FACTOR = 0.06884
SOLAR_RADIUS_KM = 696_000.0
SOLAR_ROTATION_DEG_PER_DAY = 14.1844
SOLAR_SPIN_RA_DEG = 286.13
SOLAR_SPIN_DEC_DEG = 63.87


def load_baseline_module():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load REBOUND baseline module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def by_key(samples):
    return {(item["year"], item["label"]): item for item in samples}


def make_lt_simulation(baseline, kernel):
    sim, rebx = baseline.make_simulation(
        kernel,
        0.5,
        physics="gr",
        integrator="ias15",
    )

    lt = rebx.load_force("lense_thirring")
    rebx.add_force(lt)
    lt.params["lt_c"] = baseline.C_AU_PER_DAY

    sun = sim.particles[0]
    radius_au = SOLAR_RADIUS_KM / baseline.AU_KM
    sun.params["I"] = SOLAR_MOI_FACTOR * sun.m * radius_au * radius_au

    omega = math.radians(SOLAR_ROTATION_DEG_PER_DAY)
    ra = math.radians(SOLAR_SPIN_RA_DEG)
    dec = math.radians(SOLAR_SPIN_DEC_DEG)
    sun.params["Omega"] = rebound.spherical_to_xyz(
        magnitude=omega,
        theta=math.pi / 2.0 - dec,
        phi=ra,
    )
    return sim, rebx


def integrate_lt(baseline, kernel, years):
    sim, rebx = make_lt_simulation(baseline, kernel)
    _ = rebx
    samples = []
    for year in years:
        for month, day, label in (
            (2, 4.5, "li-chun-window"),
            (3, 20.5, "march-equinox-window"),
            (9, 22.5, "september-equinox-window"),
        ):
            jd = baseline.gregorian_julian_day(year, month, day)
            sample = baseline.compare_at(kernel, sim, jd)
            sample.update({"year": year, "label": label})
            samples.append(sample)
    return samples


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    baseline = load_baseline_module()
    observed_md5 = baseline.file_md5(args.kernel)
    if observed_md5 != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError(
            f"DE441 kernel MD5 mismatch: expected {baseline.EXPECTED_KERNEL_MD5}, got {observed_md5}"
        )

    kernel = SPK.open(str(args.kernel))
    try:
        years = (4006, 10026)
        base = baseline.integrate_validation(
            kernel,
            0.5,
            years,
            physics="gr",
            integrator="ias15",
        )
        lt = integrate_lt(baseline, kernel, years)
    finally:
        kernel.close()

    base_by_key = by_key(base)
    comparison = []
    for item in lt:
        before = base_by_key[(item["year"], item["label"])]
        before_dir = before["geocentricSunDirectionErrorArcsec"]
        after_dir = item["geocentricSunDirectionErrorArcsec"]
        before_pos = before["geocentricSunPositionErrorKm"]
        after_pos = item["geocentricSunPositionErrorKm"]
        comparison.append({
            "year": item["year"],
            "label": item["label"],
            "baselineDirectionErrorArcsec": before_dir,
            "ltDirectionErrorArcsec": after_dir,
            "directionDeltaArcsec": after_dir - before_dir,
            "directionImprovementArcsec": before_dir - after_dir,
            "directionImprovementFraction": (
                (before_dir - after_dir) / before_dir if before_dir else 0.0
            ),
            "baselineGeocentricPositionErrorKm": before_pos,
            "ltGeocentricPositionErrorKm": after_pos,
            "positionDeltaKm": after_pos - before_pos,
            "positionImprovementKm": before_pos - after_pos,
        })

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "sourceEphemeris": "DE441",
        "experiment": "IAS15 + REBOUNDx gr + solar Lense-Thirring",
        "baselinePhysics": "IAS15 + gr",
        "variantPhysics": "IAS15 + gr + lense_thirring",
        "solarMomentOfInertiaFactor": SOLAR_MOI_FACTOR,
        "solarRadiusKm": SOLAR_RADIUS_KM,
        "solarRotationDegreesPerDay": SOLAR_ROTATION_DEG_PER_DAY,
        "solarSpinPoleIcrf": {
            "raDegrees": SOLAR_SPIN_RA_DEG,
            "decDegrees": SOLAR_SPIN_DEC_DEG,
        },
        "baseline": base,
        "lenseThirring": lt,
        "comparison": comparison,
        "summary": {
            "baselineMaxDirectionErrorArcsec": max(
                item["geocentricSunDirectionErrorArcsec"] for item in base
            ),
            "ltMaxDirectionErrorArcsec": max(
                item["geocentricSunDirectionErrorArcsec"] for item in lt
            ),
            "baselineMaxGeocentricPositionErrorKm": max(
                item["geocentricSunPositionErrorKm"] for item in base
            ),
            "ltMaxGeocentricPositionErrorKm": max(
                item["geocentricSunPositionErrorKm"] for item in lt
            ),
        },
        "claimBoundary": {
            "isolatesSolarLenseThirring": True,
            "includesSolarJ2": False,
            "includesAsteroids": False,
            "includesKboPerturbations": False,
            "year26026Resolved": False,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(json.dumps(result["summary"], indent=2))
    for row in comparison:
        print(
            f"[solar-lt] {row['year']} {row['label']}: "
            f"{row['baselineDirectionErrorArcsec']:.6f} -> {row['ltDirectionErrorArcsec']:.6f} arcsec; "
            f"improvement={row['directionImprovementArcsec']:.6f} arcsec "
            f"({row['directionImprovementFraction']*100:.3f}%); "
            f"geo-pos-improvement={row['positionImprovementKm']:.3f} km"
        )


if __name__ == "__main__":
    main()
