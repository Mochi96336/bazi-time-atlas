#!/usr/bin/env python3
"""Capture J2000 barycentric states + DE440/441 mass constants for sb441-n373s.

The short-window JPL kernel is used only as a source of J2000 initial
conditions.  The compact DE440 planetary SPK is used only as a constants
source because its comment block carries the MAxxxx integration masses; the
long DE441 part-2 kernel remains the source for Sun state / later truth.
States come directly from SPK segments, including velocities.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import re

import spiceypy as spice
from jplephem.spk import SPK

AU_KM = 149_597_870.700
SECONDS_PER_DAY = 86_400.0
J2000_TDB_JD = 2_451_545.0

KNOWN_N16_GM = {
    1: 62.628888644409933,
    2: 13.665878145967422,
    3: 1.9205707002025889,
    4: 17.288232879171513,
    7: 1.1398723232184107,
    10: 5.6251476453852289,
    15: 2.0230209871098284,
    16: 1.5896582441709424,
    31: 1.0793714577033560,
    52: 2.6830359242821795,
    65: 0.93810575639151328,
    87: 2.1682320736996910,
    88: 1.1898077088121908,
    107: 1.4437384031866001,
    511: 3.8944831481705644,
    704: 2.8304096393299849,
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def read_de_mass_constants(kernel_path: Path) -> dict[str, float]:
    handle = spice.dafopr(str(kernel_path))
    lines = []
    try:
        done = False
        while not done:
            n, batch, done = spice.dafec(handle, 1000, 1024)
            lines.extend(str(line) for line in batch[:n])
    finally:
        spice.dafcls(handle)

    masses = {}
    in_constants = False
    pattern = re.compile(
        r"^\\s*(MA\\d+)\\s+([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[DdEe][+-]?\\d+)?)"
    )
    for line in lines:
        if "Initial conditions and constants used for integration:" in line:
            in_constants = True
            continue
        if not in_constants:
            continue
        match = pattern.match(line)
        if match:
            masses[match.group(1)] = float(
                match.group(2).replace("D", "E").replace("d", "e")
            )
    if len(masses) < 300:
        raise RuntimeError(
            f"only {len(masses)} MAxxxx constants found in mass-kernel comments"
        )
    return masses


def unique_targets_in_file_order(kernel: SPK) -> list[int]:
    seen = set()
    targets = []
    for segment in kernel.segments:
        if segment.target not in seen:
            seen.add(segment.target)
            targets.append(segment.target)
    return targets


def segment_at(kernel: SPK, target: int, jd: float):
    for segment in kernel.segments:
        if (
            segment.target == target
            and segment.start_jd <= jd <= segment.end_jd
        ):
            return segment
    raise RuntimeError(f"target {target} has no segment at JD {jd}")


def barycentric_state(
    small_kernel: SPK,
    planet_kernel: SPK,
    target: int,
    jd: float,
):
    segment = segment_at(small_kernel, target, jd)
    p, v = segment.compute_and_differentiate(jd)
    position = [float(value) for value in p]
    velocity = [float(value) for value in v]

    if segment.center == 10:
        sp, sv = planet_kernel[0, 10].compute_and_differentiate(jd)
        position = [position[i] + float(sp[i]) for i in range(3)]
        velocity = [velocity[i] + float(sv[i]) for i in range(3)]
    elif segment.center != 0:
        raise RuntimeError(
            f"unsupported small-body SPK center {segment.center} for target {target}"
        )

    return (
        [value / AU_KM for value in position],
        [value / AU_KM for value in velocity],
        int(segment.center),
    )


def heliocentric_radius_au(position_au, sun_position_au) -> float:
    return math.sqrt(sum(
        (position_au[i] - sun_position_au[i]) ** 2 for i in range(3)
    ))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--planet-kernel", required=True, type=Path)
    parser.add_argument("--mass-kernel", required=True, type=Path)
    parser.add_argument("--small-kernel", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    planet_kernel = SPK.open(str(args.planet_kernel))
    small_kernel = SPK.open(str(args.small_kernel))
    try:
        targets = unique_targets_in_file_order(small_kernel)
        mass_constants = read_de_mass_constants(args.mass_kernel)
        sp, _ = planet_kernel[0, 10].compute_and_differentiate(J2000_TDB_JD)
        sun_position_au = [float(value) / AU_KM for value in sp]

        bodies = []
        for index, target in enumerate(targets):
            p, v, source_center = barycentric_state(
                small_kernel,
                planet_kernel,
                target,
                J2000_TDB_JD,
            )

            number = target - 2_000_000 if target >= 2_000_000 else None
            if number is None:
                raise RuntimeError(f"unexpected non-small-body target code {target}")
            mass_key = f"MA{number:04d}"
            if mass_key not in mass_constants:
                raise RuntimeError(
                    f"DE441 mass constant {mass_key} missing for target {target}"
                )
            gm_au3_day2 = float(mass_constants[mass_key])
            gm_km3_s2 = (
                gm_au3_day2 * AU_KM ** 3 / SECONDS_PER_DAY ** 2
            )
            radius_au = heliocentric_radius_au(p, sun_position_au)

            bodies.append({
                "spkTargetIndex":index,
                "targetCode":target,
                "number":number,
                "gmAu3Day2":gm_au3_day2,
                "gmKm3S2":gm_km3_s2,
                "sourceCenter":source_center,
                "heliocentricRadiusAuAtJ2000":radius_au,
                "population":"outer-kbo-candidate" if radius_au > 10.0 else "inner-asteroid-candidate",
                "positionAu":p,
                "velocityAuPerDay":v,
            })

        # Validate DE441 MAxxxx parsing against the already verified N16 mass
        # set.  This fails loudly if the constants or unit conversion drift.
        checked = 0
        for body in bodies:
            number = body["number"]
            if number not in KNOWN_N16_GM:
                continue
            expected = KNOWN_N16_GM[number]
            observed = body["gmKm3S2"]
            rel = abs(observed - expected) / expected
            if rel > 5e-5:
                raise RuntimeError(
                    f"N16 mass mapping mismatch for {number}: {observed} vs {expected}"
                )
            checked += 1
        if checked < 12:
            raise RuntimeError(
                f"only {checked} N16 mass anchors found in n373s; expected at least 12"
            )

        inner = [b for b in bodies if b["population"] == "inner-asteroid-candidate"]
        outer = [b for b in bodies if b["population"] == "outer-kbo-candidate"]
        if not (20 <= len(outer) <= 40):
            raise RuntimeError(
                f"unexpected outer-body count {len(outer)}; expected DE441's ~30 KBOs"
            )
        if len(inner) < 300:
            raise RuntimeError(
                f"unexpected inner-body count {len(inner)}; expected hundreds of asteroids"
            )

        result = {
            "schemaVersion":1,
            "researchOnly":True,
            "source":"NASA/JPL sb441-n373s states + DE440/441 MAxxxx integration constants",
            "epochTdbJulianDay":J2000_TDB_JD,
            "center":"solar-system-barycenter",
            "referenceFrame":"ICRF",
            "positionUnits":"AU",
            "velocityUnits":"AU/day",
            "setId":"de441-n373s-j2000",
            "planetKernelSha256":sha256(args.planet_kernel),
            "massKernelSha256":sha256(args.mass_kernel),
            "smallKernelSha256":sha256(args.small_kernel),
            "bodyCount":len(bodies),
            "innerCount":len(inner),
            "outerCount":len(outer),
            "n16MassAnchorsValidated":checked,
            "bodies":bodies,
            "claimBoundary":{
                "shortKernelUsedOnlyForJ2000InitialState":True,
                "outerClassificationIsRadiusBasedProxy":True,
                "includesKboRing":False,
                "productionAuthorityGranted":False,
            },
        }

        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
        print(json.dumps({
            "bodyCount":len(bodies),
            "innerCount":len(inner),
            "outerCount":len(outer),
            "n16MassAnchorsValidated":checked,
            "massKernelSha256":result["massKernelSha256"],
            "smallKernelSha256":result["smallKernelSha256"],
            "outerMassGmKm3S2":sum(b["gmKm3S2"] for b in outer),
            "innerMassGmKm3S2":sum(b["gmKm3S2"] for b in inner),
        }, indent=2))
    finally:
        small_kernel.close()
        planet_kernel.close()


if __name__ == "__main__":
    main()
