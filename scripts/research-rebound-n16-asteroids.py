#!/usr/bin/env python3
"""Dedicated IAS15 + GR versus IAS15 + GR + Horizons N16 asteroid A/B.

This is intentionally separate from the full REBOUND baseline so prior
Newtonian / WHFast / gr_full diagnostics do not need to be recomputed on every
asteroid-subset experiment.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
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


def validate_n16_state_file(path: Path, module):
    payload = json.loads(path.read_text())
    if payload.get("setId") != "horizons-de441-era-n16":
        raise RuntimeError("unexpected N16 set id")
    if payload.get("epochTdbJulianDay") != module.J2000_TDB_JD:
        raise RuntimeError("N16 capture must be at J2000 TDB")
    if payload.get("center") != "solar-system-barycenter":
        raise RuntimeError("N16 capture must be SSB-centered")
    if payload.get("referenceFrame") != "ICRF":
        raise RuntimeError("N16 capture must be ICRF")
    bodies = payload.get("bodies")
    if not isinstance(bodies, list) or len(bodies) != 16:
        raise RuntimeError("N16 capture must contain exactly 16 bodies")
    return payload, bodies


def by_key(samples):
    return {(item["year"], item["label"]): item for item in samples}


def integrate_with_n16(baseline, kernel, years, n16_bodies):
    sim, rebx = baseline.make_simulation(
        kernel,
        0.5,
        physics="gr",
        integrator="ias15",
    )
    _ = rebx
    for body in n16_bodies:
        sim.add(
            m=float(body["gmKm3S2"]) / baseline.SUN_GM_UNIT,
            x=float(body["positionAu"][0]),
            y=float(body["positionAu"][1]),
            z=float(body["positionAu"][2]),
            vx=float(body["velocityAuPerDay"][0]),
            vy=float(body["velocityAuPerDay"][1]),
            vz=float(body["velocityAuPerDay"][2]),
        )

    samples = []
    for year in years:
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--n16-state-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    baseline = load_baseline_module()
    observed_md5 = baseline.file_md5(args.kernel)
    if observed_md5 != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError(
            f"DE441 kernel MD5 mismatch: expected {baseline.EXPECTED_KERNEL_MD5}, got {observed_md5}"
        )

    n16_meta, n16_bodies = validate_n16_state_file(args.n16_state_json, baseline)

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
        n16 = integrate_with_n16(
            baseline,
            kernel,
            years,
            n16_bodies,
        )
    finally:
        kernel.close()

    base_by_key = by_key(base)
    comparison = []
    for item in n16:
        before = base_by_key[(item["year"], item["label"])]
        before_dir = before["geocentricSunDirectionErrorArcsec"]
        after_dir = item["geocentricSunDirectionErrorArcsec"]
        before_pos = before["geocentricSunPositionErrorKm"]
        after_pos = item["geocentricSunPositionErrorKm"]
        comparison.append({
            "year":item["year"],
            "label":item["label"],
            "baselineDirectionErrorArcsec":before_dir,
            "n16DirectionErrorArcsec":after_dir,
            "directionDeltaArcsec":after_dir - before_dir,
            "directionImprovementArcsec":before_dir - after_dir,
            "directionImprovementFraction":(
                (before_dir - after_dir) / before_dir if before_dir else 0.0
            ),
            "baselineGeocentricPositionErrorKm":before_pos,
            "n16GeocentricPositionErrorKm":after_pos,
            "positionDeltaKm":after_pos - before_pos,
            "positionImprovementKm":before_pos - after_pos,
        })

    result = {
        "schemaVersion":1,
        "researchOnly":True,
        "sourceEphemeris":"DE441",
        "experiment":"IAS15 + REBOUNDx gr + Horizons N16 subset",
        "baselinePhysics":"IAS15 + gr",
        "variantPhysics":"IAS15 + gr + N16",
        "n16Metadata":n16_meta,
        "baseline":base,
        "n16":n16,
        "comparison":comparison,
        "summary":{
            "baselineMaxDirectionErrorArcsec":max(
                item["geocentricSunDirectionErrorArcsec"] for item in base
            ),
            "n16MaxDirectionErrorArcsec":max(
                item["geocentricSunDirectionErrorArcsec"] for item in n16
            ),
            "baselineMaxGeocentricPositionErrorKm":max(
                item["geocentricSunPositionErrorKm"] for item in base
            ),
            "n16MaxGeocentricPositionErrorKm":max(
                item["geocentricSunPositionErrorKm"] for item in n16
            ),
        },
        "claimBoundary":{
            "n16IsSubsetOfDe441AsteroidModel":True,
            "reproducesFull343AsteroidModel":False,
            "includesKboPerturbations":False,
            "year26026Resolved":False,
            "productionAuthorityGranted":False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(json.dumps(result["summary"], indent=2))
    for row in comparison:
        print(
            f"[n16-ab] {row['year']} {row['label']}: "
            f"{row['baselineDirectionErrorArcsec']:.6f} -> {row['n16DirectionErrorArcsec']:.6f} arcsec; "
            f"improvement={row['directionImprovementArcsec']:.6f} arcsec "
            f"({row['directionImprovementFraction']*100:.3f}%); "
            f"geo-pos-improvement={row['positionImprovementKm']:.3f} km"
        )


if __name__ == "__main__":
    main()
