#!/usr/bin/env python3
"""Cross-check the year-26026 Vondrak mean-ecliptic frame.

The primary comparison is deliberately geometric:

- pinned Swiss Vondrak equator/ecliptic pole series, exposed by the research
  probe without copying the coefficient tables;
- IAU SOFA/ERFA long-term ICRS->ecliptic matrix (ltecm).

A second Swiss path ("precess + scalar swi_epsiln") is measured and explicitly
rejected when it diverges from the pole construction at deep epochs.  Owen is
also retained only as an overlap diagnostic because year 26026 lies outside
the documented Swiss Owen implementation range.

This proves implementation composition, not independent astronomical truth.
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

MAX_POLE_MATRIX_VS_ERFA_ARCSEC = 0.001
MIN_REJECTED_SCALAR_MISMATCH_26026_ARCSEC = 1.0


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
        # Mean mode ignores EOP values; the existing Owen probe keeps the
        # arguments because its apparent mode needs them.
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


def summarize_by_year(rows: list[dict], key: str) -> dict[str, dict]:
    result = {}
    for year in YEARS:
        values = [row[key] for row in rows if row["year"] == year]
        if not values:
            continue
        result[str(year)] = {
            "maxArcsec": max(values),
            "meanArcsec": sum(values) / len(values),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vondrak-probe", required=True, type=Path)
    parser.add_argument("--owen-probe", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    rows = []
    for year in YEARS:
        jd = gregorian_jd(year, 3, 20.5)
        for ra, dec in DIRECTIONS:
            pole_lon, pole_lat, pole_eps = run_probe(
                args.vondrak_probe,
                "pole-matrix",
                jd,
                ra,
                dec,
            )
            scalar_lon, scalar_lat, scalar_eps = run_probe(
                args.vondrak_probe,
                "scalar-obliquity",
                jd,
                ra,
                dec,
            )
            erfa_lon, erfa_lat = erfa_vondrak_ecliptic(
                jd,
                ra,
                dec,
            )

            pole_vector = unit_from_lon_lat(pole_lon, pole_lat)
            scalar_vector = unit_from_lon_lat(scalar_lon, scalar_lat)
            erfa_vector = unit_from_lon_lat(erfa_lon, erfa_lat)

            rows.append({
                "year": year,
                "ttJulianDay": jd,
                "icrfRaDegrees": ra,
                "icrfDecDegrees": dec,
                "swissPoleLongitudeDegrees": pole_lon,
                "swissPoleLatitudeDegrees": pole_lat,
                "swissPoleGeometricObliquityDegrees": pole_eps,
                "swissScalarLongitudeDegrees": scalar_lon,
                "swissScalarLatitudeDegrees": scalar_lat,
                "swissScalarObliquityDegrees": scalar_eps,
                "erfaLongitudeDegrees": erfa_lon,
                "erfaLatitudeDegrees": erfa_lat,
                "poleMatrixMinusErfaArcsec": separation_arcsec(
                    pole_vector,
                    erfa_vector,
                ),
                "scalarMinusPoleMatrixArcsec": separation_arcsec(
                    scalar_vector,
                    pole_vector,
                ),
                "scalarMinusGeometricObliquityArcsec": (
                    scalar_eps - pole_eps
                ) * 3600.0,
            })

    pole_summary = summarize_by_year(
        rows,
        "poleMatrixMinusErfaArcsec",
    )
    scalar_summary = summarize_by_year(
        rows,
        "scalarMinusPoleMatrixArcsec",
    )

    overlap = []
    for year in OWEN_OVERLAP_YEARS:
        jd = gregorian_jd(year, 3, 20.5)
        for ra, dec in DIRECTIONS:
            vondrak_lon, vondrak_lat, _ = run_probe(
                args.vondrak_probe,
                "pole-matrix",
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
                "vondrakPoleMinusOwenMeanFrameArcsec": separation_arcsec(
                    unit_from_lon_lat(vondrak_lon, vondrak_lat),
                    unit_from_lon_lat(owen_lon, owen_lat),
                ),
            })

    overlap_by_year = {}
    for year in OWEN_OVERLAP_YEARS:
        values = [
            row["vondrakPoleMinusOwenMeanFrameArcsec"]
            for row in overlap
            if row["year"] == year
        ]
        overlap_by_year[str(year)] = {
            "maxArcsec": max(values),
            "meanArcsec": sum(values) / len(values),
        }

    max_pole_vs_erfa = max(
        row["poleMatrixMinusErfaArcsec"]
        for row in rows
    )
    max_scalar_26026 = scalar_summary[str(26026)]["maxArcsec"]

    accepted = (
        max_pole_vs_erfa < MAX_POLE_MATRIX_VS_ERFA_ARCSEC
        and max_scalar_26026
        > MIN_REJECTED_SCALAR_MISMATCH_26026_ARCSEC
    )

    result = {
        "schemaVersion": 2,
        "researchOnly": True,
        "frameModel": {
            "name": "Vondrak-Capitaine-Wallace 2011/2012 long-term precession",
            "semantics": "ICRF direction to Earth mean ecliptic-and-equinox of date",
            "targetCatalogueYear": 26026,
            "nominalValidityYearsFromJ2000": 200000,
            "nutationApplied": False,
            "preferredConstruction": (
                "equator-pole + ecliptic-pole + equinox basis"
            ),
        },
        "implementationCrossCheck": {
            "implementations": [
                "pinned Swiss Vondrak pre_pequ/pre_pecl pole series",
                "IAU SOFA/ERFA long-term ecliptic matrix via erfa.ltecm",
            ],
            "sampleYears": list(YEARS),
            "directionsPerYear": len(DIRECTIONS),
            "gateArcsec": MAX_POLE_MATRIX_VS_ERFA_ARCSEC,
            "maxResidualArcsec": max_pole_vs_erfa,
            "summaryByYear": pole_summary,
            "accepted": (
                max_pole_vs_erfa
                < MAX_POLE_MATRIX_VS_ERFA_ARCSEC
            ),
        },
        "rejectedScalarObliquityShortcut": {
            "description": (
                "Swiss swi_precess + independently fitted swi_epsiln "
                "does not preserve the full Vondrak ecliptic pole at "
                "remote epochs"
            ),
            "minimumExpected26026MismatchArcsec": (
                MIN_REJECTED_SCALAR_MISMATCH_26026_ARCSEC
            ),
            "summaryByYear": scalar_summary,
            "rejected": (
                max_scalar_26026
                > MIN_REJECTED_SCALAR_MISMATCH_26026_ARCSEC
            ),
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
        "rows": rows,
        "claimBoundary": {
            "year26026FrameAlgorithmCrossValidated": accepted,
            "year26026IndependentAstronomicalFrameTruth": False,
            "year26026NutationResolved": False,
            "year26026ApparentEquinoxResolved": False,
            "year26026SeasonalCrossingResolved": False,
            "year26026CivilTimeResolved": False,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n"
    )

    print(
        json.dumps(
            {
                "accepted": accepted,
                "poleMatrixVsErfa": pole_summary,
                "scalarShortcutVsPoleMatrix": scalar_summary,
                "vondrakPoleVsOwen": overlap_by_year,
            },
            indent=2,
        ),
        flush=True,
    )

    if not accepted:
        raise RuntimeError(
            "Vondrak pole-matrix implementation proof failed"
        )


if __name__ == "__main__":
    main()
