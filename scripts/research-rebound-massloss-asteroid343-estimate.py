#!/usr/bin/env python3
"""Research-only additive estimate: solar mass loss + asteroid343 at year 10026.

This deliberately avoids the rejected WHFast+time-varying-mass path.

- The secular solar-mass-loss state is recomputed directly with IAS15 + GR.
- The asteroid343 vector differential is pinned from the converged #561
  no-mass-loss artifact (4-day and 2-day WHFast paired differentials).
- Full asteroid343 additivity was directly validated at year 4006.
- Year-10026 interaction is directly tested with N16 as an asteroid proxy.

The output is a validated research estimate, not an ephemeris authority and not
a direct IAS15+343 year-10026 integration.
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
DEFAULT_FIXTURE = ROOT / "tests" / "fixtures" / "rebound-asteroid343-differential-10026.json"

JULIAN_YEAR_DAYS = 365.25
SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR = -9.0e-14
MASS_LOSS_SEGMENT_YEARS = 10.0
TARGET_YEAR = 10026

MASS_LOSS_10Y_REFERENCE = {
    "li-chun-window": 0.9003296313530997,
    "march-equinox-window": 1.024500200585229,
    "september-equinox-window": 0.969461565570375,
}

CHECKPOINTS = (
    (2, 4.5, "li-chun-window"),
    (3, 20.5, "march-equinox-window"),
    (9, 22.5, "september-equinox-window"),
)

MAX_MASS_LOSS_REGRESSION_ARCSEC = 0.002
MAX_FINAL_DT4_DT2_ARCSEC = 0.005
MAX_DIRECT_4006_EVIDENCE_ARCSEC = 0.001
MAX_N16_ADDITIVE_EVIDENCE_ARCSEC = 0.002


def load_baseline_module():
    spec = importlib.util.spec_from_file_location("rebound_baseline", BASELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load REBOUND baseline module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def set_solar_mass(sim, initial_mass: float, elapsed_days: float):
    years = elapsed_days / JULIAN_YEAR_DAYS
    sim.particles[0].m = initial_mass * (
        1.0 + SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR * years
    )


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
    return sp - ep


def truth_state(baseline, kernel, jd):
    ep, _ = baseline.state_from_route(kernel, jd, ((0, 3), (3, 399)))
    sp, _ = baseline.state_from_route(kernel, jd, ((0, 10),))
    return sp - ep


def metrics(baseline, model_geo, truth_geo):
    return {
        "directionErrorArcsec": baseline.vector_angle_arcsec(model_geo, truth_geo),
        "positionErrorKm": float(np.linalg.norm(model_geo - truth_geo) * baseline.AU_KM),
        "rangeErrorKm": float(
            (np.linalg.norm(model_geo) - np.linalg.norm(truth_geo)) * baseline.AU_KM
        ),
    }


def load_fixture(path: Path):
    fixture = json.loads(path.read_text())
    if fixture.get("year") != TARGET_YEAR:
        raise RuntimeError("asteroid differential fixture has unexpected year")
    if fixture.get("asteroidCount") != 343:
        raise RuntimeError("asteroid differential fixture must contain asteroid343 evidence")
    if fixture["claimBoundary"]["productionAuthorityGranted"] is not False:
        raise RuntimeError("research fixture must not grant production authority")
    rows = {row["label"]: row for row in fixture["rows"]}
    if set(rows) != {item[2] for item in CHECKPOINTS}:
        raise RuntimeError("fixture checkpoint labels do not match estimator")
    return fixture, rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    baseline = load_baseline_module()
    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")

    fixture, asteroid_rows = load_fixture(args.fixture)
    evidence = fixture["validation"]

    if evidence["direct4006MaxHybridMinusDirectArcsec"] > MAX_DIRECT_4006_EVIDENCE_ARCSEC:
        raise RuntimeError("full-asteroid additive validation at year 4006 is too weak")
    if evidence["n16MaxAdditiveMinusDirectDirectionErrorArcsec"] > MAX_N16_ADDITIVE_EVIDENCE_ARCSEC:
        raise RuntimeError("N16 year-10026 additive interaction evidence is too weak")

    kernel = SPK.open(str(args.kernel))
    try:
        sim, rebx = baseline.make_simulation(
            kernel, 0.5, physics="gr", integrator="ias15"
        )
        _ = rebx
        initial_mass = float(sim.particles[0].m)

        rows = []
        for month, day, label in CHECKPOINTS:
            jd = baseline.gregorian_julian_day(TARGET_YEAR, month, day)
            target_days = jd - baseline.J2000_TDB_JD
            integrate_mass_loss(sim, target_days, initial_mass)
            mass_geo = geo_state(baseline, sim)
            truth_geo = truth_state(baseline, kernel, jd)

            mass_metrics = metrics(baseline, mass_geo, truth_geo)
            expected_mass = MASS_LOSS_10Y_REFERENCE[label]
            mass_regression = mass_metrics["directionErrorArcsec"] - expected_mass

            source = asteroid_rows[label]
            estimates = {}
            for tag in ("dt4", "dt2"):
                delta = np.asarray(source[tag]["deltaVectorAu"], dtype=np.float64)
                combined_geo = mass_geo + delta
                estimates[tag] = {
                    **metrics(baseline, combined_geo, truth_geo),
                    "asteroidDeltaMagnitudeKm": source[tag]["deltaMagnitudeKm"],
                }

            final_convergence = (
                estimates["dt2"]["directionErrorArcsec"]
                - estimates["dt4"]["directionErrorArcsec"]
            )

            row = {
                "year": TARGET_YEAR,
                "label": label,
                "massLossOnly": mass_metrics,
                "massLossReferenceArcsec": expected_mass,
                "massLossRegressionArcsec": mass_regression,
                "combinedDt4": estimates["dt4"],
                "combinedDt2": estimates["dt2"],
                "combinedDt2MinusDt4Arcsec": final_convergence,
                "sourceNoMassLossDt2MinusDt4Arcsec": source[
                    "dt2MinusDt4NoMassLossHybridArcsec"
                ],
            }
            rows.append(row)

            print(
                f"[massloss+343-estimate] {label}: "
                f"massloss={mass_metrics['directionErrorArcsec']:.6f} -> "
                f"dt4={estimates['dt4']['directionErrorArcsec']:.6f} -> "
                f"dt2={estimates['dt2']['directionErrorArcsec']:.6f} arcsec; "
                f"dt2-dt4={final_convergence:.6f}",
                flush=True,
            )
    finally:
        kernel.close()

    max_mass_regression = max(abs(row["massLossRegressionArcsec"]) for row in rows)
    max_final_convergence = max(
        abs(row["combinedDt2MinusDt4Arcsec"]) for row in rows
    )
    accepted = (
        max_mass_regression <= MAX_MASS_LOSS_REGRESSION_ARCSEC
        and max_final_convergence <= MAX_FINAL_DT4_DT2_ARCSEC
        and evidence["direct4006MaxHybridMinusDirectArcsec"]
        <= MAX_DIRECT_4006_EVIDENCE_ARCSEC
        and evidence["n16MaxAdditiveMinusDirectDirectionErrorArcsec"]
        <= MAX_N16_ADDITIVE_EVIDENCE_ARCSEC
    )

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "sourceEphemeris": "DE441",
        "method": "IAS15 solar-mass-loss state plus pinned converged no-mass-loss asteroid343 vector differential",
        "year": TARGET_YEAR,
        "fractionalSolarMassLossPerYear": SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR,
        "massLossSegmentYears": MASS_LOSS_SEGMENT_YEARS,
        "rows": rows,
        "validationEvidence": evidence,
        "asteroidDifferentialSource": fixture["source"],
        "summary": {
            "maxMassLossRegressionArcsec": max_mass_regression,
            "maxCombinedDt2MinusDt4Arcsec": max_final_convergence,
            "maxN16InteractionAngularSeparationArcsec": evidence[
                "n16MaxInteractionAngularSeparationArcsec"
            ],
            "maxN16AdditiveMinusDirectArcsec": evidence[
                "n16MaxAdditiveMinusDirectDirectionErrorArcsec"
            ],
            "acceptedAsResearchEstimate": accepted,
        },
        "claimBoundary": {
            "year10026IsResearchEstimate": True,
            "full343MassLossInteractionDirectlyValidatedAt10026": False,
            "full343AdditivityDirectlyValidatedAt4006": True,
            "n16AdditivityDirectlyValidatedAt10026": True,
            "n16InteractionIsProxyNotFormal343Bound": True,
            "usesPinnedAsteroid343ArtifactVectors": True,
            "productionAuthorityGranted": False,
            "year26026Resolved": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(
        f"[massloss+343-summary] accepted={accepted}; "
        f"max-massloss-regression={max_mass_regression:.6f}; "
        f"max-dt2-dt4={max_final_convergence:.6f}; "
        f"N16-interaction-proxy={evidence['n16MaxInteractionAngularSeparationArcsec']:.6f} arcsec",
        flush=True,
    )

    if not accepted:
        raise RuntimeError("mass-loss + asteroid343 research estimate failed evidence gates")


if __name__ == "__main__":
    main()
