#!/usr/bin/env python3
"""Focused 2026→4006 GR-model comparison on the existing DE441 baseline."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

from jplephem.spk import SPK

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "scripts" / "research-rebound-de441-state-baseline.py"

spec = importlib.util.spec_from_file_location("rebound_de441_baseline", BASELINE_PATH)
baseline = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(baseline)


def by_key(samples):
    return {(item["year"], item["label"]): item for item in samples}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    observed_md5 = baseline.file_md5(args.kernel)
    if observed_md5 != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError(
            f"DE441 kernel MD5 mismatch: expected {baseline.EXPECTED_KERNEL_MD5}, got {observed_md5}"
        )

    kernel = SPK.open(str(args.kernel))
    try:
        years = (4006,)
        approximate = baseline.integrate_validation(
            kernel, 0.5, years, physics="gr", integrator="ias15"
        )
        full = baseline.integrate_validation(
            kernel, 0.5, years, physics="gr_full", integrator="ias15"
        )
    finally:
        kernel.close()

    approximate_by_key = by_key(approximate)
    comparisons = []
    for item in full:
        other = approximate_by_key[(item["year"], item["label"])]
        comparisons.append({
            "year": item["year"],
            "label": item["label"],
            "grDirectionErrorArcsec": other["geocentricSunDirectionErrorArcsec"],
            "grFullDirectionErrorArcsec": item["geocentricSunDirectionErrorArcsec"],
            "directionErrorChangeArcsec": (
                item["geocentricSunDirectionErrorArcsec"]
                - other["geocentricSunDirectionErrorArcsec"]
            ),
            "grPositionErrorKm": other["geocentricSunPositionErrorKm"],
            "grFullPositionErrorKm": item["geocentricSunPositionErrorKm"],
            "positionErrorChangeKm": (
                item["geocentricSunPositionErrorKm"]
                - other["geocentricSunPositionErrorKm"]
            ),
        })

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "sourceEphemeris": "DE441",
        "catalogueYears": [4006],
        "integrator": "IAS15",
        "approximateModel": "reboundx-gr",
        "fullModel": "reboundx-gr_full",
        "approximate": approximate,
        "full": full,
        "comparisons": comparisons,
        "maxApproximateDirectionErrorArcsec": max(
            x["geocentricSunDirectionErrorArcsec"] for x in approximate
        ),
        "maxFullDirectionErrorArcsec": max(
            x["geocentricSunDirectionErrorArcsec"] for x in full
        ),
        "productionAuthorityGranted": False,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    for item in comparisons:
        print(
            f"[rebound-grfull-4006] {item['label']}: "
            f"gr={item['grDirectionErrorArcsec']:.6f} arcsec, "
            f"gr_full={item['grFullDirectionErrorArcsec']:.6f} arcsec, "
            f"delta={item['directionErrorChangeArcsec']:+.6f} arcsec, "
            f"position-delta={item['positionErrorChangeKm']:+.3f} km"
        )


if __name__ == "__main__":
    main()
