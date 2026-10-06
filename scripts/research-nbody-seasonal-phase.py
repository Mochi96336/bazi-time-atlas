#!/usr/bin/env python3
"""Research-only N-body calibration for the missing common seasonal phase.

This experiment asks a deliberately narrow question:

Can a reproducible Solar-System integration, initialized from JPL Horizons at
J2000, preserve enough absolute orbital phase that its geocentric apparent Sun
direction, transformed through the repository's already-validated Owen/Horizons
mean-ecliptic-of-date frame path, lands on the DE441 seasonal crossings at
years 4006 and 10026?

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
SPEED_OF_LIGHT_AU_PER_DAY = 173.1446326846693
SOLAR_SCHWARZSCHILD_RADIUS_AU = 1.97412574336e-8
PINNED_IERS_DPSI_ARCSEC = -0.113478
PINNED_IERS_DEPS_ARCSEC = -0.006944
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
        simulation.add(body_id, date=HORIZONS_EPOCH, plane="frame")

    if simulation.N != len(BODY_IDS):
        raise RuntimeError(f"expected {len(BODY_IDS)} bodies, got {simulation.N}")

    simulation.move_to_com()
    rows, digest = initial_state_digest(simulation)
    return simulation, rows, digest


def geocentric_sun_apparent_icrf_and_rate(simulation):
    sun = simulation.particles[SUN_INDEX]
    earth = simulation.particles[EMB_INDEX]

    earth_position = (earth.x, earth.y, earth.z)
    earth_velocity = (earth.vx, earth.vy, earth.vz)
    sun_position = (sun.x, sun.y, sun.z)
    sun_velocity = (sun.vx, sun.vy, sun.vz)

    relative_position = vec_sub(sun_position, earth_position)
    relative_velocity = vec_sub(sun_velocity, earth_velocity)
    distance = norm(relative_position)
    if not (distance > 0):
        raise RuntimeError("Sun and EMB positions must be distinct")

    # Match the repository's absolute-state seasonal solver at the precision
    # relevant here: reception-time Earth, three fixed-point light-time
    # iterations, then SOFA-compatible stellar aberration. The Sun-center
    # gravitational-deflection stage is an evidence-bounded identity in the
    # repository; the small solar-potential term below is the one retained by
    # SOFA eraAb itself.
    emission_position = sun_position
    light_time_days = 0.0
    for _ in range(3):
        light_time_days = norm(vec_sub(emission_position, earth_position)) / SPEED_OF_LIGHT_AU_PER_DAY
        emission_position = tuple(
            sun_position[index] - sun_velocity[index] * light_time_days
            for index in range(3)
        )

    natural = unit(vec_sub(emission_position, earth_position))
    beta = vec_scale(earth_velocity, 1.0 / SPEED_OF_LIGHT_AU_PER_DAY)
    beta2 = dot(beta, beta)
    if not (beta2 < 1):
        raise RuntimeError("observer velocity must be subluminal")
    bm1 = math.sqrt(1.0 - beta2)
    pdv = dot(natural, beta)
    w1 = 1.0 + pdv / (1.0 + bm1)
    w2 = SOLAR_SCHWARZSCHILD_RADIUS_AU / distance
    apparent = unit(tuple(
        natural[index] * bm1
        + w1 * beta[index]
        + w2 * (beta[index] - pdv * natural[index])
        for index in range(3)
    ))

    # A local timing conversion only: relative angular speed of the
    # Sun-Earth line. Frame precession/nutation rates are tiny on the one-day
    # scale and do not materially affect this conversion.
    h = cross(relative_position, relative_velocity)
    angular_rate_radians_per_day = norm(h) / (distance * distance)
    return apparent, angular_rate_radians_per_day, light_time_days


def vector_to_ra_dec(direction):
    x, y, z = unit(direction)
    return (
        math.degrees(math.atan2(y, x)) % 360.0,
        math.degrees(math.asin(z)),
    )


def frame_longitude_of_date(frame_probe, tt_julian_day, direction_icrf):
    ra_degrees, dec_degrees = vector_to_ra_dec(direction_icrf)
    import subprocess

    run = subprocess.run(
        [
            str(frame_probe),
            "apparent",
            str(tt_julian_day),
            str(ra_degrees),
            str(dec_degrees),
            str(PINNED_IERS_DPSI_ARCSEC),
            str(PINNED_IERS_DEPS_ARCSEC),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if run.returncode != 0:
        raise RuntimeError(
            f"Owen frame probe failed at TT JD {tt_julian_day}: {run.stderr.strip()}"
        )
    values = [float(value) for value in run.stdout.strip().split()]
    if len(values) != 3 or any(not math.isfinite(value) for value in values):
        raise RuntimeError(f"malformed Owen frame probe output: {run.stdout!r}")
    return {
        "longitudeDegrees": values[0],
        "latitudeDegrees": values[1],
        "meanObliquityDegrees": values[2],
    }


def evaluate_event(simulation, event, frame_probe):
    target_time_days = event["ttJulianDay"] - J2000_JD
    if target_time_days < simulation.t:
        raise RuntimeError("events must be evaluated in chronological order")

    simulation.integrate(target_time_days, exact_finish_time=1)

    apparent_icrf, angular_rate, light_time_days = (
        geocentric_sun_apparent_icrf_and_rate(simulation)
    )
    framed = frame_longitude_of_date(
        frame_probe,
        event["ttJulianDay"],
        apparent_icrf,
    )
    angular_residual = signed_radians(
        math.radians(framed["longitudeDegrees"] - event["longitudeDegrees"])
    )

    # Positive longitude residual means the integrated model is already ahead
    # at the DE441 event epoch, so its predicted crossing happened earlier.
    predicted_minus_truth_days = -angular_residual / angular_rate

    return {
        **event,
        "simulationTimeDaysFromJ2000": simulation.t,
        "predictedLongitudeDegrees": framed["longitudeDegrees"],
        "predictedLatitudeDegrees": framed["latitudeDegrees"],
        "meanObliquityDegrees": framed["meanObliquityDegrees"],
        "longitudeResidualDegrees": math.degrees(angular_residual),
        "predictedMinusTruthHours": predicted_minus_truth_days * 24.0,
        "angularRateDegreesPerDay": math.degrees(angular_rate),
        "lightTimeSeconds": light_time_days * SECONDS_PER_DAY,
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


def run_variant(base_simulation, step_days, all_events, frame_probe):
    simulation = base_simulation.copy()
    simulation.integrator = "whfast"
    simulation.dt = step_days
    simulation.integrator.safe_mode = False
    simulation.integrator.corrector = 11

    initial_energy = simulation.energy()
    evaluated = []
    for event in all_events:
        evaluated.append(
            evaluate_event(
                simulation,
                event,
                frame_probe,
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
    parser.add_argument("--frame-probe", required=True, type=Path)
    parser.add_argument(
        "--steps",
        default="4,2",
        help="comma-separated WHFast steps in days; final entry is treated as fine",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    if not args.frame_probe.is_file():
        raise FileNotFoundError(args.frame_probe)
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
            args.frame_probe,
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
            "referencePlane": "ICRF / J2000 equatorial frame",
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
            "frameModel": "pinned Swiss Owen/JPLHOR mean-ecliptic-of-date proof path",
            "frameProbe": str(args.frame_probe),
            "eopTerminalDPsiArcsec": PINNED_IERS_DPSI_ARCSEC,
            "eopTerminalDEpsArcsec": PINNED_IERS_DEPS_ARCSEC,
            "apparentDirection": (
                "three-iteration Sun light-time approximation plus "
                "SOFA-compatible stellar aberration; Sun-center gravitational "
                "deflection remains evidence-bounded identity"
            ),
            "comparison": (
                "integrated geocentric apparent solar longitude in "
                "mean ecliptic-of-date versus DE441 seasonal crossing longitude"
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
