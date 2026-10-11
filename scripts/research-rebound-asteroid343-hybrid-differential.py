#!/usr/bin/env python3
"""Hybrid asteroid343 differential estimator.

IAS15 with 343 semi-active particles is too expensive for the year-10026
checkpoint in CI.  This experiment isolates the asteroid contribution with a
paired WHFast baseline/variant, then applies only that differential vector to
an independently integrated IAS15+GR baseline.

The method is first validated at year 4006 against the already observed direct
IAS15+GR+343 checkpoint.  Only if the hybrid reconstruction agrees there is
the year-10026 estimate useful.
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

DIRECT_IAS15_343_4006_ARCSEC = {
    "li-chun-window": 0.528424,
    "march-equinox-window": 0.499748,
    "september-equinox-window": 0.925853,
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


def load_inner(path: Path, baseline):
    payload = json.loads(path.read_text())
    if payload.get("setId") != "de441-n373s-j2000":
        raise RuntimeError("unexpected n373s capture set")
    if payload.get("epochTdbJulianDay") != baseline.J2000_TDB_JD:
        raise RuntimeError("n373s capture is not at J2000 TDB")
    bodies = [b for b in payload["bodies"] if b["population"] == "asteroid343"]
    if len(bodies) != 343:
        raise RuntimeError(f"unexpected asteroid count {len(bodies)}")
    return payload, bodies


def make_asteroid_variant(baseline, kernel, bodies, dt_days):
    sim, rebx = baseline.make_simulation(
        kernel,
        dt_days,
        physics="gr",
        integrator="whfast",
    )
    active_count = len(baseline.BODIES)
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
    sim.N_active = active_count
    sim.testparticle_type = 1
    return sim, rebx


def geocentric_model_vector(baseline, sim):
    ep, ev, sp, sv = baseline.snapshot(sim)
    return sp - ep, sv - ev


def truth_vectors(baseline, kernel, jd):
    ep, ev = baseline.state_from_route(kernel, jd, ((0, 3), (3, 399)))
    sp, sv = baseline.state_from_route(kernel, jd, ((0, 10),))
    return sp - ep, sv - ev


def vector_metrics(baseline, model_geo, model_geo_v, truth_geo, truth_geo_v):
    return {
        "directionErrorArcsec": baseline.vector_angle_arcsec(model_geo, truth_geo),
        "positionErrorKm": float(
            np.linalg.norm(model_geo - truth_geo) * baseline.AU_KM
        ),
        "rangeErrorKm": float(
            (np.linalg.norm(model_geo) - np.linalg.norm(truth_geo))
            * baseline.AU_KM
        ),
        "velocityErrorMps": float(
            np.linalg.norm(model_geo_v - truth_geo_v)
            * baseline.AU_KM * 1000 / baseline.SECONDS_PER_DAY
        ),
    }


def run_hybrid(baseline, kernel, bodies, year, dt_days):
    ias15, ias15_rebx = baseline.make_simulation(
        kernel, 0.5, physics="gr", integrator="ias15"
    )
    wh_base, wh_base_rebx = baseline.make_simulation(
        kernel, dt_days, physics="gr", integrator="whfast"
    )
    wh_variant, wh_variant_rebx = make_asteroid_variant(
        baseline, kernel, bodies, dt_days
    )
    _ = ias15_rebx, wh_base_rebx, wh_variant_rebx

    rows = []
    for month, day, label in CHECKPOINTS:
        jd = baseline.gregorian_julian_day(year, month, day)
        t = jd - baseline.J2000_TDB_JD

        ias15.integrate(t, exact_finish_time=1)
        wh_base.integrate(t, exact_finish_time=1)
        wh_variant.integrate(t, exact_finish_time=1)

        ias_geo, ias_geo_v = geocentric_model_vector(baseline, ias15)
        wh_geo, wh_geo_v = geocentric_model_vector(baseline, wh_base)
        var_geo, var_geo_v = geocentric_model_vector(baseline, wh_variant)
        truth_geo, truth_geo_v = truth_vectors(baseline, kernel, jd)

        delta_geo = var_geo - wh_geo
        delta_geo_v = var_geo_v - wh_geo_v
        hybrid_geo = ias_geo + delta_geo
        hybrid_geo_v = ias_geo_v + delta_geo_v

        ias_metrics = vector_metrics(
            baseline, ias_geo, ias_geo_v, truth_geo, truth_geo_v
        )
        hybrid_metrics = vector_metrics(
            baseline, hybrid_geo, hybrid_geo_v, truth_geo, truth_geo_v
        )

        row = {
            "year": year,
            "label": label,
            "dtDays": dt_days,
            "ias15Baseline": ias_metrics,
            "hybrid": hybrid_metrics,
            "asteroidDeltaVectorAu": delta_geo.tolist(),
            "asteroidDeltaMagnitudeKm": float(
                np.linalg.norm(delta_geo) * baseline.AU_KM
            ),
            "asteroidDeltaVelocityMps": float(
                np.linalg.norm(delta_geo_v)
                * baseline.AU_KM * 1000 / baseline.SECONDS_PER_DAY
            ),
            "directionImprovementArcsec": (
                ias_metrics["directionErrorArcsec"]
                - hybrid_metrics["directionErrorArcsec"]
            ),
            "directionImprovementFraction": (
                (ias_metrics["directionErrorArcsec"]
                 - hybrid_metrics["directionErrorArcsec"])
                / ias_metrics["directionErrorArcsec"]
            ),
        }

        if year == 4006:
            direct = DIRECT_IAS15_343_4006_ARCSEC[label]
            row["directIas15Asteroid343DirectionErrorArcsec"] = direct
            row["hybridMinusDirectArcsec"] = (
                hybrid_metrics["directionErrorArcsec"] - direct
            )
        rows.append(row)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--state-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--dt-days", type=float, default=8.0)
    parser.add_argument("--years", nargs="+", type=int, default=[4006, 10026])
    args = parser.parse_args()

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")
    metadata, bodies = load_inner(args.state_json, baseline)

    kernel = SPK.open(str(args.kernel))
    try:
        rows = []
        for year in args.years:
            result = run_hybrid(
                baseline, kernel, bodies, year, args.dt_days
            )
            rows.extend(result)
            print(f"[asteroid343-hybrid-checkpoint] year={year} dt={args.dt_days}", flush=True)
            for row in result:
                msg = (
                    f"[asteroid343-hybrid] {year} {row['label']}: "
                    f"IAS15={row['ias15Baseline']['directionErrorArcsec']:.6f} -> "
                    f"hybrid={row['hybrid']['directionErrorArcsec']:.6f} arcsec; "
                    f"gain={row['directionImprovementArcsec']:.6f} "
                    f"({row['directionImprovementFraction']*100:.3f}%); "
                    f"delta={row['asteroidDeltaMagnitudeKm']:.3f} km"
                )
                if year == 4006:
                    msg += (
                        f"; direct343={row['directIas15Asteroid343DirectionErrorArcsec']:.6f}; "
                        f"hybrid-direct={row['hybridMinusDirectArcsec']:.6f}"
                    )
                print(msg, flush=True)
    finally:
        kernel.close()

    out = {
        "schemaVersion":1,
        "researchOnly":True,
        "method":"IAS15 baseline + paired-WHFast asteroid343 differential vector",
        "whfastDtDays":args.dt_days,
        "asteroidCount":len(bodies),
        "rows":rows,
        "validation":{
            "year4006DirectIas15Asteroid343Reference":DIRECT_IAS15_343_4006_ARCSEC,
            "promotionRule":"year-10026 estimate is usable only if year-4006 hybrid-direct residual is acceptably small and timestep convergence is demonstrated",
        },
        "captureMetadata":{
            "setId":metadata["setId"],
            "smallKernelSha256":metadata["smallKernelSha256"],
        },
        "claimBoundary":{
            "usesDifferentialIntegratorCancellation":True,
            "year10026IsHybridEstimate":True,
            "year26026Resolved":False,
            "productionAuthorityGranted":False,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
