#!/usr/bin/env python3
import hashlib
import json
import math
import re
import urllib.parse
import urllib.request

import erfa

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
TARGET_YEAR = 4006
DAY_SECONDS = 86400.0
TERMS = [
    ("春分", 0), ("清明", 15), ("穀雨", 30), ("立夏", 45),
    ("小滿", 60), ("芒種", 75), ("夏至", 90), ("小暑", 105),
    ("大暑", 120), ("立秋", 135), ("處暑", 150), ("白露", 165),
    ("秋分", 180), ("寒露", 195), ("霜降", 210), ("立冬", 225),
    ("小雪", 240), ("大雪", 255), ("冬至", 270), ("小寒", 285),
    ("大寒", 300), ("立春", 315), ("雨水", 330), ("驚蟄", 345),
]

# Candidate JDs from the preceding live probe. These are ShouXing/Tyme saLonT
# roots, not reference answers; they merely bound the Horizons queries.
SHOUXING_TT_JD = {
    "春分": 3184300.181444289,
    "清明": 3184315.093659071,
    "穀雨": 3184330.101328401,
    "立夏": 3184345.233715398,
    "小滿": 3184360.483502460,
    "芒種": 3184375.863625844,
    "夏至": 3184391.350420211,
    "小暑": 3184406.938802908,
    "大暑": 3184422.592104822,
    "立秋": 3184438.289565627,
    "處暑": 3184453.990473236,
    "白露": 3184469.665328996,
    "秋分": 3184485.280431198,
    "寒露": 3184500.807245694,
    "霜降": 3184516.228416373,
    "立冬": 3184531.525263068,
    "小雪": 3184546.700571445,
    "大雪": 3184561.750134193,
    "冬至": 3184211.445395395,
    "小寒": 3184226.301358520,
    "大寒": 3184241.085282890,
    "立春": 3184255.840260557,
    "雨水": 3184270.582650339,
    "驚蟄": 3184285.358026212,
}


def normalize_degrees(value):
    return value % 360.0


def signed_delta(actual, target):
    return ((actual - target + 540.0) % 360.0) - 180.0


def iau80_dpsi_degrees(jd_tt):
    # SOFA/ERFA two-part Julian Date; nut80 returns radians.
    dpsi, _deps = erfa.nut80(2400000.5, jd_tt - 2400000.5)
    return math.degrees(float(dpsi))


def horizons_rows(start_jd, stop_jd, step_size):
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
        raise RuntimeError("Horizons response did not identify Sun source as DE441")
    if not re.search(r"Center body name:\s+Earth \(399\).*\{source: DE441\}", text):
        raise RuntimeError("Horizons response did not identify Earth source as DE441")
    if 'Terrestrial Time ("TT") output was requested' not in text:
        raise RuntimeError("Horizons response did not confirm TT output")

    match = re.search(r"\$\$SOE\s*(.*?)\s*\$\$EOE", text, flags=re.S)
    if not match:
        raise RuntimeError("Horizons response did not contain an ephemeris table")

    rows = []
    for line in match.group(1).strip().splitlines():
        fields = [field.strip() for field in line.split(",")]
        jd_tt = float(fields[1])
        mean_ecliptic_longitude = float(fields[4])
        dpsi = iau80_dpsi_degrees(jd_tt)
        rows.append({
            "jdTt": jd_tt,
            "meanLongitudeDegrees": mean_ecliptic_longitude,
            "iau80DpsiDegrees": dpsi,
            "trueLongitudeDegrees": normalize_degrees(mean_ecliptic_longitude + dpsi),
        })
    if not rows:
        raise RuntimeError("Horizons table parse failed")
    return rows


def interpolate_crossing(rows, target, field):
    for left, right in zip(rows, rows[1:]):
        left_delta = signed_delta(left[field], target)
        right_delta = signed_delta(right[field], target)
        if left_delta <= 0 <= right_delta and right_delta - left_delta < 5.0:
            fraction = -left_delta / (right_delta - left_delta)
            return left["jdTt"] + fraction * (right["jdTt"] - left["jdTt"])
    raise RuntimeError(f"No {target} degree crossing in {field}")


def solve_crossings(candidate_jd, target):
    coarse = horizons_rows(candidate_jd - 0.5, candidate_jd + 0.5, "10 m")
    mean_coarse_jd = interpolate_crossing(coarse, target, "meanLongitudeDegrees")
    true_coarse_jd = interpolate_crossing(coarse, target, "trueLongitudeDegrees")
    half_window = 2.0 / 1440.0
    mean_refined = horizons_rows(mean_coarse_jd - half_window, mean_coarse_jd + half_window, "240")
    true_refined = horizons_rows(true_coarse_jd - half_window, true_coarse_jd + half_window, "240")
    return (
        interpolate_crossing(mean_refined, target, "meanLongitudeDegrees"),
        interpolate_crossing(true_refined, target, "trueLongitudeDegrees"),
    )


terms = []
for name, longitude in TERMS:
    candidate = SHOUXING_TT_JD[name]
    mean_jd, true_jd = solve_crossings(candidate, longitude)
    mean_error = (candidate - mean_jd) * DAY_SECONDS
    true_error = (candidate - true_jd) * DAY_SECONDS
    dpsi_arcsec = iau80_dpsi_degrees(candidate) * 3600.0
    print(
        f"{name:2} {longitude:3d}°  raw={mean_error:+10.6f}s  "
        f"+IAU80Δψ={true_error:+10.6f}s  Δψ={dpsi_arcsec:+9.4f}\"",
        flush=True,
    )
    terms.append({
        "name": name,
        "longitudeDegrees": longitude,
        "shouXingTtJulianDay": round(candidate, 9),
        "jplDe441MeanEclipticTtJulianDay": round(mean_jd, 9),
        "jplDe441PlusIau80DpsiTtJulianDay": round(true_jd, 9),
        "rawMeanEclipticErrorSeconds": round(mean_error, 6),
        "trueEclipticErrorSeconds": round(true_error, 6),
        "iau80DpsiArcsecondsAtCandidate": round(dpsi_arcsec, 6),
    })

raw_errors = [abs(term["rawMeanEclipticErrorSeconds"]) for term in terms]
true_errors = [abs(term["trueEclipticErrorSeconds"]) for term in terms]
evidence = {
    "schemaVersion": 2,
    "id": "jpl-horizons-de441-erfa-iau80-4006-24-term-diagnostic",
    "authority": "NASA/JPL Horizons + ERFA/SOFA IAU 1980 nutation",
    "sourceEphemeris": "DE441",
    "horizonsQuantity": "31 · observer-centered mean ecliptic-of-date apparent longitude",
    "nutationModel": "ERFA/SOFA erfa.nut80 (IAU 1980)",
    "timeScale": "TT",
    "catalogueYear": TARGET_YEAR,
    "samples": len(terms),
    "rawMaxAbsEpochErrorSeconds": round(max(raw_errors), 6),
    "trueMaxAbsEpochErrorSeconds": round(max(true_errors), 6),
    "rawMeanAbsEpochErrorSeconds": round(sum(raw_errors) / len(raw_errors), 6),
    "trueMeanAbsEpochErrorSeconds": round(sum(true_errors) / len(true_errors), 6),
    "terms": terms,
}
serialized = json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
sha256 = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
print(serialized)
print("SHA256", sha256)
