#!/usr/bin/env python3
"""Audit REBOUND baseline masses against official DE440/441 integration constants.

This is a no-integration diagnostic.  It parses the official ASCII integration
header, derives Earth/Moon GM from GMB + EMRAT, converts AU^3/day^2 constants to
km^3/s^2 with the header's AU, and compares them with the current baseline.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
from pathlib import Path

import rebound

ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = ROOT / "scripts" / "research-rebound-de441-state-baseline.py"
SECONDS_PER_DAY = 86_400.0


def load_baseline():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load baseline")
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


def constants_from_header(path: Path) -> dict[str, float]:
    text = path.read_text(errors="strict")
    names = ascii_group(text, 1040)
    raw = ascii_group(text, 1041)
    if len(names) != len(raw):
        raise RuntimeError("constant name/value length mismatch")
    return {
        name: float(value.replace("D", "E").replace("d", "e"))
        for name, value in zip(names, raw)
    }


def au3day2_to_km3s2(value: float, au_km: float) -> float:
    return value * au_km ** 3 / SECONDS_PER_DAY ** 2


def official_gm_km3s2(constants: dict[str, float]) -> dict[str, float]:
    au_km = constants["AU"]
    gmb = au3day2_to_km3s2(constants["GMB"], au_km)
    emrat = constants["EMRAT"]
    moon = gmb / (1.0 + emrat)
    earth = gmb - moon

    mapping = {
        "sun": "GMS",
        "mercury": "GM1",
        "venus": "GM2",
        "mars_barycenter": "GM4",
        "jupiter_barycenter": "GM5",
        "saturn_barycenter": "GM6",
        "uranus_barycenter": "GM7",
        "neptune_barycenter": "GM8",
        "pluto_barycenter": "GM9",
    }
    out = {
        name: au3day2_to_km3s2(constants[key], au_km)
        for name, key in mapping.items()
    }
    out["earth"] = earth
    out["moon"] = moon
    return out


def effective_rebound_gm_km3s2(baseline, name: str) -> float:
    sim = rebound.Simulation()
    sim.units = ("AU", "day", "Msun")
    mass = baseline.GM[name] / baseline.SUN_GM_UNIT
    gm_au3day2 = sim.G * mass
    return gm_au3day2 * baseline.AU_KM ** 3 / baseline.SECONDS_PER_DAY ** 2


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--header", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    baseline = load_baseline()
    constants = constants_from_header(args.header)
    official = official_gm_km3s2(constants)

    rows = []
    for name, _ in baseline.BODIES:
        current = float(baseline.GM[name])
        target = float(official[name])
        delta = current - target
        rel = delta / target
        effective = effective_rebound_gm_km3s2(baseline, name)
        effective_delta = effective - target
        effective_rel = effective_delta / target
        rows.append({
            "name": name,
            "baselineGmKm3S2": current,
            "officialGmKm3S2": target,
            "baselineMinusOfficialKm3S2": delta,
            "baselineRelativeError": rel,
            "baselineErrorPpb": rel * 1e9,
            "effectiveReboundGmKm3S2": effective,
            "effectiveMinusOfficialKm3S2": effective_delta,
            "effectiveRelativeError": effective_rel,
            "effectiveErrorPpb": effective_rel * 1e9,
        })

    max_abs_ppb = max(abs(row["effectiveErrorPpb"]) for row in rows)
    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "source": "official DE440/441 ASCII integration header",
        "headerDenum": constants.get("DENUM"),
        "headerAuKm": constants["AU"],
        "headerEmrat": constants["EMRAT"],
        "baselineSunGmUnitKm3S2": baseline.SUN_GM_UNIT,
        "reboundVersion": rebound.__version__,
        "rows": rows,
        "summary": {
            "maxAbsoluteEffectiveErrorPpb": max_abs_ppb,
            "maxAbsoluteBaselineErrorPpb": max(
                abs(row["baselineErrorPpb"]) for row in rows
            ),
        },
        "claimBoundary": {
            "testsMassConstantsOnly": True,
            "testsInitialStates": False,
            "testsForceModel": False,
            "testsDeepIntegration": False,
            "year26026Resolved": False,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    for row in rows:
        print(
            f"[gm-audit] {row['name']}: "
            f"baseline={row['baselineGmKm3S2']:.12f}, "
            f"official={row['officialGmKm3S2']:.12f}, "
            f"raw={row['baselineErrorPpb']:.6f} ppb, "
            f"effective={row['effectiveErrorPpb']:.6f} ppb"
        )
    print(f"[gm-audit] max-effective={max_abs_ppb:.6f} ppb")


if __name__ == "__main__":
    main()
