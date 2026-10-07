#!/usr/bin/env python3
"""Diagnose Earth-center versus Earth-Moon-barycenter deep-time error.

Run one IAS15 + REBOUNDx GR integration from the same DE441 J2000 initial state
and compare, at the existing 4006 / 10026 checkpoints:

1. geocentric Sun direction from the modeled Earth center;
2. Sun direction from the modeled Earth-Moon barycenter (EMB);
3. modeled Earth-within-EMB offset versus DE441.

If EMB stays accurate while Earth-center diverges, the remaining geocentric
solar-direction residual is being driven mainly by incomplete lunar/Earth-Moon
dynamics rather than the planetary common phase.
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


def load_baseline_module():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load REBOUND baseline module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def state_vector(particle):
    position = np.array([particle.x, particle.y, particle.z], dtype=np.float64)
    velocity = np.array([particle.vx, particle.vy, particle.vz], dtype=np.float64)
    return position, velocity


def compare_checkpoint(baseline, kernel, sim, jd):
    sim.integrate(jd - baseline.J2000_TDB_JD, exact_finish_time=1)

    sun_p, sun_v = state_vector(sim.particles[0])
    earth_p, earth_v = state_vector(sim.particles[3])
    moon_p, moon_v = state_vector(sim.particles[4])

    earth_gm = baseline.GM["earth"]
    moon_gm = baseline.GM["moon"]
    pair_gm = earth_gm + moon_gm
    emb_p = (earth_p * earth_gm + moon_p * moon_gm) / pair_gm
    emb_v = (earth_v * earth_gm + moon_v * moon_gm) / pair_gm

    true_emb_p, true_emb_v = baseline.state_from_route(kernel, jd, ((0, 3),))
    true_earth_p, true_earth_v = baseline.state_from_route(
        kernel, jd, ((0, 3), (3, 399))
    )
    true_sun_p, true_sun_v = baseline.state_from_route(kernel, jd, ((0, 10),))

    model_earth_sun = sun_p - earth_p
    true_earth_sun = true_sun_p - true_earth_p
    model_emb_sun = sun_p - emb_p
    true_emb_sun = true_sun_p - true_emb_p

    model_earth_from_emb = earth_p - emb_p
    true_earth_from_emb = true_earth_p - true_emb_p

    return {
        "tdbJulianDay":jd,
        "earthCenterSunDirectionErrorArcsec":baseline.vector_angle_arcsec(
            model_earth_sun, true_earth_sun
        ),
        "embSunDirectionErrorArcsec":baseline.vector_angle_arcsec(
            model_emb_sun, true_emb_sun
        ),
        "earthCenterSunPositionErrorKm":float(
            np.linalg.norm(model_earth_sun - true_earth_sun) * baseline.AU_KM
        ),
        "embSunPositionErrorKm":float(
            np.linalg.norm(model_emb_sun - true_emb_sun) * baseline.AU_KM
        ),
        "earthWithinEmbPositionErrorKm":float(
            np.linalg.norm(model_earth_from_emb - true_earth_from_emb) * baseline.AU_KM
        ),
        "earthWithinEmbVelocityErrorMps":float(
            np.linalg.norm(
                (earth_v - emb_v) - (true_earth_v - true_emb_v)
            ) * baseline.AU_KM * 1000 / baseline.SECONDS_PER_DAY
        ),
    }


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
        sim, rebx = baseline.make_simulation(
            kernel,
            0.5,
            physics="gr",
            integrator="ias15",
        )
        _ = rebx
        rows = []
        for year in (4006, 10026):
            for month, day, label in (
                (2, 4.5, "li-chun-window"),
                (3, 20.5, "march-equinox-window"),
                (9, 22.5, "september-equinox-window"),
            ):
                jd = baseline.gregorian_julian_day(year, month, day)
                row = compare_checkpoint(baseline, kernel, sim, jd)
                row.update({"year":year, "label":label})
                rows.append(row)
    finally:
        kernel.close()

    for row in rows:
        earth_error = row["earthCenterSunDirectionErrorArcsec"]
        emb_error = row["embSunDirectionErrorArcsec"]
        row["embDirectionImprovementArcsec"] = earth_error - emb_error
        row["embDirectionImprovementFraction"] = (
            (earth_error - emb_error) / earth_error if earth_error else 0.0
        )
        row["earthMinusEmbPositionResidualKm"] = (
            row["earthCenterSunPositionErrorKm"] - row["embSunPositionErrorKm"]
        )

    result = {
        "schemaVersion":1,
        "researchOnly":True,
        "sourceEphemeris":"DE441",
        "model":"IAS15 + REBOUNDx gr, Sun/major-planets + separate Earth/Moon",
        "rows":rows,
        "summary":{
            "maxEarthCenterDirectionErrorArcsec":max(
                row["earthCenterSunDirectionErrorArcsec"] for row in rows
            ),
            "maxEmbDirectionErrorArcsec":max(
                row["embSunDirectionErrorArcsec"] for row in rows
            ),
            "maxEarthCenterSunPositionErrorKm":max(
                row["earthCenterSunPositionErrorKm"] for row in rows
            ),
            "maxEmbSunPositionErrorKm":max(
                row["embSunPositionErrorKm"] for row in rows
            ),
            "maxEarthWithinEmbPositionErrorKm":max(
                row["earthWithinEmbPositionErrorKm"] for row in rows
            ),
        },
        "claimBoundary":{
            "diagnosesLunarInternalContribution":True,
            "modelsFullDe441LunarDynamics":False,
            "year26026Resolved":False,
            "productionAuthorityGranted":False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(json.dumps(result["summary"], indent=2))
    for row in rows:
        print(
            f"[emb-diagnostic] {row['year']} {row['label']}: "
            f"Earth→Sun={row['earthCenterSunDirectionErrorArcsec']:.6f} arcsec, "
            f"EMB→Sun={row['embSunDirectionErrorArcsec']:.6f} arcsec, "
            f"improvement={row['embDirectionImprovementArcsec']:.6f} arcsec "
            f"({row['embDirectionImprovementFraction']*100:.3f}%), "
            f"Earth-within-EMB={row['earthWithinEmbPositionErrorKm']:.3f} km"
        )


if __name__ == "__main__":
    main()
