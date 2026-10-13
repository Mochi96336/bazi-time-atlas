#!/usr/bin/env python3
"""Direct IAS15 N16 × solar-mass-loss interaction diagnostic at year 10026.

Four models share the same DE441 J2000 state:
A = GR
B = GR + solar mass loss
C = GR + N16
D = GR + solar mass loss + N16

The interaction vector is (D-B) - (C-A).  This directly tests whether an
asteroid differential measured on the no-mass-loss background remains valid
after solar mass loss is introduced.  N16 is used because direct IAS15 with all
343 asteroids exceeds the CI budget at year 10026.
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
MASS_LOSS_SEGMENT_YEARS = 10.0
TARGET_YEAR = 10026

N16_NUMBERS = {
    1, 2, 3, 4, 7, 10, 15, 16,
    31, 52, 65, 87, 88, 107, 511, 704,
}

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


def load_n16(path: Path, baseline):
    payload = json.loads(path.read_text())
    if payload.get("setId") != "de441-n373s-j2000":
        raise RuntimeError("unexpected n373s capture set")
    if payload.get("epochTdbJulianDay") != baseline.J2000_TDB_JD:
        raise RuntimeError("n373s capture is not at J2000 TDB")
    bodies = [
        b for b in payload["bodies"]
        if b.get("number") in N16_NUMBERS
    ]
    found = {b.get("number") for b in bodies}
    if found != N16_NUMBERS or len(bodies) != 16:
        raise RuntimeError(
            f"N16 subset mismatch: found={sorted(x for x in found if x is not None)}"
        )
    return payload, bodies


def add_n16(sim, baseline, bodies):
    for body in bodies:
        sim.add(
            m=float(body["gmKm3S2"]) / baseline.SUN_GM_UNIT,
            x=float(body["positionAu"][0]),
            y=float(body["positionAu"][1]),
            z=float(body["positionAu"][2]),
            vx=float(body["velocityAuPerDay"][0]),
            vy=float(body["velocityAuPerDay"][1]),
            vz=float(body["velocityAuPerDay"][2]),
        )


def make_sim(baseline, kernel, n16_bodies=None):
    sim, rebx = baseline.make_simulation(
        kernel, 0.5, physics="gr", integrator="ias15"
    )
    if n16_bodies:
        add_n16(sim, baseline, n16_bodies)
    return sim, rebx


def set_solar_mass(sim, initial_mass: float, elapsed_days: float):
    years = elapsed_days / JULIAN_YEAR_DAYS
    sim.particles[0].m = initial_mass * (
        1.0 + SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR * years
    )


def integrate_mass_loss(sim, target_days: float, initial_mass: float):
    segment_days = MASS_LOSS_SEGMENT_YEARS * JULIAN_YEAR_DAYS
    while sim.t < target_days:
        end = min(target_days, sim.t + segment_days)
        midpoint = 0.5 * (sim.t + end)
        set_solar_mass(sim, initial_mass, midpoint)
        sim.integrate(end, exact_finish_time=1)
    set_solar_mass(sim, initial_mass, target_days)


def geo_state(baseline, sim):
    ep, ev, sp, sv = baseline.snapshot(sim)
    return sp - ep, sv - ev


def truth_state(baseline, kernel, jd):
    ep, ev = baseline.state_from_route(kernel, jd, ((0, 3), (3, 399)))
    sp, sv = baseline.state_from_route(kernel, jd, ((0, 10),))
    return sp - ep, sv - ev


def metric(baseline, model_geo, truth_geo):
    return baseline.vector_angle_arcsec(model_geo, truth_geo)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--state-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")
    metadata, n16 = load_n16(args.state_json, baseline)

    kernel = SPK.open(str(args.kernel))
    try:
        a, a_rebx = make_sim(baseline, kernel)
        b, b_rebx = make_sim(baseline, kernel)
        c, c_rebx = make_sim(baseline, kernel, n16)
        d, d_rebx = make_sim(baseline, kernel, n16)
        _ = a_rebx, b_rebx, c_rebx, d_rebx

        b_m0 = float(b.particles[0].m)
        d_m0 = float(d.particles[0].m)

        rows = []
        for month, day, label in CHECKPOINTS:
            jd = baseline.gregorian_julian_day(TARGET_YEAR, month, day)
            t = jd - baseline.J2000_TDB_JD

            a.integrate(t, exact_finish_time=1)
            integrate_mass_loss(b, t, b_m0)
            c.integrate(t, exact_finish_time=1)
            integrate_mass_loss(d, t, d_m0)

            a_geo, _ = geo_state(baseline, a)
            b_geo, _ = geo_state(baseline, b)
            c_geo, _ = geo_state(baseline, c)
            d_geo, _ = geo_state(baseline, d)
            truth_geo, _ = truth_state(baseline, kernel, jd)

            asteroid_nomass = c_geo - a_geo
            asteroid_massloss = d_geo - b_geo
            cross = asteroid_massloss - asteroid_nomass
            additive_prediction = b_geo + asteroid_nomass

            cross_angle = baseline.vector_angle_arcsec(
                additive_prediction, d_geo
            )
            additive_error = metric(baseline, additive_prediction, truth_geo)
            direct_error = metric(baseline, d_geo, truth_geo)

            row = {
                "year": TARGET_YEAR,
                "label": label,
                "grDirectionErrorArcsec": metric(baseline, a_geo, truth_geo),
                "massLossDirectionErrorArcsec": metric(baseline, b_geo, truth_geo),
                "n16DirectionErrorArcsec": metric(baseline, c_geo, truth_geo),
                "massLossN16DirectDirectionErrorArcsec": direct_error,
                "massLossPlusNoMassN16DeltaDirectionErrorArcsec": additive_error,
                "additiveMinusDirectDirectionErrorArcsec": additive_error - direct_error,
                "interactionAngularSeparationArcsec": cross_angle,
                "interactionVectorKm": float(
                    np.linalg.norm(cross) * baseline.AU_KM
                ),
                "n16DeltaNoMassKm": float(
                    np.linalg.norm(asteroid_nomass) * baseline.AU_KM
                ),
                "n16DeltaMassLossKm": float(
                    np.linalg.norm(asteroid_massloss) * baseline.AU_KM
                ),
            }
            rows.append(row)
            print(
                f"[n16-cross] {label}: "
                f"A={row['grDirectionErrorArcsec']:.6f}, "
                f"B={row['massLossDirectionErrorArcsec']:.6f}, "
                f"C={row['n16DirectionErrorArcsec']:.6f}, "
                f"D={direct_error:.6f} arcsec; "
                f"additive={additive_error:.6f}; "
                f"interaction={cross_angle:.6f} arcsec "
                f"({row['interactionVectorKm']:.3f} km)",
                flush=True,
            )
    finally:
        kernel.close()

    max_interaction = max(
        row["interactionAngularSeparationArcsec"] for row in rows
    )
    max_additive_direct = max(
        abs(row["additiveMinusDirectDirectionErrorArcsec"])
        for row in rows
    )

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "sourceEphemeris": "DE441",
        "experiment": "direct IAS15 N16 x solar-mass-loss interaction at year 10026",
        "fractionalSolarMassLossPerYear": SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR,
        "massLossSegmentYears": MASS_LOSS_SEGMENT_YEARS,
        "n16Numbers": sorted(N16_NUMBERS),
        "rows": rows,
        "summary": {
            "maxInteractionAngularSeparationArcsec": max_interaction,
            "maxAdditiveMinusDirectDirectionErrorArcsec": max_additive_direct,
        },
        "captureMetadata": {
            "setId": metadata["setId"],
            "smallKernelSha256": metadata["smallKernelSha256"],
        },
        "claimBoundary": {
            "directIas15InteractionTest": True,
            "testsN16AsAsteroidInteractionProxy": True,
            "doesNotDirectlyValidateAsteroid343Interaction": True,
            "year26026Resolved": False,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(
        f"[n16-cross-summary] max-interaction={max_interaction:.6f} arcsec; "
        f"max-additive-minus-direct={max_additive_direct:.6f} arcsec",
        flush=True,
    )


if __name__ == "__main__":
    main()
