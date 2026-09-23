#!/usr/bin/env python3
"""Capture compact DE441 Earth/Sun states around catalogue year 10026.

This is research-only evidence. It samples the official JPL/NAIF DE441 SPK
directly because Horizons does not expose AD 10026. Output is geometric ICRF
barycentric state data on the TDB axis, plus an exhaustive withheld-midpoint
Hermite interpolation check. It does not compute a seasonal crossing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import jplephem
import numpy as np
from jplephem.spk import SPK

AU_KM = 149_597_870.700
SECONDS_PER_DAY = 86_400.0
TARGET_YEAR = 10026
EXPECTED_KERNEL_MD5 = "ad8dfa4e505ef0e3a5d587a5b4705632"
KERNEL_URL = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-2.bsp"

BUDGETS = {
    "earth": {
        "maxPositionErrorMeters": 125.0,
        "maxVelocityErrorMetersPerSecond": 0.00007,
    },
    "sun": {
        "maxPositionErrorMeters": 0.01,
        "maxVelocityErrorMetersPerSecond": 0.000000003,
    },
}


def gregorian_julian_day(year: int, month: int, day: float) -> float:
    """Proleptic Gregorian calendar -> astronomical Julian Day."""
    if not isinstance(year, int):
        raise TypeError("year must be an integer")
    if month < 1 or month > 12:
        raise ValueError("month must be in 1..12")
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


def hash_file(path: Path, algorithm: str) -> str:
    digest = hashlib.new(algorithm)
    with path.open("rb") as handle:
        while chunk := handle.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def flat_states(position_km: np.ndarray, velocity_km_per_day: np.ndarray) -> np.ndarray:
    p = np.asarray(position_km, dtype=np.float64).T / AU_KM
    v = np.asarray(velocity_km_per_day, dtype=np.float64).T / AU_KM
    if p.ndim == 1:
        p = p.reshape(1, 3)
        v = v.reshape(1, 3)
    return np.concatenate((p, v), axis=1)


def sample_body_states(kernel: SPK, tdb_jd: np.ndarray, body: str) -> np.ndarray:
    if body == "sun":
        position, velocity = kernel[0, 10].compute_and_differentiate(tdb_jd)
        return flat_states(position, velocity)
    if body == "earth":
        emb_position, emb_velocity = kernel[0, 3].compute_and_differentiate(tdb_jd)
        earth_position, earth_velocity = kernel[3, 399].compute_and_differentiate(tdb_jd)
        return flat_states(
            emb_position + earth_position,
            emb_velocity + earth_velocity,
        )
    raise ValueError(f"unsupported body: {body}")


def hermite_midpoints(daily: np.ndarray) -> np.ndarray:
    """Evaluate one-day cubic Hermite segments at u=0.5."""
    p0 = daily[:-1, :3]
    v0 = daily[:-1, 3:]
    p1 = daily[1:, :3]
    v1 = daily[1:, 3:]
    u = 0.5
    u2 = u * u
    u3 = u2 * u
    h00 = 2 * u3 - 3 * u2 + 1
    h10 = u3 - 2 * u2 + u
    h01 = -2 * u3 + 3 * u2
    h11 = u3 - u2
    dh00 = 6 * u2 - 6 * u
    dh10 = 3 * u2 - 4 * u + 1
    dh01 = -6 * u2 + 6 * u
    dh11 = 3 * u2 - 2 * u
    position = h00 * p0 + h10 * v0 + h01 * p1 + h11 * v1
    velocity = dh00 * p0 + dh10 * v0 + dh01 * p1 + dh11 * v1
    return np.concatenate((position, velocity), axis=1)


def validation_stats(interpolated: np.ndarray, truth: np.ndarray) -> dict:
    position_error_m = np.linalg.norm(
        interpolated[:, :3] - truth[:, :3], axis=1
    ) * AU_KM * 1000.0
    velocity_error_mps = np.linalg.norm(
        interpolated[:, 3:] - truth[:, 3:], axis=1
    ) * AU_KM * 1000.0 / SECONDS_PER_DAY
    return {
        "sampleCount": int(truth.shape[0]),
        "maxPositionErrorMeters": float(position_error_m.max()),
        "meanPositionErrorMeters": float(position_error_m.mean()),
        "maxVelocityErrorMetersPerSecond": float(velocity_error_mps.max()),
        "meanVelocityErrorMetersPerSecond": float(velocity_error_mps.mean()),
    }


def require_budget(body: str, stats: dict) -> None:
    budget = BUDGETS[body]
    if stats["maxPositionErrorMeters"] >= budget["maxPositionErrorMeters"]:
        raise RuntimeError(
            f"{body} Hermite position error {stats['maxPositionErrorMeters']} m "
            f"exceeds {budget['maxPositionErrorMeters']} m"
        )
    if (
        stats["maxVelocityErrorMetersPerSecond"]
        >= budget["maxVelocityErrorMetersPerSecond"]
    ):
        raise RuntimeError(
            f"{body} Hermite velocity error "
            f"{stats['maxVelocityErrorMetersPerSecond']} m/s exceeds "
            f"{budget['maxVelocityErrorMetersPerSecond']} m/s"
        )


def json_array(values: np.ndarray) -> list[float]:
    return [float(value) for value in values.reshape(-1)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    kernel_path = args.kernel
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if not kernel_path.is_file():
        raise FileNotFoundError(kernel_path)

    kernel_md5 = hash_file(kernel_path, "md5")
    if kernel_md5 != EXPECTED_KERNEL_MD5:
        raise RuntimeError(
            f"DE441 kernel MD5 mismatch: expected {EXPECTED_KERNEL_MD5}, got {kernel_md5}"
        )
    kernel_sha256 = hash_file(kernel_path, "sha256")

    daily_start = gregorian_julian_day(10025, 12, 1.0)
    daily_end = gregorian_julian_day(10026, 12, 31.0)
    daily_jd = np.arange(daily_start, daily_end + 0.25, 1.0, dtype=np.float64)
    midpoint_jd = daily_jd[:-1] + 0.5

    if len(daily_jd) != 396 or len(midpoint_jd) != 395:
        raise RuntimeError(
            f"unexpected sample count: daily={len(daily_jd)}, midpoint={len(midpoint_jd)}"
        )

    kernel = SPK.open(str(kernel_path))
    try:
        body_data = {}
        validation = {}
        for body in ("earth", "sun"):
            daily = sample_body_states(kernel, daily_jd, body)
            withheld = sample_body_states(kernel, midpoint_jd, body)
            interpolated = hermite_midpoints(daily)
            stats = validation_stats(interpolated, withheld)
            require_budget(body, stats)
            validation[body] = stats
            body_data[body] = {
                "daily": json_array(daily),
                "withheldMidpoint": json_array(withheld),
            }
    finally:
        kernel.close()

    capture = {
        "schemaVersion": 1,
        "catalogueYear": TARGET_YEAR,
        "stateContract": {
            "center": "Solar System barycenter (0)",
            "referenceFrame": "ICRF",
            "timeScale": "TDB",
            "units": "AU/day",
            "corrections": "NONE (geometric)",
            "earthRoute": [[0, 3], [3, 399]],
            "sunRoute": [[0, 10]],
        },
        "daily": {
            "startTdbJulianDay": float(daily_jd[0]),
            "endTdbJulianDay": float(daily_jd[-1]),
            "stepDays": 1.0,
            "sampleCount": int(len(daily_jd)),
        },
        "withheldMidpoint": {
            "startTdbJulianDay": float(midpoint_jd[0]),
            "endTdbJulianDay": float(midpoint_jd[-1]),
            "stepDays": 1.0,
            "phaseDays": 0.5,
            "sampleCount": int(len(midpoint_jd)),
        },
        "bodies": body_data,
        "validation": validation,
    }
    capture_path = output_dir / "de441-10026-state-capture.json"
    capture_text = json.dumps(capture, separators=(",", ":"), sort_keys=True)
    capture_path.write_text(capture_text + "\n", encoding="utf-8")
    capture_sha256 = hashlib.sha256(capture_text.encode("utf-8")).hexdigest()

    manifest = {
        "schemaVersion": 1,
        "authority": "NASA/JPL NAIF",
        "sourceEphemeris": "DE441",
        "sourceKernel": {
            "filename": kernel_path.name,
            "url": KERNEL_URL,
            "officialMd5": EXPECTED_KERNEL_MD5,
            "observedMd5": kernel_md5,
            "observedSha256": kernel_sha256,
            "bytes": kernel_path.stat().st_size,
        },
        "sampler": {
            "python": sys.version.split()[0],
            "jplephem": jplephem.__version__,
            "numpy": np.__version__,
            "script": os.path.basename(__file__),
        },
        "catalogueYear": TARGET_YEAR,
        "capture": {
            "filename": capture_path.name,
            "sha256": capture_sha256,
            "bytes": capture_path.stat().st_size,
        },
        "validation": validation,
        "claimBoundary": {
            "absoluteStateCaptured": True,
            "stateInterpolationValidated": True,
            "meanEclipticOfDateTransformResolved": False,
            "apparentSeasonalCrossingResolved": False,
            "civilTimeResolved": False,
            "productionIntegrated": False,
        },
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(manifest, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
