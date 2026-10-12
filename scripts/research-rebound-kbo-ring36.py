#!/usr/bin/env python3
"""Focused IAS15 + GR A/B for DE440/441's 36-point 44 AU KBO ring.

The ring-point masses are read from the official DE440/441 integration header
(MA8201..MA8236).  Two uniform phase offsets are tested to expose sensitivity
to the unknown absolute azimuth of the discrete 36-point realization.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import re
from pathlib import Path

from jplephem.spk import SPK

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "scripts" / "research-rebound-de441-state-baseline.py"

RING_RADIUS_AU = 44.0
RING_POINT_COUNT = 36
J2000_OBLIQUITY_DEG = 23.439291111


def load_baseline_module():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load REBOUND baseline module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ascii_group(text: str, group_number: int) -> list[str]:
    match = re.search(
        rf"(?m)^\s*GROUP\s+{group_number}\s*$([\s\S]*?)(?=^\s*GROUP\s+\d+\s*$|\Z)",
        text,
    )
    if not match:
        raise RuntimeError(f"GROUP {group_number} missing")
    tokens = match.group(1).split()
    declared = int(tokens[0])
    values = tokens[1:1 + declared]
    if len(values) != declared:
        raise RuntimeError(f"GROUP {group_number} length mismatch")
    return values


def ring_gm_values(header_path: Path):
    text = header_path.read_text(errors="strict")
    names = ascii_group(text, 1040)
    raw = ascii_group(text, 1041)
    values = [float(x.replace("D", "E").replace("d", "e")) for x in raw]
    constants = dict(zip(names, values))
    keys = [f"MA82{i:02d}" for i in range(1, 37)]
    missing = [key for key in keys if key not in constants]
    if missing:
        raise RuntimeError(f"ring constants missing: {missing}")
    gm_au3_day2 = [constants[key] for key in keys]
    if max(gm_au3_day2) - min(gm_au3_day2) > 1e-24:
        raise RuntimeError("MA8201..MA8236 are not equal-mass ring points")
    return keys, gm_au3_day2


def make_ring_variant(baseline, kernel, header_path: Path, phase_offset_deg: float):
    sim, rebx = baseline.make_simulation(
        kernel, 0.5, physics="gr", integrator="ias15"
    )
    keys, gm_values = ring_gm_values(header_path)
    sun = sim.particles[0]
    eps = math.radians(J2000_OBLIQUITY_DEG)

    for index, gm_au3_day2 in enumerate(gm_values):
        phase = math.radians(phase_offset_deg + index * 360.0 / RING_POINT_COUNT)
        gm_km3_s2 = (
            gm_au3_day2 * baseline.AU_KM ** 3 / baseline.SECONDS_PER_DAY ** 2
        )
        sim.add(
            primary=sun,
            m=gm_km3_s2 / baseline.SUN_GM_UNIT,
            a=RING_RADIUS_AU,
            e=0.0,
            inc=eps,
            Omega=0.0,
            omega=0.0,
            f=phase,
        )

    sim.N_active = len(baseline.BODIES)
    sim.testparticle_type = 1
    return sim, rebx, {
        "keys":keys,
        "pointGmAu3Day2":gm_values[0],
        "totalGmAu3Day2":sum(gm_values),
        "phaseOffsetDegrees":phase_offset_deg,
    }


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


def comparison(base, variant, label):
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
            "variant":label,
            "baselineDirectionErrorArcsec":bd,
            "ringDirectionErrorArcsec":vd,
            "directionImprovementArcsec":bd-vd,
            "directionImprovementFraction":((bd-vd)/bd if bd else 0.0),
            "baselineGeocentricPositionErrorKm":bp,
            "ringGeocentricPositionErrorKm":vp,
            "positionImprovementKm":bp-vp,
        })
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--mass-header", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--years", nargs="+", type=int, default=[4006, 10026])
    args = parser.parse_args()

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")

    kernel = SPK.open(str(args.kernel))
    try:
        base_sim, base_rebx = baseline.make_simulation(
            kernel, 0.5, physics="gr", integrator="ias15"
        )
        ring0_sim, ring0_rebx, ring_meta0 = make_ring_variant(
            baseline, kernel, args.mass_header, 0.0
        )
        ring5_sim, ring5_rebx, ring_meta5 = make_ring_variant(
            baseline, kernel, args.mass_header, 5.0
        )
        _ = base_rebx, ring0_rebx, ring5_rebx

        base_all, r0_all, r5_all, rows = [], [], [], []
        for year in args.years:
            base = samples_for_year(baseline, kernel, base_sim, year)
            r0 = samples_for_year(baseline, kernel, ring0_sim, year)
            r5 = samples_for_year(baseline, kernel, ring5_sim, year)
            base_all.extend(base)
            r0_all.extend(r0)
            r5_all.extend(r5)
            rows0 = comparison(base, r0, "phase-0deg")
            rows5 = comparison(base, r5, "phase-5deg")
            rows.extend(rows0 + rows5)

            print(f"[kbo-ring36-checkpoint] year={year}", flush=True)
            for row in rows0 + rows5:
                print(
                    f"[kbo-ring36] {row['variant']} {row['year']} {row['label']}: "
                    f"{row['baselineDirectionErrorArcsec']:.6f} -> "
                    f"{row['ringDirectionErrorArcsec']:.6f} arcsec; "
                    f"improvement={row['directionImprovementArcsec']:.6f} "
                    f"({row['directionImprovementFraction']*100:.3f}%); "
                    f"geo-pos-improvement={row['positionImprovementKm']:.3f} km",
                    flush=True,
                )

            result = {
                "schemaVersion":1,
                "researchOnly":True,
                "sourceEphemeris":"DE441",
                "experiment":"IAS15 + gr + 36-point 44 AU KBO ring",
                "throughYear":year,
                "ring":{
                    "radiusAu":RING_RADIUS_AU,
                    "pointCount":RING_POINT_COUNT,
                    "j2000ObliquityDegrees":J2000_OBLIQUITY_DEG,
                    "phase0":ring_meta0,
                    "phase5":ring_meta5,
                },
                "baseline":base_all,
                "phase0":r0_all,
                "phase5":r5_all,
                "comparison":rows,
                "claimBoundary":{
                    "massFromOfficialIntegrationHeader":True,
                    "uniformCircularInitialization":True,
                    "absoluteRingAzimuthKnown":False,
                    "phaseSensitivityBracketedByTwoOffsets":True,
                    "usesSemiActiveParticles":True,
                    "ringPointsMutuallyInteract":False,
                    "includesKbo30":False,
                    "includesAsteroid343":False,
                    "year26026Resolved":False,
                    "productionAuthorityGranted":False,
                },
            }
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    finally:
        kernel.close()


if __name__ == "__main__":
    main()
