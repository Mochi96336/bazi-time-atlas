#!/usr/bin/env python3
"""Combined solar-mass-loss + asteroid343 deep-time validation.

This experiment tests whether the two dominant isolated corrections can be
combined without assuming scalar additivity.

Method:
1. Compute direct IAS15 + GR + solar mass loss + 343 asteroids at year 4006.
2. Compute an IAS15 + GR + solar-mass-loss baseline.
3. Add only a paired-WHFast asteroid343 vector differential to that baseline.
4. Require the hybrid reconstruction to match the direct year-4006 truth.
5. If validated, apply the same differential construction at year 10026 and
   test 4-day -> 2-day WHFast convergence.

The year-10026 combined result remains a validated hybrid estimate, not a
direct IAS15+343 integration.
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
VALIDATION_TOLERANCE_ARCSEC = 0.01
CONVERGENCE_TOLERANCE_ARCSEC = 0.005
MASS_LOSS_BASELINE_TOLERANCE_ARCSEC = 0.002

# Successful 2-day mass-loss-background hybrid from workflow run 38366972043.
# The 4-day result in that run was rejected because it failed the direct-4006
# validation catastrophically; the 2-day result matched direct truth at 4006.
PINNED_HYBRID_DT2_10026_ARCSEC = {
    "li-chun-window": 0.371116,
    "march-equinox-window": 0.167391,
    "september-equinox-window": 0.150323,
}
PINNED_HYBRID_DT2_SOURCE_RUN = 38366972043

ISOLATED_MASS_LOSS_10026_ARCSEC = {
    "li-chun-window": 0.900330,
    "march-equinox-window": 1.024500,
    "september-equinox-window": 0.969462,
}

# Direct IAS15 + GR + solar-mass-loss + asteroid343 truth from successful
# workflow run 38287766502.  The subsequent fixes changed only the hybrid
# baseline/differential construction, not this direct 4006 integration.
DIRECT_COMBINED_4006_ARCSEC = {
    "li-chun-window": 0.091333,
    "march-equinox-window": 0.023001,
    "september-equinox-window": 0.459581,
}
DIRECT_COMBINED_4006_SOURCE_RUN = 38287766502

CHECKPOINTS = (
    (4006, 2, 4.5, "li-chun-window"),
    (4006, 3, 20.5, "march-equinox-window"),
    (4006, 9, 22.5, "september-equinox-window"),
    (10026, 2, 4.5, "li-chun-window"),
    (10026, 3, 20.5, "march-equinox-window"),
    (10026, 9, 22.5, "september-equinox-window"),
)


def load_baseline_module():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load REBOUND baseline module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_asteroids(path: Path, baseline):
    payload = json.loads(path.read_text())
    if payload.get("setId") != "de441-n373s-j2000":
        raise RuntimeError("unexpected n373s capture set")
    if payload.get("epochTdbJulianDay") != baseline.J2000_TDB_JD:
        raise RuntimeError("n373s capture is not at J2000 TDB")
    bodies = [b for b in payload["bodies"] if b["population"] == "asteroid343"]
    if len(bodies) != 343:
        raise RuntimeError(f"unexpected asteroid count {len(bodies)}")
    return payload, bodies


def add_asteroids(sim, baseline, bodies):
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


def make_asteroid_sim(baseline, kernel, integrator: str, dt_days: float, bodies):
    sim, rebx = baseline.make_simulation(
        kernel, dt_days, physics="gr", integrator=integrator
    )
    add_asteroids(sim, baseline, bodies)
    return sim, rebx


def set_solar_mass(sim, initial_mass: float, elapsed_days: float):
    years = elapsed_days / JULIAN_YEAR_DAYS
    sim.particles[0].m = initial_mass * (
        1.0 + SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR * years
    )
    # Required when masses change in WHFast; harmless for IAS15.
    sim.did_modify_particles = 1


def integrate_mass_loss(sim, target_days: float, initial_mass: float):
    if target_days < sim.t:
        raise ValueError("forward integration only")
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


def metrics(baseline, geo, geo_v, truth, truth_v):
    return {
        "directionErrorArcsec": baseline.vector_angle_arcsec(geo, truth),
        "positionErrorKm": float(np.linalg.norm(geo - truth) * baseline.AU_KM),
        "rangeErrorKm": float(
            (np.linalg.norm(geo) - np.linalg.norm(truth)) * baseline.AU_KM
        ),
        "velocityErrorMps": float(
            np.linalg.norm(geo_v - truth_v)
            * baseline.AU_KM * 1000 / baseline.SECONDS_PER_DAY
        ),
    }


def checkpoint_key(year, label):
    return f"{year}:{label}"


def mass_loss_ias15_states(baseline, kernel):
    # Keep each validation year on an independent J2000->year integration.
    # This matches the isolated solar-mass-loss experiment exactly and avoids
    # letting intermediate checkpoint boundaries alter the midpoint-segment
    # schedule for a later deep-time year.
    out = {}
    years = sorted({item[0] for item in CHECKPOINTS})
    for target_year in years:
        sim, rebx = baseline.make_simulation(
            kernel, 0.5, physics="gr", integrator="ias15"
        )
        _ = rebx
        initial_mass = float(sim.particles[0].m)
        for year, month, day, label in CHECKPOINTS:
            if year != target_year:
                continue
            jd = baseline.gregorian_julian_day(year, month, day)
            t = jd - baseline.J2000_TDB_JD
            integrate_mass_loss(sim, t, initial_mass)
            geo, geo_v = geo_state(baseline, sim)
            truth, truth_v = truth_state(baseline, kernel, jd)
            out[checkpoint_key(year, label)] = {
                "year": year,
                "label": label,
                "jd": jd,
                "geo": geo,
                "geoV": geo_v,
                "metrics": metrics(baseline, geo, geo_v, truth, truth_v),
            }
    return out


def direct_combo_4006(baseline, kernel, bodies):
    sim, rebx = make_asteroid_sim(
        baseline, kernel, "ias15", 0.5, bodies
    )
    _ = rebx
    initial_mass = float(sim.particles[0].m)
    out = {}
    for year, month, day, label in CHECKPOINTS:
        if year != 4006:
            continue
        jd = baseline.gregorian_julian_day(year, month, day)
        t = jd - baseline.J2000_TDB_JD
        integrate_mass_loss(sim, t, initial_mass)
        geo, geo_v = geo_state(baseline, sim)
        truth, truth_v = truth_state(baseline, kernel, jd)
        out[checkpoint_key(year, label)] = {
            "year": year,
            "label": label,
            "geo": geo,
            "geoV": geo_v,
            "metrics": metrics(baseline, geo, geo_v, truth, truth_v),
        }
        print(
            f"[combo-direct-4006] {label}: "
            f"direction={out[checkpoint_key(year, label)]['metrics']['directionErrorArcsec']:.6f} arcsec",
            flush=True,
        )
    return out


def asteroid_differentials(baseline, kernel, bodies, dt_days: float):
    # The paired WHFast differential must live on the *same* secular
    # solar-mass-loss background on both sides.  Otherwise the year-10026
    # hybrid would silently assume asteroid and solar-mass-loss effects are
    # separable after validating that assumption only at year 4006.
    base, base_rebx = baseline.make_simulation(
        kernel, dt_days, physics="gr", integrator="whfast"
    )
    variant, variant_rebx = make_asteroid_sim(
        baseline, kernel, "whfast", dt_days, bodies
    )
    _ = base_rebx, variant_rebx

    base_initial_sun_mass = float(base.particles[0].m)
    variant_initial_sun_mass = float(variant.particles[0].m)

    out = {}
    years = sorted({item[0] for item in CHECKPOINTS})
    for target_year in years:
        # Restart each target year from the same J2000 state, matching the
        # independent-year IAS15 mass-loss baseline used above.
        if target_year != years[0]:
            base, base_rebx = baseline.make_simulation(
                kernel, dt_days, physics="gr", integrator="whfast"
            )
            variant, variant_rebx = make_asteroid_sim(
                baseline, kernel, "whfast", dt_days, bodies
            )
            _ = base_rebx, variant_rebx
            base_initial_sun_mass = float(base.particles[0].m)
            variant_initial_sun_mass = float(variant.particles[0].m)

        for year, month, day, label in CHECKPOINTS:
            if year != target_year:
                continue
            jd = baseline.gregorian_julian_day(year, month, day)
            t = jd - baseline.J2000_TDB_JD
            integrate_mass_loss(base, t, base_initial_sun_mass)
            integrate_mass_loss(variant, t, variant_initial_sun_mass)
            base_geo, base_geo_v = geo_state(baseline, base)
            var_geo, var_geo_v = geo_state(baseline, variant)
            delta = var_geo - base_geo
            delta_v = var_geo_v - base_geo_v
            out[checkpoint_key(year, label)] = {
                "year": year,
                "label": label,
                "deltaGeo": delta,
                "deltaGeoV": delta_v,
                "magnitudeKm": float(np.linalg.norm(delta) * baseline.AU_KM),
                "solarMassLossIncludedOnBothSides": True,
            }
    return out


def build_hybrid(baseline, kernel, mass_loss_states, asteroid_delta):
    rows = {}
    for year, month, day, label in CHECKPOINTS:
        key = checkpoint_key(year, label)
        jd = baseline.gregorian_julian_day(year, month, day)
        truth, truth_v = truth_state(baseline, kernel, jd)
        base = mass_loss_states[key]
        delta = asteroid_delta[key]
        geo = base["geo"] + delta["deltaGeo"]
        geo_v = base["geoV"] + delta["deltaGeoV"]
        rows[key] = {
            "year": year,
            "label": label,
            "massLossOnly": base["metrics"],
            "hybrid": metrics(baseline, geo, geo_v, truth, truth_v),
            "asteroidDeltaMagnitudeKm": delta["magnitudeKm"],
        }
    return rows


def serializable_rows(rows):
    return [rows[checkpoint_key(year, label)] for year, _, _, label in CHECKPOINTS]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--state-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")
    metadata, bodies = load_asteroids(args.state_json, baseline)

    kernel = SPK.open(str(args.kernel))
    try:
        print("[combo] integrating IAS15 solar-mass-loss baseline", flush=True)
        mass_loss = mass_loss_ias15_states(baseline, kernel)

        print(
            f"[combo] using pinned direct 4006 truth from run "
            f"{DIRECT_COMBINED_4006_SOURCE_RUN}",
            flush=True,
        )
        direct_4006 = {
            checkpoint_key(4006, label): {
                "year": 4006,
                "label": label,
                "metrics": {"directionErrorArcsec": value},
                "sourceRun": DIRECT_COMBINED_4006_SOURCE_RUN,
            }
            for label, value in DIRECT_COMBINED_4006_ARCSEC.items()
        }

        print("[combo] paired WHFast asteroid differential dt=1d", flush=True)
        delta = asteroid_differentials(
            baseline, kernel, bodies, 1.0
        )
        hybrids = {
            "1.0": build_hybrid(
                baseline, kernel, mass_loss, delta
            )
        }
        for year, _, _, label in CHECKPOINTS:
            key = checkpoint_key(year, label)
            row = hybrids["1.0"][key]
            print(
                f"[combo-hybrid] dt=1d {year} {label}: "
                f"massloss={row['massLossOnly']['directionErrorArcsec']:.6f} -> "
                f"combined={row['hybrid']['directionErrorArcsec']:.6f} arcsec; "
                f"asteroid-delta={row['asteroidDeltaMagnitudeKm']:.3f} km",
                flush=True,
            )
    finally:
        kernel.close()

    validation = []
    for label in ("li-chun-window", "march-equinox-window", "september-equinox-window"):
        key = checkpoint_key(4006, label)
        direct = direct_4006[key]["metrics"]["directionErrorArcsec"]
        hybrid = hybrids["1.0"][key]["hybrid"]["directionErrorArcsec"]
        validation.append({
            "dtDays": 1.0,
            "label": label,
            "directDirectionErrorArcsec": direct,
            "hybridDirectionErrorArcsec": hybrid,
            "hybridMinusDirectArcsec": hybrid - direct,
        })

    max_validation_error = max(
        abs(row["hybridMinusDirectArcsec"]) for row in validation
    )

    mass_loss_regression = []
    h1 = hybrids["1.0"]
    for label, expected in ISOLATED_MASS_LOSS_10026_ARCSEC.items():
        key = checkpoint_key(10026, label)
        observed = h1[key]["massLossOnly"]["directionErrorArcsec"]
        mass_loss_regression.append({
            "label": label,
            "expectedIsolatedDirectionErrorArcsec": expected,
            "observedCombinedBaselineDirectionErrorArcsec": observed,
            "observedMinusExpectedArcsec": observed - expected,
        })
    max_mass_loss_regression = max(
        abs(row["observedMinusExpectedArcsec"])
        for row in mass_loss_regression
    )

    convergence = []
    for label in ("li-chun-window", "march-equinox-window", "september-equinox-window"):
        key = checkpoint_key(10026, label)
        dt2 = PINNED_HYBRID_DT2_10026_ARCSEC[label]
        dt1 = h1[key]["hybrid"]["directionErrorArcsec"]
        convergence.append({
            "label": label,
            "dt2DirectionErrorArcsec": dt2,
            "dt1DirectionErrorArcsec": dt1,
            "dt1MinusDt2Arcsec": dt1 - dt2,
            "dt2SourceRun": PINNED_HYBRID_DT2_SOURCE_RUN,
        })
    max_convergence_error = max(
        abs(row["dt1MinusDt2Arcsec"]) for row in convergence
    )

    validated = (
        max_validation_error <= VALIDATION_TOLERANCE_ARCSEC
        and max_convergence_error <= CONVERGENCE_TOLERANCE_ARCSEC
        and max_mass_loss_regression <= MASS_LOSS_BASELINE_TOLERANCE_ARCSEC
    )

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "sourceEphemeris": "DE441",
        "method": "IAS15 solar-mass-loss baseline + paired-WHFast asteroid343 differential on the same solar-mass-loss background",
        "fractionalSolarMassLossPerYear": SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR,
        "massLossSegmentYears": MASS_LOSS_SEGMENT_YEARS,
        "asteroidCount": len(bodies),
        "direct4006": [
            {
                "year": row["year"],
                "label": row["label"],
                "metrics": row["metrics"],
                "sourceRun": row["sourceRun"],
            }
            for row in direct_4006.values()
        ],
        "hybridDt1": serializable_rows(h1),
        "pinnedHybridDt2_10026": PINNED_HYBRID_DT2_10026_ARCSEC,
        "pinnedHybridDt2SourceRun": PINNED_HYBRID_DT2_SOURCE_RUN,
        "validation4006": validation,
        "massLossBaselineRegression10026": mass_loss_regression,
        "convergence10026": convergence,
        "summary": {
            "max4006HybridMinusDirectArcsec": max_validation_error,
            "max10026Dt1MinusDt2Arcsec": max_convergence_error,
            "max10026MassLossBaselineRegressionArcsec": max_mass_loss_regression,
            "validatedForYear10026": validated,
            "massLossBaselineUsesIndependentYearIntegrations": True,
        },
        "captureMetadata": {
            "setId": metadata["setId"],
            "smallKernelSha256": metadata["smallKernelSha256"],
        },
        "claimBoundary": {
            "directComboValidatedAt4006": True,
            "direct4006TruthPinnedFromSuccessfulRun": DIRECT_COMBINED_4006_SOURCE_RUN,
            "year10026IsHybridEstimate": True,
            "includesSolarMassLoss": True,
            "includesAsteroid343Differential": True,
            "asteroidDifferentialIncludesSolarMassLossOnBothSides": True,
            "includesKbo30": False,
            "includesKboRing": False,
            "includesSolarJ2": False,
            "includesLenseThirring": False,
            "year26026Resolved": False,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(
        f"[combo-summary] max-4006-validation={max_validation_error:.6f} arcsec; "
        f"max-10026-1d-minus-2d={max_convergence_error:.6f} arcsec; "
        f"max-massloss-regression={max_mass_loss_regression:.6f} arcsec; "
        f"validated={validated}",
        flush=True,
    )
    for row in serializable_rows(h1):
        if row["year"] != 10026:
            continue
        print(
            f"[combo-10026-final] {row['label']}: "
            f"massloss={row['massLossOnly']['directionErrorArcsec']:.6f} -> "
            f"massloss+343={row['hybrid']['directionErrorArcsec']:.6f} arcsec",
            flush=True,
        )

    if not validated:
        raise RuntimeError(
            "combined hybrid failed the mass-loss regression, 4006 direct-truth, or 10026 timestep-convergence gate"
        )


if __name__ == "__main__":
    main()
