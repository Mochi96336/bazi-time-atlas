#!/usr/bin/env python3
"""Research-only N-body baseline against DE441.

Initialize a compact Solar-System point-mass model directly from DE441 at
J2000 TDB, integrate forward with REBOUND/WHFast, and compare Earth/Sun
barycentric states back against DE441 while the source ephemeris is still
available.

This intentionally tests the dynamics layer only.  It does not compute solar
terms, transform to the mean ecliptic of date, project TT to UT1, or claim a
civil-calendar seasonal phase.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rebound
import reboundx
from jplephem.spk import SPK

AU_KM = 149_597_870.700
SECONDS_PER_DAY = 86_400.0
J2000_TDB_JD = 2_451_545.0
EXPECTED_KERNEL_MD5 = "ad8dfa4e505ef0e3a5d587a5b4705632"
C_AU_PER_DAY = 173.1446326846693

# GM values in km^3/s^2.  Major-body barycentres are used for planets with
# satellites, except Earth where Earth and Moon are integrated separately.
# Values match the mass table bundled by REBOUND's Horizons helper.
GM = {
    "sun": 1.3271244004127942e11,
    "mercury": 2.2031868551400003e4,
    "venus": 3.2485859200000000e5,
    "earth": 3.9860043550702266e5,
    "moon": 4.9028001184575496e3,
    "mars_barycenter": 4.2828375815756102e4,
    "jupiter_barycenter": 1.2671276409999998e8,
    "saturn_barycenter": 3.7940584841799997e7,
    "uranus_barycenter": 5.7945563999999985e6,
    "neptune_barycenter": 6.8365271005803989e6,
    "pluto_barycenter": 9.7550000000000000e2,
}
SUN_GM_UNIT = 1.3271244004193938e11

BODIES = (
    ("sun", ((0, 10),)),
    ("mercury", ((0, 1),)),
    ("venus", ((0, 2),)),
    ("earth", ((0, 3), (3, 399))),
    ("moon", ((0, 3), (3, 301))),
    ("mars_barycenter", ((0, 4),)),
    ("jupiter_barycenter", ((0, 5),)),
    ("saturn_barycenter", ((0, 6),)),
    ("uranus_barycenter", ((0, 7),)),
    ("neptune_barycenter", ((0, 8),)),
    ("pluto_barycenter", ((0, 9),)),
)


def file_md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        while chunk := handle.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def gregorian_julian_day(year: int, month: int, day: float) -> float:
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
        + day + b - 1524.5
    )


def state_from_route(kernel: SPK, jd: float, route: tuple[tuple[int, int], ...]):
    position = np.zeros(3, dtype=np.float64)
    velocity = np.zeros(3, dtype=np.float64)
    for center, target in route:
        p, v = kernel[center, target].compute_and_differentiate(jd)
        position += np.asarray(p, dtype=np.float64)
        velocity += np.asarray(v, dtype=np.float64)
    return position / AU_KM, velocity / AU_KM


def add_body(sim: rebound.Simulation, name: str, position, velocity):
    sim.add(
        m=GM[name] / SUN_GM_UNIT,
        x=float(position[0]),
        y=float(position[1]),
        z=float(position[2]),
        vx=float(velocity[0]),
        vy=float(velocity[1]),
        vz=float(velocity[2]),
    )


def make_simulation(
    kernel: SPK,
    dt_days: float,
    physics: str = "newtonian",
    integrator: str = "whfast"
):
    sim = rebound.Simulation()
    sim.units = ("AU", "day", "Msun")
    if integrator not in ("whfast", "ias15"):
        raise ValueError(f"unsupported integrator: {integrator}")
    sim.integrator = integrator
    sim.dt = dt_days
    for name, route in BODIES:
        p, v = state_from_route(kernel, J2000_TDB_JD, route)
        add_body(sim, name, p, v)

    # Keep the exact DE441 barycentric initial frame.  Do not move_to_com().
    # REBOUNDx's "gr" force is the single-dominant-central-body 1PN
    # approximation.  It gets both mean motion and apsidal precession right,
    # unlike the faster gr_potential approximation.
    rebx = None
    if physics in ("gr", "gr_full"):
        rebx = reboundx.Extras(sim)
        force = rebx.load_force(physics)
        rebx.add_force(force)
        force.params["c"] = C_AU_PER_DAY
    elif physics != "newtonian":
        raise ValueError(f"unsupported physics mode: {physics}")
    return sim, rebx


def vector_angle_arcsec(a, b) -> float:
    an = np.linalg.norm(a)
    bn = np.linalg.norm(b)
    cosine = float(np.dot(a, b) / (an * bn))
    cosine = min(1.0, max(-1.0, cosine))
    return math.degrees(math.acos(cosine)) * 3600.0


def snapshot(sim: rebound.Simulation):
    # BODIES order is a pinned part of this research harness:
    # Sun index 0, Earth index 3.
    sun = sim.particles[0]
    earth = sim.particles[3]
    ep = np.array([earth.x, earth.y, earth.z], dtype=np.float64)
    ev = np.array([earth.vx, earth.vy, earth.vz], dtype=np.float64)
    sp = np.array([sun.x, sun.y, sun.z], dtype=np.float64)
    sv = np.array([sun.vx, sun.vy, sun.vz], dtype=np.float64)
    return ep, ev, sp, sv


def compare_at(kernel: SPK, sim: rebound.Simulation, jd: float):
    sim.integrate(jd - J2000_TDB_JD, exact_finish_time=1)
    ep, ev, sp, sv = snapshot(sim)
    tep, tev = state_from_route(kernel, jd, ((0, 3), (3, 399)))
    tsp, tsv = state_from_route(kernel, jd, ((0, 10),))

    model_geo = sp - ep
    truth_geo = tsp - tep
    model_geo_v = sv - ev
    truth_geo_v = tsv - tev

    return {
        "tdbJulianDay": jd,
        "earthPositionErrorKm": float(np.linalg.norm(ep - tep) * AU_KM),
        "sunPositionErrorKm": float(np.linalg.norm(sp - tsp) * AU_KM),
        "geocentricSunPositionErrorKm": float(np.linalg.norm(model_geo - truth_geo) * AU_KM),
        "geocentricSunDirectionErrorArcsec": vector_angle_arcsec(model_geo, truth_geo),
        "geocentricSunVelocityErrorMps": float(
            np.linalg.norm(model_geo_v - truth_geo_v) * AU_KM * 1000 / SECONDS_PER_DAY
        ),
        "geocentricSunRangeErrorKm": float(
            (np.linalg.norm(model_geo) - np.linalg.norm(truth_geo)) * AU_KM
        ),
    }


def integrate_validation(
    kernel: SPK,
    dt_days: float,
    years: tuple[int, ...],
    physics: str = "newtonian",
    integrator: str = "whfast"
):
    sim, rebx = make_simulation(
        kernel, dt_days, physics=physics, integrator=integrator
    )
    # Keep the Extras object alive for the full integration.
    _ = rebx
    samples = []
    for year in years:
        for month, day, label in (
            (2, 4.5, "li-chun-window"),
            (3, 20.5, "march-equinox-window"),
            (9, 22.5, "september-equinox-window"),
        ):
            jd = gregorian_julian_day(year, month, day)
            sample = compare_at(kernel, sim, jd)
            sample.update({"year": year, "label": label})
            samples.append(sample)
    return samples


def max_metric(samples, key: str) -> float:
    return max(abs(float(item[key])) for item in samples)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--primary-dt-days", type=float, default=4.0)
    parser.add_argument("--convergence-dt-days", type=float, default=2.0)
    parser.add_argument("--gr-fine-dt-days", type=float, default=1.0)
    parser.add_argument("--gr-ultrafine-dt-days", type=float, default=0.5)
    args = parser.parse_args()

    observed_md5 = file_md5(args.kernel)
    if observed_md5 != EXPECTED_KERNEL_MD5:
        raise RuntimeError(
            f"DE441 kernel MD5 mismatch: expected {EXPECTED_KERNEL_MD5}, got {observed_md5}"
        )

    kernel = SPK.open(str(args.kernel))
    try:
        validation_years = (4006, 10026)
        primary = integrate_validation(
            kernel, args.primary_dt_days, validation_years, physics="newtonian"
        )
        convergence = integrate_validation(
            kernel, args.convergence_dt_days, validation_years, physics="newtonian"
        )
        gr_primary = integrate_validation(
            kernel, args.primary_dt_days, validation_years, physics="gr"
        )
        gr_convergence = integrate_validation(
            kernel, args.convergence_dt_days, validation_years, physics="gr"
        )
        gr_fine = integrate_validation(
            kernel, args.gr_fine_dt_days, validation_years, physics="gr"
        )
        gr_ultrafine = integrate_validation(
            kernel, args.gr_ultrafine_dt_days, validation_years, physics="gr"
        )
        gr_ias15 = integrate_validation(
            kernel,
            args.gr_ultrafine_dt_days,
            validation_years,
            physics="gr",
            integrator="ias15"
        )
        gr_full_ias15 = integrate_validation(
            kernel,
            args.gr_ultrafine_dt_days,
            validation_years,
            physics="gr_full",
            integrator="ias15"
        )

        # Keep the existing Newtonian deep projection only as a historical
        # unvalidated state.  No GR year-26026 state is promoted until the
        # in-coverage checkpoints show that GR actually improves the model.
        deep, deep_rebx = make_simulation(
            kernel, args.convergence_dt_days, physics="newtonian"
        )
        _ = deep_rebx
        deep_jd = gregorian_julian_day(26026, 3, 20.5)
        deep.integrate(deep_jd - J2000_TDB_JD, exact_finish_time=1)
        dep, dev, dsp, dsv = snapshot(deep)
        deep_geo = dsp - dep

        by_key = {(item["year"], item["label"]): item for item in primary}
        convergence_delta = []
        for item in convergence:
            other = by_key[(item["year"], item["label"])]
            convergence_delta.append({
                "year": item["year"],
                "label": item["label"],
                "directionErrorArcsecDifference": (
                    item["geocentricSunDirectionErrorArcsec"]
                    - other["geocentricSunDirectionErrorArcsec"]
                ),
                "geocentricPositionErrorKmDifference": (
                    item["geocentricSunPositionErrorKm"]
                    - other["geocentricSunPositionErrorKm"]
                ),
            })

        newtonian_by_key = {
            (item["year"], item["label"]): item for item in convergence
        }
        gr_improvement = []
        for item in gr_convergence:
            baseline = newtonian_by_key[(item["year"], item["label"])]
            gr_improvement.append({
                "year": item["year"],
                "label": item["label"],
                "newtonianDirectionErrorArcsec": baseline["geocentricSunDirectionErrorArcsec"],
                "grDirectionErrorArcsec": item["geocentricSunDirectionErrorArcsec"],
                "directionImprovementArcsec": (
                    baseline["geocentricSunDirectionErrorArcsec"]
                    - item["geocentricSunDirectionErrorArcsec"]
                ),
                "directionImprovementFraction": (
                    (baseline["geocentricSunDirectionErrorArcsec"]
                     - item["geocentricSunDirectionErrorArcsec"])
                    / baseline["geocentricSunDirectionErrorArcsec"]
                ),
                "newtonianGeocentricPositionErrorKm": baseline["geocentricSunPositionErrorKm"],
                "grGeocentricPositionErrorKm": item["geocentricSunPositionErrorKm"],
                "positionImprovementKm": (
                    baseline["geocentricSunPositionErrorKm"]
                    - item["geocentricSunPositionErrorKm"]
                ),
            })

        gr_2d_by_key = {
            (item["year"], item["label"]): item for item in gr_convergence
        }
        gr_fine_convergence = []
        for item in gr_fine:
            coarse = gr_2d_by_key[(item["year"], item["label"])]
            gr_fine_convergence.append({
                "year": item["year"],
                "label": item["label"],
                "fineDtDays": args.gr_fine_dt_days,
                "coarseDtDays": args.convergence_dt_days,
                "directionErrorArcsecDifference": (
                    item["geocentricSunDirectionErrorArcsec"]
                    - coarse["geocentricSunDirectionErrorArcsec"]
                ),
                "geocentricPositionErrorKmDifference": (
                    item["geocentricSunPositionErrorKm"]
                    - coarse["geocentricSunPositionErrorKm"]
                ),
            })

        gr_fine_by_key = {
            (item["year"], item["label"]): item for item in gr_fine
        }
        gr_ultrafine_convergence = []
        for item in gr_ultrafine:
            coarse = gr_fine_by_key[(item["year"], item["label"])]
            gr_ultrafine_convergence.append({
                "year": item["year"],
                "label": item["label"],
                "fineDtDays": args.gr_ultrafine_dt_days,
                "coarseDtDays": args.gr_fine_dt_days,
                "directionErrorArcsecDifference": (
                    item["geocentricSunDirectionErrorArcsec"]
                    - coarse["geocentricSunDirectionErrorArcsec"]
                ),
                "geocentricPositionErrorKmDifference": (
                    item["geocentricSunPositionErrorKm"]
                    - coarse["geocentricSunPositionErrorKm"]
                ),
            })

        gr_ultrafine_by_key = {
            (item["year"], item["label"]): item for item in gr_ultrafine
        }
        gr_ias15_comparison = []
        for item in gr_ias15:
            whfast = gr_ultrafine_by_key[(item["year"], item["label"])]
            gr_ias15_comparison.append({
                "year": item["year"],
                "label": item["label"],
                "ias15DirectionErrorArcsec": item["geocentricSunDirectionErrorArcsec"],
                "whfastHalfDayDirectionErrorArcsec": whfast["geocentricSunDirectionErrorArcsec"],
                "ias15MinusWhfastDirectionErrorArcsec": (
                    item["geocentricSunDirectionErrorArcsec"]
                    - whfast["geocentricSunDirectionErrorArcsec"]
                ),
                "ias15GeocentricPositionErrorKm": item["geocentricSunPositionErrorKm"],
                "whfastHalfDayGeocentricPositionErrorKm": whfast["geocentricSunPositionErrorKm"],
            })

        gr_ias15_by_key = {
            (item["year"], item["label"]): item for item in gr_ias15
        }
        gr_full_comparison = []
        for item in gr_full_ias15:
            approximate = gr_ias15_by_key[(item["year"], item["label"])]
            gr_full_comparison.append({
                "year": item["year"],
                "label": item["label"],
                "grDirectionErrorArcsec": approximate["geocentricSunDirectionErrorArcsec"],
                "grFullDirectionErrorArcsec": item["geocentricSunDirectionErrorArcsec"],
                "fullMinusApproxDirectionErrorArcsec": (
                    item["geocentricSunDirectionErrorArcsec"]
                    - approximate["geocentricSunDirectionErrorArcsec"]
                ),
                "grGeocentricPositionErrorKm": approximate["geocentricSunPositionErrorKm"],
                "grFullGeocentricPositionErrorKm": item["geocentricSunPositionErrorKm"],
            })

        result = {
            "schemaVersion": 6,
            "researchOnly": True,
            "sourceEphemeris": "DE441",
            "initialEpochTdbJulianDay": J2000_TDB_JD,
            "integrator": "WHFast",
            "reboundVersion": rebound.__version__,
            "reboundxVersion": reboundx.__version__,
            "model": {
                "bodies": [name for name, _ in BODIES],
                "bodyCount": len(BODIES),
                "majorPlanets": True,
                "earthMoonSeparated": True,
                "asteroidsIncluded": False,
                "generalRelativityIncluded": False,
                "grDiagnosticMode": "reboundx-gr-single-dominant-central-body-1pn",
                "grFullDiagnosticMode": "reboundx-gr-full-first-order-post-newtonian",
                "solarMassLossIncluded": False,
                "initialStateFrame": "DE441 ICRF barycentric",
                "initialStateTimeScale": "TDB",
            },
            "primaryDtDays": args.primary_dt_days,
            "convergenceDtDays": args.convergence_dt_days,
            "grFineDtDays": args.gr_fine_dt_days,
            "grUltrafineDtDays": args.gr_ultrafine_dt_days,
            "primary": primary,
            "convergence": convergence,
            "convergenceDelta": convergence_delta,
            "grPrimary": gr_primary,
            "grConvergence": gr_convergence,
            "grFine": gr_fine,
            "grFineConvergence": gr_fine_convergence,
            "grUltrafine": gr_ultrafine,
            "grUltrafineConvergence": gr_ultrafine_convergence,
            "grIas15": gr_ias15,
            "grIas15Comparison": gr_ias15_comparison,
            "grFullIas15": gr_full_ias15,
            "grFullComparison": gr_full_comparison,
            "grImprovement": gr_improvement,
            "summary": {
                "primaryMaxDirectionErrorArcsec": max_metric(primary, "geocentricSunDirectionErrorArcsec"),
                "convergenceMaxDirectionErrorArcsec": max_metric(convergence, "geocentricSunDirectionErrorArcsec"),
                "primaryMaxGeocentricPositionErrorKm": max_metric(primary, "geocentricSunPositionErrorKm"),
                "convergenceMaxGeocentricPositionErrorKm": max_metric(convergence, "geocentricSunPositionErrorKm"),
                "grPrimaryMaxDirectionErrorArcsec": max_metric(gr_primary, "geocentricSunDirectionErrorArcsec"),
                "grConvergenceMaxDirectionErrorArcsec": max_metric(gr_convergence, "geocentricSunDirectionErrorArcsec"),
                "grFineMaxDirectionErrorArcsec": max_metric(gr_fine, "geocentricSunDirectionErrorArcsec"),
                "grUltrafineMaxDirectionErrorArcsec": max_metric(gr_ultrafine, "geocentricSunDirectionErrorArcsec"),
                "grIas15MaxDirectionErrorArcsec": max_metric(gr_ias15, "geocentricSunDirectionErrorArcsec"),
                "grFullIas15MaxDirectionErrorArcsec": max_metric(gr_full_ias15, "geocentricSunDirectionErrorArcsec"),
                "grPrimaryMaxGeocentricPositionErrorKm": max_metric(gr_primary, "geocentricSunPositionErrorKm"),
                "grConvergenceMaxGeocentricPositionErrorKm": max_metric(gr_convergence, "geocentricSunPositionErrorKm"),
                "grFineMaxGeocentricPositionErrorKm": max_metric(gr_fine, "geocentricSunPositionErrorKm"),
                "grUltrafineMaxGeocentricPositionErrorKm": max_metric(gr_ultrafine, "geocentricSunPositionErrorKm"),
                "grIas15MaxGeocentricPositionErrorKm": max_metric(gr_ias15, "geocentricSunPositionErrorKm"),
                "grFullIas15MaxGeocentricPositionErrorKm": max_metric(gr_full_ias15, "geocentricSunPositionErrorKm"),
            },
            "deepProjection26026": {
                "status": "unvalidated-nbody-state-only",
                "tdbJulianDay": deep_jd,
                "earthPositionAu": dep.tolist(),
                "earthVelocityAuPerDay": dev.tolist(),
                "sunPositionAu": dsp.tolist(),
                "sunVelocityAuPerDay": dsv.tolist(),
                "geocentricSunVectorAu": deep_geo.tolist(),
                "absoluteSeasonalPhaseResolved": False,
                "civilTimeResolved": False,
                "productionAuthorityGranted": False,
            },
        }
    finally:
        kernel.close()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({
        "reboundVersion": result["reboundVersion"],
        "reboundxVersion": result["reboundxVersion"],
        "primaryDtDays": result["primaryDtDays"],
        "convergenceDtDays": result["convergenceDtDays"],
        "grFineDtDays": result["grFineDtDays"],
        "grUltrafineDtDays": result["grUltrafineDtDays"],
        **result["summary"],
        "year26026Status": result["deepProjection26026"]["status"],
    }, indent=2))


if __name__ == "__main__":
    main()
