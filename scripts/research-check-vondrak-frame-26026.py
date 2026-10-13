#!/usr/bin/env python3
"""Cross-check the pinned Swiss Vondrak frame against IAU SOFA/ERFA.

This is an implementation proof, not independent year-26026 astronomical
truth.  The same inertial directions are also sent through the repository's
Owen/Horizons mean-frame probe at overlap epochs so the model transition is
measured before Owen's documented implementation range ends.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

import erfa
import numpy as np

ARCSEC_PER_RAD = 206264.80624709636
J2000_JD = 2451545.0

YEARS = (2026, 4006, 10026, 26026)
OWEN_OVERLAP_YEARS = (4006, 10026)
OWEN_IMPLEMENTATION_CALENDAR_RANGE = (-18000, 14000)
DIRECTIONS = (
    (0.0, 0.0),
    (37.0, 23.0),
    (91.0, -17.0),
    (183.0, 8.0),
    (271.0, 61.0),
    (319.0, -44.0),
)

MAX_SWISS_ERFA_RESIDUAL_ARCSEC = 0.05


def gregorian_jd(year: int, month: int, day: float) -> float:
    y = year
    m = month
    if m <= 2:
        y -= 1
        m += 12
    a = math.floor(y / 100)
    b = 2 - a + math.floor(a / 4)
    return (
        math.floor(365.25 * (y + 4716))
        + math.floor(30.6001 * (m + 1))
        + day
        + b
        - 1524.5
    )


def unit_from_ra_dec(ra_degrees: float, dec_degrees: float) -> np.ndarray:
    ra = math.radians(ra_degrees)
    dec = math.radians(dec_degrees)
    c = math.cos(dec)
    return np.array(
        [c * math.cos(ra), c * math.sin(ra), math.sin(dec)],
        dtype=np.float64,
    )


def unit_from_lon_lat(lon_degrees: float, lat_degrees: float) -> np.ndarray:
    lon = math.radians(lon_degrees)
    lat = math.radians(lat_degrees)
    c = math.cos(lat)
    return np.array(
        [c * math.cos(lon), c * math.sin(lon), math.sin(lat)],
        dtype=np.float64,
    )


def lon_lat_from_unit(vector: np.ndarray) -> tuple[float, float]:
    vector = vector / np.linalg.norm(vector)
    lon = math.degrees(math.atan2(vector[1], vector[0])) % 360.0
    lat = math.degrees(
        math.atan2(vector[2], math.hypot(vector[0], vector[1]))
    )
    return lon, lat


def separation_arcsec(a: np.ndarray, b: np.ndarray) -> float:
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    return (
        math.atan2(
            float(np.linalg.norm(np.cross(a, b))),
            float(np.dot(a, b)),
        )
        * ARCSEC_PER_RAD
    )


def run_probe(
    executable: Path,
    mode: str,
    jd: float,
    ra_degrees: float,
    dec_degrees: float,
    *,
    owen: bool = False,
) -> tuple[float, float, float]:
    args = [
        str(executable),
        mode,
        str(jd),
        str(ra_degrees),
        str(dec_degrees),
    ]
    if owen:
        # Mean mode ignores EOP values, but the existing probe keeps one CLI
        # for mean/apparent diagnostics.
        args += ["0", "0"]
    run = subprocess.run(
        args,
        check=False,
        text=True,
        capture_output=True,
    )
    if run.returncode != 0:
        raise RuntimeError(
            f"probe failed ({executable}, {mode}, {jd}): "
            f"{run.stderr.strip()}"
        )
    values = [float(value) for value in run.stdout.strip().split()]
    if len(values) != 3 or not all(math.isfinite(v) for v in values):
        raise RuntimeError(f"malformed probe output: {run.stdout!r}")
    return values[0], values[1], values[2]


def erfa_vondrak_ecliptic(
    jd: float,
    ra_degrees: float,
    dec_degrees: float,
) -> tuple[float, float]:
    epoch = 2000.0 + (jd - J2000_JD) / 365.25
    matrix = erfa.ltecm(epoch)
    vector = matrix @ unit_from_ra_dec(ra_degrees, dec_degrees)
    return lon_lat_from_unit(vector)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vondrak-probe", required=True, type=Path)
    parser.add_argument("--owen-probe", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    rows = []
    bias_rows = []

    for year in YEARS:
        jd = gregorian_jd(year, 3, 20.5)
        for ra, dec in DIRECTIONS:
            swiss_lon, swiss_lat, eps = run_probe(
                args.vondrak_probe,
                "mean",
                jd,
                ra,
                dec,
            )
            no_bias_lon, no_bias_lat, _ = run_probe(
                args.vondrak_probe,
                "mean-no-bias",
                jd,
                ra,
                dec,
            )
            erfa_lon, erfa_lat = erfa_vondrak_ecliptic(
                jd,
                ra,
                dec,
            )

            swiss_vector = unit_from_lon_lat(swiss_lon, swiss_lat)
            erfa_vector = unit_from_lon_lat(erfa_lon, erfa_lat)
            no_bias_vector = unit_from_lon_lat(no_bias_lon, no_bias_lat)

            rows.append({
                "year": year,
                "ttJulianDay": jd,
                "icrfRaDegrees": ra,
                "icrfDecDegrees": dec,
                "swissLongitudeDegrees": swiss_lon,
                "swissLatitudeDegrees": swiss_lat,
                "erfaLongitudeDegrees": erfa_lon,
                "erfaLatitudeDegrees": erfa_lat,
                "swissMeanObliquityDegrees": eps,
                "swissMinusErfaArcsec": separation_arcsec(
                    swiss_vector,
                    erfa_vector,
                ),
            })
            bias_rows.append({
                "year": year,
                "icrfRaDegrees": ra,
                "icrfDecDegrees": dec,
                "biasEffectArcsec": separation_arcsec(
                    swiss_vector,
                    no_bias_vector,
                ),
            })

    overlap = []
    for year in OWEN_OVERLAP_YEARS:
        jd = gregorian_jd(year, 3, 20.5)
        for ra, dec in DIRECTIONS:
            vondrak_lon, vondrak_lat, _ = run_probe(
                args.vondrak_probe,
                "mean",
                jd,
                ra,
                dec,
            )
            owen_lon, owen_lat, _ = run_probe(
                args.owen_probe,
                "mean",
                jd,
                ra,
                dec,
                owen=True,
            )
            overlap.append({
                "year": year,
                "ttJulianDay": jd,
                "icrfRaDegrees": ra,
                "icrfDecDegrees": dec,
                "vondrakMinusOwenMeanFrameArcsec": separation_arcsec(
                    unit_from_lon_lat(vondrak_lon, vondrak_lat),
                    unit_from_lon_lat(owen_lon, owen_lat),
                ),
            })

    max_cross = max(row["swissMinusErfaArcsec"] for row in rows)
    max_bias = max(row["biasEffectArcsec"] for row in bias_rows)
    overlap_by_year = {
        str(year): {
            "maxArcsec": max(
                row["vondrakMinusOwenMeanFrameArcsec"]
                for row in overlap
                if row["year"] == year
            ),
            "meanArcsec": sum(
                row["vondrakMinusOwenMeanFrameArcsec"]
                for row in overlap
                if row["year"] == year
            )
            / sum(1 for row in overlap if row["year"] == year),
        }
        for year in OWEN_OVERLAP_YEARS
    }

    accepted = max_cross < MAX_SWISS_ERFA_RESIDUAL_ARCSEC

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "frameModel": {
            "name": "Vondrak-Capitaine-Wallace 2011/2012 long-term precession",
            "semantics": "ICRF direction to Earth mean ecliptic-of-date",
            "targetCatalogueYear": 26026,
            "nominalValidityYearsFromJ2000": 200000,
            "nutationApplied": False,
        },
        "implementationCrossCheck": {
            "implementations": [
                "pinned Swiss Ephemeris Vondrak 2011",
                "IAU SOFA long-term ecliptic matrix via ERFA ltecm",
            ],
            "sampleYears": list(YEARS),
            "directionsPerYear": len(DIRECTIONS),
            "gateArcsec": MAX_SWISS_ERFA_RESIDUAL_ARCSEC,
            "maxResidualArcsec": max_cross,
            "maxSwissFrameBiasEffectArcsec": max_bias,
            "accepted": accepted,
            "rows": rows,
        },
        "owenOverlapDiagnostic": {
            "owenImplementationCalendarRange": list(
                OWEN_IMPLEMENTATION_CALENDAR_RANGE
            ),
            "overlapYears": list(OWEN_OVERLAP_YEARS),
            "target26026InsideOwenImplementationRange": False,
            "summaryByYear": overlap_by_year,
            "rows": overlap,
        },
        "claimBoundary": {
            "year26026FrameAlgorithmCrossValidated": accepted,
            "year26026IndependentAstronomicalFrameTruth": False,
            "year26026NutationResolved": False,
            "year26026SeasonalCrossingResolved": False,
            "year26026CivilTimeResolved": False,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(
        json.dumps(
            {
                "accepted": accepted,
                "maxSwissVsErfaArcsec": max_cross,
                "maxFrameBiasEffectArcsec": max_bias,
                "vondrakVsOwen": overlap_by_year,
            },
            indent=2,
        ),
        flush=True,
    )

    if not accepted:
        raise RuntimeError(
            "Vondrak Swiss/ERFA implementation cross-check failed"
        )


if __name__ == "__main__":
    main()
