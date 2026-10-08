#!/usr/bin/env python3
"""IAS15 + GR A/B for the individual outer DE441 n373s perturbers.

The n373s capture is split by J2000 heliocentric radius.  Only the outer
(>10 AU) bodies are added here, which should isolate the individually modeled
KBO population while deliberately leaving the 44-AU KBO ring out.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

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


def load_outer(path: Path, baseline):
    payload = json.loads(path.read_text())
    if payload.get("setId") != "de441-n373s-j2000":
        raise RuntimeError("unexpected n373s capture set")
    if payload.get("epochTdbJulianDay") != baseline.J2000_TDB_JD:
        raise RuntimeError("n373s capture is not at J2000 TDB")
    bodies = [
        body for body in payload["bodies"]
        if body["population"] == "outer-kbo-candidate"
    ]
    if not (20 <= len(bodies) <= 40):
        raise RuntimeError(f"unexpected outer-body count {len(bodies)}")
    return payload, bodies


def make_variant(baseline, kernel, bodies):
    sim, rebx = baseline.make_simulation(
        kernel,
        0.5,
        physics="gr",
        integrator="ias15",
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


def samples_for_year(baseline, kernel, sim, year):
    samples = []
    for month, day, label in (
        (2, 4.5, "li-chun-window"),
        (3, 20.5, "march-equinox-window"),
        (9, 22.5, "september-equinox-window"),
    ):
        jd = baseline.gregorian_julian_day(year, month, day)
        sample = baseline.compare_at(kernel, sim, jd)
        sample.update({"year":year, "label":label})
        samples.append(sample)
    return samples


def compare_rows(base, variant):
    before = {(x["year"], x["label"]):x for x in base}
    rows = []
    for item in variant:
        b = before[(item["year"], item["label"])]
        bd = b["geocentricSunDirectionErrorArcsec"]
        vd = item["geocentricSunDirectionErrorArcsec"]
        bp = b["geocentricSunPositionErrorKm"]
        vp = item["geocentricSunPositionErrorKm"]
        rows.append({
            "year":item["year"],
            "label":item["label"],
            "baselineDirectionErrorArcsec":bd,
            "kboDirectionErrorArcsec":vd,
            "directionImprovementArcsec":bd-vd,
            "directionImprovementFraction":((bd-vd)/bd if bd else 0.0),
            "baselineGeocentricPositionErrorKm":bp,
            "kboGeocentricPositionErrorKm":vp,
            "positionImprovementKm":bp-vp,
        })
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--state-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--years", nargs="+", type=int, default=[4006, 10026])
    args = parser.parse_args()

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")
    metadata, outer = load_outer(args.state_json, baseline)

    kernel = SPK.open(str(args.kernel))
    try:
        base_sim, base_rebx = baseline.make_simulation(
            kernel, 0.5, physics="gr", integrator="ias15"
        )
        variant_sim, variant_rebx = make_variant(baseline, kernel, outer)
        _ = base_rebx, variant_rebx

        all_base = []
        all_variant = []
        all_comparison = []
        for year in args.years:
            base = samples_for_year(baseline, kernel, base_sim, year)
            variant = samples_for_year(baseline, kernel, variant_sim, year)
            rows = compare_rows(base, variant)
            all_base.extend(base)
            all_variant.extend(variant)
            all_comparison.extend(rows)

            print(f"[kbo30-checkpoint] year={year}", flush=True)
            for row in rows:
                print(
                    f"[kbo30] {row['year']} {row['label']}: "
                    f"{row['baselineDirectionErrorArcsec']:.6f} -> "
                    f"{row['kboDirectionErrorArcsec']:.6f} arcsec; "
                    f"improvement={row['directionImprovementArcsec']:.6f} "
                    f"({row['directionImprovementFraction']*100:.3f}%); "
                    f"geo-pos-improvement={row['positionImprovementKm']:.3f} km",
                    flush=True,
                )

            # Preserve a usable partial result even if the later 10026
            # integration exceeds CI runtime.
            partial = {
                "schemaVersion":1,
                "researchOnly":True,
                "sourceEphemeris":"DE441",
                "experiment":"IAS15 + gr + outer n373s individual perturbers",
                "outerBodyCount":len(outer),
                "throughYear":year,
                "baseline":all_base,
                "variant":all_variant,
                "comparison":all_comparison,
                "claimBoundary":{
                    "outerClassificationIsRadiusBasedProxy":True,
                    "includesKboRing":False,
                    "usesSemiActiveParticles":True,
                    "smallBodiesMutuallyInteract":False,
                    "year26026Resolved":False,
                    "productionAuthorityGranted":False,
                },
                "captureMetadata":{
                    "setId":metadata["setId"],
                    "smallKernelSha256":metadata["smallKernelSha256"],
                    "outerCount":metadata["outerCount"],
                },
            }
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(
                json.dumps(partial, indent=2, sort_keys=True) + "\n"
            )
    finally:
        kernel.close()


if __name__ == "__main__":
    main()
