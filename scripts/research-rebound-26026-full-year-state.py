#!/usr/bin/env python3
"""Research-only continuous year-26026 Earth/Sun state window.

This extends the merged #569 fixed-grid IAS15 + GR + secular solar-mass-loss
projection from three local windows into one continuous state window covering
all catalogue-year 26026 seasonal crossings.

The model deliberately remains the same as #569:
- DE441 J2000 initial state;
- IAS15 + REBOUNDx gr;
- midpoint-constant secular solar mass loss on a fixed J2000-anchored
  10-year segment grid;
- no asteroid343, no long-term frame transform, no apparent-direction model.

The only new question here is whether dense observation sampling changes the
already accepted #569 projection. Three pinned #569 geocentric checkpoint
vectors are re-sampled from this continuous lane and gated before the state
window can be used by the full seasonal-timeline solver.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from jplephem.spk import SPK

ROOT = Path(__file__).resolve().parents[1]
PROJECTION_PATH = ROOT / "scripts" / "research-rebound-26026-massloss-state.py"

TARGET_YEAR = 26026
WINDOW_START = (26025, 11, 1.0)
WINDOW_END = (26026, 12, 31.0)
WINDOW_STEP_DAYS = 0.5
MAX_PINNED_CHECKPOINT_DRIFT_ARCSEC = 0.05

# Pinned from merged #569 artifact 11840619960.
PINNED_569_GEOCENTRIC_AU = {
    11226896.0: np.asarray(
        [0.9676767923111625, -0.21196990970663535, -0.12313630399310262],
        dtype=np.float64,
    ),
    11226940.0: np.asarray(
        [0.8673387851457782, 0.46515983642270337, 0.1596380843307685],
        dtype=np.float64,
    ),
    11227126.0: np.asarray(
        [-0.8413825497962815, -0.5150209436093233, -0.18115329171860917],
        dtype=np.float64,
    ),
}

PINNED_569_LABELS = {
    11226896.0: "li-chun-window",
    11226940.0: "march-equinox-window",
    11227126.0: "september-equinox-window",
}


def load_projection_module():
    spec = importlib.util.spec_from_file_location(
        "rebound_26026_projection",
        PROJECTION_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load merged #569 projection module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kernel", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    projection = load_projection_module()
    baseline = projection.load_baseline_module()

    if baseline.file_md5(args.kernel) != baseline.EXPECTED_KERNEL_MD5:
        raise RuntimeError("DE441 kernel MD5 mismatch")

    kernel = SPK.open(str(args.kernel))
    try:
        sim, initial_mass, stepper = projection.make_fixed_grid_lane(
            baseline,
            kernel,
            projection.PRIMARY_SEGMENT_YEARS,
        )

        start_jd = baseline.gregorian_julian_day(*WINDOW_START)
        end_jd = baseline.gregorian_julian_day(*WINDOW_END)
        sample_count = int(round((end_jd - start_jd) / WINDOW_STEP_DAYS)) + 1

        rows = []
        pinned_rows = []
        for index in range(sample_count):
            jd = start_jd + index * WINDOW_STEP_DAYS
            stepper.integrate(jd - baseline.J2000_TDB_JD)
            state = projection.snapshot_dict(
                baseline,
                sim,
                jd,
                initial_mass,
            )
            rows.append(state)

            for pinned_jd, pinned_geo in PINNED_569_GEOCENTRIC_AU.items():
                if abs(jd - pinned_jd) < 1e-9:
                    observed = np.asarray(
                        state["geocentricSun"]["positionAu"],
                        dtype=np.float64,
                    )
                    drift_arcsec = baseline.vector_angle_arcsec(
                        observed,
                        pinned_geo,
                    )
                    position_km = float(
                        np.linalg.norm(observed - pinned_geo)
                        * baseline.AU_KM
                    )
                    pinned_rows.append({
                        "label": PINNED_569_LABELS[pinned_jd],
                        "tdbJulianDay": pinned_jd,
                        "directionDriftFromPinned569Arcsec": drift_arcsec,
                        "positionDriftFromPinned569Km": position_km,
                    })
                    print(
                        f"[26026-full-year-regression] "
                        f"{PINNED_569_LABELS[pinned_jd]}: "
                        f"direction={drift_arcsec:.9f} arcsec; "
                        f"position={position_km:.6f} km",
                        flush=True,
                    )
    finally:
        kernel.close()

    if len(pinned_rows) != len(PINNED_569_GEOCENTRIC_AU):
        raise RuntimeError(
            f"expected {len(PINNED_569_GEOCENTRIC_AU)} pinned checkpoints, "
            f"got {len(pinned_rows)}"
        )

    max_checkpoint_drift = max(
        row["directionDriftFromPinned569Arcsec"]
        for row in pinned_rows
    )
    accepted = max_checkpoint_drift <= MAX_PINNED_CHECKPOINT_DRIFT_ARCSEC

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "catalogueYear": TARGET_YEAR,
        "sourceEphemeris": "DE441",
        "referenceFrame": "ICRF",
        "timeScale": "TDB",
        "model": {
            "integrator": "IAS15",
            "physics": "REBOUNDx gr",
            "fractionalSolarMassLossPerYear": (
                projection.SOLAR_FRACTIONAL_MASS_LOSS_PER_YEAR
            ),
            "massLossSegmentYears": projection.PRIMARY_SEGMENT_YEARS,
            "segmentGridAnchor": "J2000 TDB",
            "observationSamplesAlterSegmentGrid": False,
            "asteroid343Included": False,
        },
        "sourceProjection": {
            "pullRequest": 569,
            "mergedMainSha": "0c037b18e708bb4ba67b72ffeabefb132a807463",
            "artifactId": 11840619960,
            "pinnedCheckpointCount": len(PINNED_569_GEOCENTRIC_AU),
        },
        "validation": {
            "maxPinnedCheckpointDriftArcsec": max_checkpoint_drift,
            "gateArcsec": MAX_PINNED_CHECKPOINT_DRIFT_ARCSEC,
            "accepted": accepted,
            "checkpoints": pinned_rows,
        },
        "stateWindow": {
            "startTdbJulianDay": start_jd,
            "endTdbJulianDay": end_jd,
            "stepDays": WINDOW_STEP_DAYS,
            "sampleCount": len(rows),
            "samples": rows,
        },
        "claimBoundary": {
            "continuousCatalogueYearStateProjected": accepted,
            "solarMassLossIncluded": True,
            "asteroid343Included": False,
            "longTermFrameApplied": False,
            "apparentDirectionResolved": False,
            "seasonalCrossingsResolved": False,
            "civilTimeResolved": False,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(
        f"[26026-full-year-summary] accepted={accepted}; "
        f"samples={len(rows)}; "
        f"range={start_jd:.6f}..{end_jd:.6f}; "
        f"max-pinned-drift={max_checkpoint_drift:.9f} arcsec",
        flush=True,
    )

    if not accepted:
        raise RuntimeError(
            "continuous year-26026 state window drifted from merged #569"
        )


if __name__ == "__main__":
    main()
