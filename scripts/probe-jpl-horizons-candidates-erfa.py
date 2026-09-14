#!/usr/bin/env python3
import json
import math
import re
import sys
import urllib.parse
import urllib.request

import erfa

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
DAY_SECONDS = 86400.0


def normalize_degrees(value):
    return value % 360.0


def signed_delta(actual, target):
    return ((actual - target + 540.0) % 360.0) - 180.0


def dpsi_degrees(jd_tt):
    dpsi, _deps = erfa.nut80(2400000.5, jd_tt - 2400000.5)
    return math.degrees(float(dpsi))


def rows(start_jd, stop_jd, step_size):
    params = {
        "format": "text",
        "COMMAND": "'10'",
        "OBJ_DATA": "'YES'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'500@399'",
        "START_TIME": f"'JD{start_jd:.9f}'",
        "STOP_TIME": f"'JD{stop_jd:.9f}'",
        "STEP_SIZE": f"'{step_size}'",
        "QUANTITIES": "'31'",
        "TIME_TYPE": "'TT'",
        "TIME_DIGITS": "'FRACSEC'",
        "CAL_FORMAT": "'BOTH'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
        "EXTRA_PREC": "'YES'",
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as response:
        text = response.read().decode("utf-8")
    if not re.search(r"Target body name:\s+Sun \(10\).*\{source: DE441\}", text):
        raise RuntimeError("Sun source is not DE441")
    if not re.search(r"Center body name:\s+Earth \(399\).*\{source: DE441\}", text):
        raise RuntimeError("Earth source is not DE441")
    if 'Terrestrial Time ("TT") output was requested' not in text:
        raise RuntimeError("TT output not confirmed")
    table = re.search(r"\$\$SOE\s*(.*?)\s*\$\$EOE", text, flags=re.S)
    if not table:
        raise RuntimeError("missing ephemeris table")
    result = []
    for line in table.group(1).strip().splitlines():
        fields = [field.strip() for field in line.split(",")]
        jd = float(fields[1])
        mean_lon = float(fields[4])
        result.append({
            "jd": jd,
            "mean": mean_lon,
            "true": normalize_degrees(mean_lon + dpsi_degrees(jd)),
        })
    return result


def crossing(table, target, field):
    for left, right in zip(table, table[1:]):
        dl = signed_delta(left[field], target)
        dr = signed_delta(right[field], target)
        if dl <= 0 <= dr and dr - dl < 5:
            f = -dl / (dr - dl)
            return left["jd"] + f * (right["jd"] - left["jd"])
    raise RuntimeError(f"no {target} degree crossing for {field}")


def solve(candidate, target, field):
    coarse = rows(candidate - 0.5, candidate + 0.5, "10 m")
    rough = crossing(coarse, target, field)
    half = 2 / 1440
    fine = rows(rough - half, rough + half, "240")
    return crossing(fine, target, field)


if len(sys.argv) != 2:
    raise SystemExit("usage: probe-jpl-horizons-candidates-erfa.py CANDIDATES.json")
with open(sys.argv[1], "r", encoding="utf-8") as handle:
    candidates = json.load(handle)

raw_errors = []
true_errors = []
for item in candidates:
    name = item["name"]
    target = float(item["longitudeDegrees"])
    candidate = float(item["shouXingTtJulianDay"])
    raw_jd = solve(candidate, target, "mean")
    true_jd = solve(candidate, target, "true")
    raw_error = (candidate - raw_jd) * DAY_SECONDS
    true_error = (candidate - true_jd) * DAY_SECONDS
    raw_errors.append(abs(raw_error))
    true_errors.append(abs(true_error))
    print(
        f"{name:2} {target:3.0f}° raw={raw_error:+10.6f}s "
        f"+IAU80Δψ={true_error:+10.6f}s Δψ={dpsi_degrees(candidate)*3600:+9.4f}\"",
        flush=True,
    )

print(json.dumps({
    "samples": len(candidates),
    "rawMaxAbsEpochErrorSeconds": max(raw_errors),
    "rawMeanAbsEpochErrorSeconds": sum(raw_errors) / len(raw_errors),
    "trueMaxAbsEpochErrorSeconds": max(true_errors),
    "trueMeanAbsEpochErrorSeconds": sum(true_errors) / len(true_errors),
}, indent=2))
