#!/usr/bin/env python3
"""Capture J2000 ICRF/TDB barycentric states for the Horizons N16 asteroid set.

Research-only capture.  Horizons has used this 16-body perturber set with the
DE440/441 era small-body integrations.  The resulting state file is an input to
an A/B test; it is not itself a claim that N16 reproduces the 343-asteroid
planetary ephemeris force model.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import rebound
from rebound.horizons import query_horizons_for_particle

AU_KM = 149_597_870.700
SECONDS_PER_DAY = 86_400.0
J2000_TDB_JD = 2_451_545.0

N16 = (
    (1, "Ceres", 62.628888644409933),
    (2, "Pallas", 13.665878145967422),
    (3, "Juno", 1.9205707002025889),
    (4, "Vesta", 17.288232879171513),
    (7, "Iris", 1.1398723232184107),
    (10, "Hygiea", 5.6251476453852289),
    (15, "Eunomia", 2.0230209871098284),
    (16, "Psyche", 1.5896582441709424),
    (31, "Euphrosyne", 1.0793714577033560),
    (52, "Europa", 2.6830359242821795),
    (65, "Cybele", 0.93810575639151328),
    (87, "Sylvia", 2.1682320736996910),
    (88, "Thisbe", 1.1898077088121908),
    (107, "Camilla", 1.4437384031866001),
    (511, "Davida", 3.8944831481705644),
    (704, "Interamnia", 2.8304096393299849),
)


def capture_one(number: int, name: str, gm: float):
    particle = query_horizons_for_particle(
        f"{number};",
        mass_unit=None,
        date=f"JD{J2000_TDB_JD}",
        plane="frame",
    )
    return {
        "number": number,
        "name": name,
        "gmKm3S2": gm,
        "positionAu": [
            particle.x / AU_KM,
            particle.y / AU_KM,
            particle.z / AU_KM,
        ],
        "velocityAuPerDay": [
            particle.vx / AU_KM * SECONDS_PER_DAY,
            particle.vy / AU_KM * SECONDS_PER_DAY,
            particle.vz / AU_KM * SECONDS_PER_DAY,
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    bodies = [capture_one(*item) for item in N16]
    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "source": "NASA/JPL Horizons API via REBOUND 5.2.2 helper",
        "captureUtc": datetime.now(timezone.utc).isoformat(),
        "epochTdbJulianDay": J2000_TDB_JD,
        "center": "solar-system-barycenter",
        "referenceFrame": "ICRF",
        "referencePlane": "FRAME",
        "vectorCorrections": "NONE",
        "positionUnits": "AU",
        "velocityUnits": "AU/day",
        "setId": "horizons-de441-era-n16",
        "bodyCount": len(bodies),
        "bodies": bodies,
        "claimBoundary": {
            "matchesDe441Planetary343AsteroidSet": False,
            "role": "subset-perturber-ab-test",
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps({
        "setId": result["setId"],
        "bodyCount": result["bodyCount"],
        "epochTdbJulianDay": result["epochTdbJulianDay"],
        "referenceFrame": result["referenceFrame"],
    }, indent=2))


if __name__ == "__main__":
    main()
