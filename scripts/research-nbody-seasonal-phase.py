#!/usr/bin/env python3
"""Research-only N-body calibration for the missing common seasonal phase.

This experiment asks a deliberately narrow question:

Can a reproducible Solar-System integration, initialized from JPL Horizons at
J2000, preserve enough absolute orbital phase that Berger's already-validated
moving-equinox perihelion geometry lands on the repository's DE441 seasonal
crossings at years 4006 and 10026?

The script does NOT produce a year-26026 claim.  It first measures:
  * 4006 residuals against reviewed 24-crossing DE441 truth;
  * 10026 residuals against the pinned DE441-derived 24-crossing Research asset;
  * 4-day vs 2-day WHFast convergence;
  * integration energy drift.

Only if those checks are scientifically useful should a later experiment
extend the same method beyond absolute DE441 coverage.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
from pathlib import Path

import rebound

J2000_JD = 2_451_545.0
TAU = math.tau
SECONDS_PER_DAY = 86_400.0
HORIZONS_EPOCH = "JD2451545.0"
BODY_IDS = ("10", "1", "2", "3", "4", "5", "6", "7", "8", "9")
SUN_INDEX = 0
EMB_INDEX = 3

TERM_NAMES = (
    "春分", "清明", "穀雨", "立夏", "小滿", "芒種",
    "夏至", "小暑", "大暑", "立秋", "處暑", "白露",
    "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
    "冬至", "小寒", "大寒", "立春", "雨水", "驚蟄",
)


def freeze_json(value):
    return json.loads(json.dumps(value, sort_keys=True))


def vec_sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def vec_scale(a, scalar):
    return tuple(x * scalar for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def norm(a):
    return math.sqrt(dot(a, a))


def unit(a):
    length = norm(a)
    if length == 0:
        raise ZeroDivisionError("zero-length vector")
    return tuple(x / length for x in a)


def normalize_radians(value):
    return value % TAU


def signed_radians(value):
    return (value + math.pi) % TAU - math.pi


def parse_berger_coefficients(source_path: Path):
    text = source_path.read_text(encoding="utf-8")

    def parse_array(name):
        match = re.search(
            rf"const {name} = Object\.freeze\((\[[\s\S]*?\])\);",
            text,
        )
        if not match:
            raise RuntimeError(f"could not parse {name} from {source_path}")
        return json.loads(match.group(1))

    return parse_array("ECCENTRICITY_TERMS"), parse_array("PRECESSION_TERMS")


def berger_perihelion_longitude_radians(year, eccentricity_terms, precession_terms):
    degree = math.pi / 180.0
    t = year - 1950.0

    e_sin_pi = 0.0
    e_cos_pi = 0.0
    for amplitude, frequency_arcsec_per_year, phase_degrees in eccentricity_terms:
        argument = (
            t * frequency_arcsec_per_year / 3600.0 + phase_degrees
        ) * degree
        e_sin_pi += amplitude * math.sin(argument)
        e_cos_pi += amplitude * math.cos(argument)
    pie = math.atan2(e_sin_pi, e_cos_pi)

    periodic_precession_arcsec = 0.0
    for amplitude_arcsec, frequency_arcsec_per_year, phase_degrees in precession_terms:
        argument = (
            t * frequency_arcsec_per_year / 3600.0 + phase_degrees
        ) * degree
        periodic_precession_arcsec += amplitude_arcsec * math.sin(argument)

    psi = (
        3.392506
        + (t * 50.439273 + periodic_precession_arcsec) / 3600.0
    ) * degree
    return normalize_radians(pie + psi + math.pi)


def parse_4006_events(source_path: Path):
    text = source_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r'\{ name:"([^"]+)", longitudeDegrees:(\d+), '
        r'shouXingTtJulianDay:[^,]+, '
        r'jplDe441TtJulianDay:([0-9.]+)'
    )
    events = [
        {
            "catalogueYear": 4006,
            "name": name,
            "longitudeDegrees": int(longitude),
            "ttJulianDay": float(julian_day),
            "claimClass": "reviewed-de441-independent-truth",
        }
        for name, longitude, julian_day in pattern.findall(text)
    ]
    if len(events) != 24:
        raise RuntimeError(f"expected 24 year-4006 crossings, got {len(events)}")
    return sorted(events, key=lambda event: event["ttJulianDay"])


def parse_10026_events(binary_path: Path):
    payload = binary_path.read_bytes()
    if len(payload) != 224:
        raise RuntimeError(f"unexpected 10026 payload length {len(payload)}")
    if payload[:8] != b"BTADE441":
        raise RuntimeError("10026 seasonal chunk magic mismatch")
    schema_version, events_per_year = struct.unpack_from("<HH", payload, 8)
    min_year = struct.unpack_from("<i", payload, 12)[0]
    year_count = struct.unpack_from("<I", payload, 16)[0]
    longitude_step = struct.unpack_from("<H", payload, 20)[0]
    header_bytes = struct.unpack_from("<I", payload, 24)[0]
    if (
        schema_version != 1
        or events_per_year != 24
        or min_year != 10026
        or year_count != 1
        or longitude_step != 15
        or header_bytes != 32
    ):
        raise RuntimeError("10026 seasonal chunk header mismatch")

    epochs = struct.unpack_from("<24d", payload, 32)
    events = []
    for index, tt_julian_day in enumerate(epochs):
        events.append({
            "catalogueYear": 10026,
            "name": TERM_NAMES[index],
            "longitudeDegrees": index * 15,
            "ttJulianDay": tt_julian_day,
            "claimClass": "de441-derived-research-evidence",
        })
    return sorted(events, key=lambda event: event["ttJulianDay"])


def initial_state_digest(simulation):
    rows = []
    for index, particle in enumerate(simulation.particles):
        rows.append({
            "index": index,
            "name": str(particle.name),
            "m": particle.m,
            "x": particle.x,
            "y": particle.y,
            "z": particle.z,
            "vx": particle.vx,
            "vy": particle.vy,
            "vz": particle.vz,
        })
    encoded = json.dumps(rows, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return rows, hashlib.sha256(encoded).hexdigest()


def make_base_simulation():
    rebound.horizons.INITDATE = None
    simulation = rebound.Simulation()
    simulation.units = ("AU", "day", "Msun")

    for body_id in BODY_IDS:
        simulation.add(body_id, date=HORIZONS_EPOCH, plane="ecliptic")

    if simulation.N != len(BODY_IDS):
        raise RuntimeError(f"expected {len(BODY_IDS)} bodies, got {simulation.N}")

    simulation.move_to_com()
    rows, digest = initial_state_digest(simulation)
    return simulation, rows, digest


def osculating_true_anomaly_and_rate(simulation):
    sun = simulation.particles[SUN_INDEX]
    earth = simulation.particles[EMB_INDEX]

    r = (
        earth.x - sun.x,
        earth.y - sun.y,
        earth.z - sun.z,
    )
    v = (
        earth.vx - sun.vx,
        earth.vy - sun.vy,
        earth.vz - sun.vz,
    )

    r_norm = norm(r)
    h = cross(r, v)
    h_norm = norm(h)
    mu = simulation.G * (sun.m + earth.m)
    eccentricity_vector = vec_sub(
        vec_scale(cross(v, h), 1.0 / mu),
        vec_scale(r, 1.0 / r_norm),
    )
    eccentricity = norm(eccentricity_vector)
    e_hat = unit(eccentricity_vector)
    r_hat = unit(r)
    h_hat = unit(h)

    cosine = max(-1.0, min(1.0, dot(e_hat, r_hat)))
    sine = dot(h_hat, cross(e_hat, r_hat))
    true_anomaly = normalize_radians(math.atan2(sine, cosine))
    angular_rate_radians_per_day = h_norm / (r_norm * r_norm)
    return true_anomaly, angular_rate_radians_per_day, eccentricity


def evaluate_event(
    simulation,
    event,
    eccentricity_terms,
    precession_terms,
):
    target_time_days = event["ttJulianDay"] - J2000_JD
    if target_time_days < simulation.t:
        raise RuntimeError("events must be evaluated in chronological order")

    simulation.integrate(target_time_days, exact_finish_time=1)

    actual_true_anomaly, angular_rate, osculating_eccentricity = (
        osculating_true_anomaly_and_rate(simulation)
    )
    pibar = berger_perihelion_longitude_radians(
        event["catalogueYear"],
        eccentricity_terms,
        precession_terms,
    )
    expected_true_anomaly = normalize_radians(
        math.radians(event["longitudeDegrees"]) - pibar
    )
    angular_residual = signed_radians(
        actual_true_anomaly - expected_true_anomaly
    )

    # Positive angular residual means the integrated orbit is already ahead at
    # the DE441 event epoch, so its predicted crossing happened earlier.
    predicted_minus_truth_days = -angular_residual / angular_rate

    return {
        **event,
        "simulationTimeDaysFromJ2000": simulation.t,
        "actualTrueAnomalyDegrees": math.degrees(actual_true_anomaly),
        "expectedTrueAnomalyDegrees": math.degrees(expected_true_anomaly),
        "angularResidualDegrees": math.degrees(angular_residual),
        "predictedMinusTruthHours": predicted_minus_truth_days * 24.0,
        "osculatingEccentricity": osculating_eccentricity,
        "angularRateDegreesPerDay": math.degrees(angular_rate),
    }


def summarize(events):
    residuals = [event["predictedMinusTruthHours"] for event in events]
    mean = sum(residuals) / len(residuals)
    rms = math.sqrt(sum(value * value for value in residuals) / len(residuals))
    rms_centered = math.sqrt(
        sum((value - mean) ** 2 for value in residuals) / len(residuals)
    )
    return {
        "count": len(residuals),
        "meanHours": mean,
        "minHours": min(residuals),
        "maxHours": max(residuals),
        "maxAbsHours": max(abs(value) for value in residuals),
        "rmsHours": rms,
        "centeredRmsHours": rms_centered,
        "spreadHours": max(residuals) - min(residuals),
    }


def run_variant(base_simulation, step_days, all_events, eccentricity_terms, precession_terms):
    simulation = base_simulation.copy()
    simulation.integrator = "whfast"
    simulation.dt = step_days
    simulation.ri_whfast.safe_mode = 0
    simulation.ri_whfast.corrector = 11

    initial_energy = simulation.energy()
    evaluated = []
    for event in all_events:
        evaluated.append(
            evaluate_event(
                simulation,
                event,
                eccentricity_terms,
                precession_terms,
            )
        )
    final_energy = simulation.energy()

    by_year = {}
    for year in (4006, 10026):
        rows = [event for event in evaluated if event["catalogueYear"] == year]
        by_year[str(year)] = {
            "summary": summarize(rows),
            "events": rows,
        }

    return {
        "integrator": "WHFast",
        "stepDays": step_days,
        "safeMode": False,
        "corrector": 11,
        "initialEnergy": initial_energy,
        "finalEnergy": final_energy,
        "relativeEnergyDrift": (
            (final_energy - initial_energy) / initial_energy
            if initial_energy != 0
            else None
        ),
        "years": by_year,
    }


def convergence_summary(coarse, fine):
    output = {}
    for year in ("4006", "10026"):
        coarse_events = {
            event["longitudeDegrees"]: event
            for event in coarse["years"][year]["events"]
        }
        fine_events = {
            event["longitudeDegrees"]: event
            for event in fine["years"][year]["events"]
        }
        differences = []
        for longitude in range(0, 360, 15):
            differences.append(
                coarse_events[longitude]["predictedMinusTruthHours"]
                - fine_events[longitude]["predictedMinusTruthHours"]
            )
        output[year] = {
            "maxAbsHours": max(abs(value) for value in differences),
            "rmsHours": math.sqrt(
                sum(value * value for value in differences) / len(differences)
            ),
            "spreadHours": max(differences) - min(differences),
        }
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--steps",
        default="4,2",
        help="comma-separated WHFast steps in days; final entry is treated as fine",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    eccentricity_terms, precession_terms = parse_berger_coefficients(
        root / "src/recurrence/berger-orbit.js"
    )
    events_4006 = parse_4006_events(
        root / "src/recurrence/direct-seasonal-provider-validation-evidence.js"
    )
    events_10026 = parse_10026_events(
        root / "assets/research/de441-seasonal/10026.bin"
    )
    all_events = sorted(
        [*events_4006, *events_10026],
        key=lambda event: event["ttJulianDay"],
    )

    base_simulation, initial_states, initial_state_sha256 = make_base_simulation()
    steps = [float(item) for item in args.steps.split(",") if item.strip()]
    if len(steps) < 2:
        raise RuntimeError("at least two integration steps are required")

    variants = [
        run_variant(
            base_simulation,
            step_days,
            all_events,
            eccentricity_terms,
            precession_terms,
        )
        for step_days in steps
    ]
    coarse = variants[-2]
    fine = variants[-1]
    convergence = convergence_summary(coarse, fine)

    result = {
        "schemaVersion": 1,
        "experimentId": "research-nbody-seasonal-phase-v1",
        "claimBoundary": {
            "researchOnly": True,
            "absoluteSeasonalEpochPromoted": False,
            "year26026Evaluated": False,
            "civilTimeResolved": False,
            "productionAuthorityGranted": False,
        },
        "initialization": {
            "authority": "NASA/JPL Horizons",
            "epoch": HORIZONS_EPOCH,
            "referencePlane": "ecliptic J2000",
            "referenceCenter": "Solar System barycenter",
            "vectorCorrections": "NONE",
            "bodyIds": list(BODY_IDS),
            "earthProxy": "Earth-Moon barycenter (3)",
            "initialStateSha256": initial_state_sha256,
            "states": initial_states,
        },
        "dynamics": {
            "package": "rebound",
            "version": rebound.__version__,
            "gravity": "Newtonian point masses",
            "relativity": False,
            "majorAsteroids": False,
            "earthMoonResolvedSeparately": False,
        },
        "seasonFrame": {
            "shapeAndPrecessionModel": "Berger 1978 coefficients from repository",
            "comparison": (
                "N-body osculating true anomaly versus "
                "solar-longitude minus Berger moving-equinox perihelion longitude"
            ),
        },
        "evidence": {
            "year4006": "reviewed JPL DE441 24-crossing truth",
            "year10026": "pinned DE441-derived 24-crossing Research asset",
        },
        "variants": variants,
        "convergence": convergence,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(freeze_json(result), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(json.dumps({
        "reboundVersion": rebound.__version__,
        "initialStateSha256": initial_state_sha256,
        "variants": [
            {
                "stepDays": variant["stepDays"],
                "energyDrift": variant["relativeEnergyDrift"],
                "year4006": variant["years"]["4006"]["summary"],
                "year10026": variant["years"]["10026"]["summary"],
            }
            for variant in variants
        ],
        "convergence": convergence,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
