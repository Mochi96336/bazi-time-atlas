import json
import math
import platform
from pathlib import Path

import spiceypy as spice

OUTPUT_DIR = Path("tmp/tt-tdb-spice-capture")
J2000_JD = 2451545.0
SECONDS_PER_DAY = 86400.0

# NAIF Time Required Reading nominal DELTET constants.
DELTA_T_A = 32.184
K_SECONDS = 1.657e-3
EB = 1.671e-2
M0_RADIANS = 6.239996
M1_RADIANS_PER_SECOND = 1.99096871e-7


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


def candidate_tdb_seconds_from_tt_seconds(tt_seconds: float) -> float:
    # Fixed-point solution of the NAIF-documented relation
    # TDB - TT = K sin(E), E = M + EB sin(M), M = M0 + M1*TDB_seconds.
    tdb_seconds = tt_seconds
    for _ in range(6):
        mean_anomaly = M0_RADIANS + M1_RADIANS_PER_SECOND * tdb_seconds
        eccentric_anomaly = mean_anomaly + EB * math.sin(mean_anomaly)
        tdb_seconds = tt_seconds + K_SECONDS * math.sin(eccentric_anomaly)
    return tdb_seconds


def configure_spice_time_constants() -> None:
    spice.kclear()
    spice.pdpool("DELTET/DELTA_T_A", [DELTA_T_A])
    spice.pdpool("DELTET/K", [K_SECONDS])
    spice.pdpool("DELTET/EB", [EB])
    spice.pdpool("DELTET/M", [M0_RADIANS, M1_RADIANS_PER_SECOND])


configure_spice_time_constants()

samples = [
    ("j2000", 2000, 1, 1.5),
    ("2026-march", 2026, 3, 20.5),
    ("2026-june", 2026, 6, 21.0),
    ("2026-september", 2026, 9, 23.0),
    ("2026-december", 2026, 12, 21.5),
    ("4006-march", 4006, 3, 20.5),
    ("4006-june", 4006, 6, 21.0),
    ("4006-september", 4006, 9, 23.0),
    ("4006-december", 4006, 12, 21.5),
]

records = []
for label, year, month, day in samples:
    jd_tt = gregorian_jd(year, month, day)
    tt_seconds = (jd_tt - J2000_JD) * SECONDS_PER_DAY
    spice_tdb_seconds = float(spice.unitim(tt_seconds, "TT", "TDB"))
    candidate_tdb_seconds = candidate_tdb_seconds_from_tt_seconds(tt_seconds)
    records.append({
        "label": label,
        "year": year,
        "month": month,
        "day": day,
        "jdTt": jd_tt,
        "ttSecondsPastJ2000": tt_seconds,
        "spiceTdbSecondsPastJ2000": spice_tdb_seconds,
        "spiceTdbMinusTtSeconds": spice_tdb_seconds - tt_seconds,
        "candidateTdbSecondsPastJ2000": candidate_tdb_seconds,
        "candidateMinusSpiceSeconds": candidate_tdb_seconds - spice_tdb_seconds,
    })

payload = {
    "authority": "NASA/JPL NAIF CSPICE via SpiceyPy",
    "spiceyPyVersion": spice.__version__,
    "pythonVersion": platform.python_version(),
    "inputScale": "TT/TDT seconds past J2000",
    "outputScale": "TDB seconds past J2000",
    "kernelPool": {
        "DELTET/DELTA_T_A": DELTA_T_A,
        "DELTET/K": K_SECONDS,
        "DELTET/EB": EB,
        "DELTET/M": [M0_RADIANS, M1_RADIANS_PER_SECOND],
    },
    "candidate": "six-step fixed-point solution of the NAIF-documented K*sin(E) model",
    "records": records,
    "maxAbsCandidateMinusSpiceSeconds": max(abs(r["candidateMinusSpiceSeconds"]) for r in records),
    "maxAbsTdbMinusTtSeconds": max(abs(r["spiceTdbMinusTtSeconds"]) for r in records),
}

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / "tt-tdb-spice-truth.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
