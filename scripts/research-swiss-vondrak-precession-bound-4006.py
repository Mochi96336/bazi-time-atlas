#!/usr/bin/env python3
"""Derive source-backed continuous Vondrak-2011 precession-matrix bounds for year 4006.

This proof is intentionally scoped to Swiss Ephemeris's long-term precession
matrix.  It parses the coefficient tables from a pinned swephlib.c, derives
analytic first/second derivative envelopes for the equator/ecliptic poles, and
propagates them through Swiss's normalized cross-product matrix construction.
It does not certify the apparent-Sun input vector or Equation-of-Time output.
"""

from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path

J2000 = 2451545.0
CENTURY_DAYS = 36525.0
AS2R = math.pi / (180.0 * 3600.0)
EPS0 = 84381.406 * AS2R
TARGET_YEAR = 4006
# Same ET domain frozen by the merged SWIEPH segment-curvature certificate.
START_ET_JD = 3184221.651853002142161
END_ET_JD = 3184586.652003847528249
MAX_SAMPLE_STEP_DAYS = 1.0
# Explicit numerical slack applied only to sampled norm lower bounds and
# midpoint value enclosures.  Analytic derivative envelopes dominate it by
# many orders of magnitude; it is not used to claim exact real arithmetic.
FLOATING_POINT_SLACK = 2e-12


def strip_c_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//.*?$", "", text, flags=re.M)


def parse_matrix(source: str, name: str) -> list[list[float]]:
    clean = strip_c_comments(source)
    pattern = re.compile(
        rf"static\s+const\s+double\s+{re.escape(name)}\s*"
        r"\[[^\]]+\]\s*\[[^\]]+\]\s*=\s*\{(.*?)\};",
        flags=re.S,
    )
    match = pattern.search(clean)
    if not match:
        raise RuntimeError(f"cannot locate Swiss coefficient table {name}")
    rows: list[list[float]] = []
    for row_text in re.findall(r"\{([^{}]+)\}", match.group(1)):
        values = [
            float(token)
            for token in re.findall(
                r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?",
                row_text,
            )
        ]
        if values:
            rows.append(values)
    if not rows or any(len(row) != len(rows[0]) for row in rows):
        raise RuntimeError(f"malformed Swiss coefficient table {name}")
    return rows


def component_value(
    t_centuries: float,
    polynomial: list[float],
    periodic: list[list[float]],
    cosine_row: int,
    sine_row: int,
) -> float:
    value = sum(coef * (t_centuries**power) for power, coef in enumerate(polynomial))
    for period, ccoef, scoef in zip(
        periodic[0], periodic[cosine_row], periodic[sine_row], strict=True
    ):
        angle = 2.0 * math.pi * t_centuries / period
        value += ccoef * math.cos(angle) + scoef * math.sin(angle)
    return value * AS2R


def component_derivative_bounds(
    t_abs_max: float,
    polynomial: list[float],
    periodic: list[list[float]],
    cosine_row: int,
    sine_row: int,
) -> tuple[float, float]:
    first_per_century = 0.0
    second_per_century2 = 0.0
    for power, coef in enumerate(polynomial):
        if power >= 1:
            first_per_century += power * abs(coef) * (t_abs_max ** (power - 1))
        if power >= 2:
            second_per_century2 += (
                power * (power - 1) * abs(coef) * (t_abs_max ** (power - 2))
            )
    for period, ccoef, scoef in zip(
        periodic[0], periodic[cosine_row], periodic[sine_row], strict=True
    ):
        omega = 2.0 * math.pi / abs(period)
        amplitude_l1 = abs(ccoef) + abs(scoef)
        first_per_century += amplitude_l1 * omega
        second_per_century2 += amplitude_l1 * omega * omega
    first_per_day = first_per_century * AS2R / CENTURY_DAYS
    second_per_day2 = second_per_century2 * AS2R / (CENTURY_DAYS**2)
    return first_per_day, second_per_day2


def component_enclosure(
    midpoint_value: float,
    first_per_day: float,
    half_span_days: float,
) -> float:
    return abs(midpoint_value) + first_per_day * half_span_days + FLOATING_POINT_SLACK


def pole_derivative_bounds(
    u_abs: float,
    v_abs: float,
    u_first: float,
    v_first: float,
    u_second: float,
    v_second: float,
) -> dict[str, float]:
    radial_square_upper = u_abs * u_abs + v_abs * v_abs
    if not radial_square_upper < 1.0:
        raise RuntimeError(
            f"pole enclosure reaches unit-circle singularity: {radial_square_upper}"
        )
    z_lower = math.sqrt(1.0 - radial_square_upper)
    g_first = 2.0 * (u_abs * u_first + v_abs * v_first)
    g_second = 2.0 * (
        u_first * u_first
        + u_abs * u_second
        + v_first * v_first
        + v_abs * v_second
    )
    z_first = g_first / (2.0 * z_lower)
    z_second = (
        g_second / (2.0 * z_lower)
        + (g_first * g_first) / (4.0 * z_lower**3)
    )
    first_norm = math.sqrt(u_first**2 + v_first**2 + z_first**2)
    second_norm = math.sqrt(u_second**2 + v_second**2 + z_second**2)
    return {
        "radialSquareUpper": radial_square_upper,
        "zLower": z_lower,
        "firstDerivativeNormPerDay": first_norm,
        "secondDerivativeNormPerDaySquared": second_norm,
    }


def cross(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def norm(v: tuple[float, float, float]) -> float:
    return math.sqrt(sum(value * value for value in v))


def main() -> None:
    source_path = Path(os.environ.get("SWISS_SOURCE", "tmp/swisseph/swephlib.c"))
    output_dir = Path(os.environ.get("OUTPUT_DIR", "tmp/swiss-vondrak-precession-bound-4006"))
    output_dir.mkdir(parents=True, exist_ok=True)
    source = source_path.read_text(encoding="utf-8")

    if not re.search(
        r"#define\s+SEMOD_PREC_DEFAULT\s+SEMOD_PREC_VONDRAK_2011", source
    ):
        raise RuntimeError("pinned Swiss source no longer defaults to Vondrak 2011")
    required_fragments = (
        "pre_pequ(tjd, peqr);",
        "pre_pecl(tjd, pecl);",
        "swi_cross_prod(peqr, pecl, v);",
        "return precess_3(R, J, direction, iflag, SEMOD_PREC_VONDRAK_2011);",
    )
    for fragment in required_fragments:
        if fragment not in source:
            raise RuntimeError(f"missing expected Swiss precession structure: {fragment}")

    xypol = parse_matrix(source, "xypol")
    xyper = parse_matrix(source, "xyper")
    pqpol = parse_matrix(source, "pqpol")
    pqper = parse_matrix(source, "pqper")
    if [len(xypol), len(xyper), len(pqpol), len(pqper)] != [4, 5, 4, 5]:
        raise RuntimeError("unexpected Vondrak coefficient table shape")

    t0 = (START_ET_JD - J2000) / CENTURY_DAYS
    t1 = (END_ET_JD - J2000) / CENTURY_DAYS
    tm = 0.5 * (t0 + t1)
    t_abs_max = max(abs(t0), abs(t1))
    half_span_days = 0.5 * (END_ET_JD - START_ET_JD)

    xpoly = [row[0] for row in xypol]
    ypoly = [row[1] for row in xypol]
    ppoly = [row[0] for row in pqpol]
    qpoly = [row[1] for row in pqpol]

    x_mid = component_value(tm, xpoly, xyper, 1, 3)
    y_mid = component_value(tm, ypoly, xyper, 2, 4)
    p_mid = component_value(tm, ppoly, pqper, 1, 3)
    q_mid = component_value(tm, qpoly, pqper, 2, 4)

    x_first, x_second = component_derivative_bounds(t_abs_max, xpoly, xyper, 1, 3)
    y_first, y_second = component_derivative_bounds(t_abs_max, ypoly, xyper, 2, 4)
    p_first, p_second = component_derivative_bounds(t_abs_max, ppoly, pqper, 1, 3)
    q_first, q_second = component_derivative_bounds(t_abs_max, qpoly, pqper, 2, 4)

    x_abs = component_enclosure(x_mid, x_first, half_span_days)
    y_abs = component_enclosure(y_mid, y_first, half_span_days)
    p_abs = component_enclosure(p_mid, p_first, half_span_days)
    q_abs = component_enclosure(q_mid, q_first, half_span_days)

    equator = pole_derivative_bounds(x_abs, y_abs, x_first, y_first, x_second, y_second)
    ecliptic = pole_derivative_bounds(p_abs, q_abs, p_first, q_first, p_second, q_second)

    def equator_pole(jd: float) -> tuple[float, float, float]:
        t = (jd - J2000) / CENTURY_DAYS
        x = component_value(t, xpoly, xyper, 1, 3)
        y = component_value(t, ypoly, xyper, 2, 4)
        z2 = 1.0 - x * x - y * y
        if z2 <= 0.0:
            raise RuntimeError("equator pole left unit sphere")
        return (x, y, math.sqrt(z2))

    def ecliptic_pole(jd: float) -> tuple[float, float, float]:
        t = (jd - J2000) / CENTURY_DAYS
        p = component_value(t, ppoly, pqper, 1, 3)
        q = component_value(t, qpoly, pqper, 2, 4)
        z2 = 1.0 - p * p - q * q
        if z2 <= 0.0:
            raise RuntimeError("ecliptic pole left unit sphere")
        z = math.sqrt(z2)
        s = math.sin(EPS0)
        c = math.cos(EPS0)
        return (p, -q * c - z * s, -q * s + z * c)

    span_days = END_ET_JD - START_ET_JD
    sample_intervals = math.ceil(span_days / MAX_SAMPLE_STEP_DAYS)
    sample_step_days = span_days / sample_intervals
    cover_radius_days = 0.5 * sample_step_days
    min_sample_cross_norm = math.inf
    for i in range(sample_intervals + 1):
        jd = START_ET_JD + sample_step_days * i
        qp = equator_pole(jd)
        ep = ecliptic_pole(jd)
        min_sample_cross_norm = min(min_sample_cross_norm, norm(cross(qp, ep)))

    q1 = equator["firstDerivativeNormPerDay"]
    q2 = equator["secondDerivativeNormPerDaySquared"]
    e1 = ecliptic["firstDerivativeNormPerDay"]
    e2 = ecliptic["secondDerivativeNormPerDaySquared"]
    cross_first = q1 + e1
    cross_second = q2 + e2 + 2.0 * q1 * e1
    hard_cross_norm_lower = (
        min_sample_cross_norm
        - cross_first * cover_radius_days
        - FLOATING_POINT_SLACK
    )
    if not hard_cross_norm_lower > 0.0:
        raise RuntimeError("failed to prove nonzero equator/ecliptic pole cross product")

    # n = c / |c|.  The first derivative projection formula gives |n'|<=|c'|/r.
    # A deliberately conservative twice-differentiated normalization inequality is
    # |n''| <= 2|c''|/r + 6|c'|^2/r^2.
    eqx_first = cross_first / hard_cross_norm_lower
    eqx_second = (
        2.0 * cross_second / hard_cross_norm_lower
        + 6.0 * cross_first * cross_first / (hard_cross_norm_lower**2)
    )

    # Swiss matrix rows: eqx, peqr x eqx, peqr.
    middle_first = q1 + eqx_first
    middle_second = q2 + eqx_second + 2.0 * q1 * eqx_first
    matrix_first_frobenius = math.sqrt(eqx_first**2 + middle_first**2 + q1**2)
    matrix_second_frobenius = math.sqrt(eqx_second**2 + middle_second**2 + q2**2)

    manifest = {
        "targetYear": TARGET_YEAR,
        "method": "swiss-vondrak-2011-precession-matrix-analytic-envelope-v1",
        "domain": {
            "startEtJd": START_ET_JD,
            "endEtJd": END_ET_JD,
            "startCenturyFromJ2000": t0,
            "endCenturyFromJ2000": t1,
        },
        "source": {
            "defaultModel": "SEMOD_PREC_VONDRAK_2011",
            "coefficientTablesParsedFromPinnedSwephlib": ["xypol", "xyper", "pqpol", "pqper"],
            "coefficientTableShapes": {
                "xypol": [len(xypol), len(xypol[0])],
                "xyper": [len(xyper), len(xyper[0])],
                "pqpol": [len(pqpol), len(pqpol[0])],
                "pqper": [len(pqper), len(pqper[0])],
            },
        },
        "componentEnvelopes": {
            "equatorX": {"absUpper": x_abs, "firstAbsPerDay": x_first, "secondAbsPerDaySquared": x_second},
            "equatorY": {"absUpper": y_abs, "firstAbsPerDay": y_first, "secondAbsPerDaySquared": y_second},
            "eclipticP": {"absUpper": p_abs, "firstAbsPerDay": p_first, "secondAbsPerDaySquared": p_second},
            "eclipticQ": {"absUpper": q_abs, "firstAbsPerDay": q_first, "secondAbsPerDaySquared": q_second},
        },
        "poleHardBounds": {"equator": equator, "ecliptic": ecliptic},
        "crossProductHardBounds": {
            "sampleStepDays": sample_step_days,
            "sampleCoverRadiusDays": cover_radius_days,
            "minSampledNorm": min_sample_cross_norm,
            "crossFirstDerivativeNormPerDay": cross_first,
            "crossSecondDerivativeNormPerDaySquared": cross_second,
            "hardNormLower": hard_cross_norm_lower,
            "floatingPointSlack": FLOATING_POINT_SLACK,
        },
        "precessionMatrixHardBounds": {
            "firstDerivativeFrobeniusPerDay": matrix_first_frobenius,
            "secondDerivativeFrobeniusPerDaySquared": matrix_second_frobenius,
            "firstDerivativeOperatorNormPerDay": matrix_first_frobenius,
            "secondDerivativeOperatorNormPerDaySquared": matrix_second_frobenius,
            "operatorNormUsesFrobeniusUpperBound": True,
        },
        "transferInequality": {
            "position": "|R x| = |x|",
            "velocity": "|(R x)'| <= |x'| + ||R'|| |x|",
            "acceleration": "|(R x)''| <= |x''| + 2 ||R'|| |x'| + ||R''|| |x|",
        },
        "interpretation": {
            "sourceDerivedContinuousBound": True,
            "vondrakCoefficientDerivativeBoundsAnalytic": True,
            "poleDerivativeBoundsAnalytic": True,
            "crossProductNonSingularityContinuous": True,
            "precessionMatrixFirstDerivativeCertified": True,
            "precessionMatrixSecondDerivativeCertified": True,
            "precessionRaCorrectionCertified": False,
            "apparentPositionCorrectionChainCertified": False,
            "longTermSiderealSecondDerivativeCertified": False,
            "swissEotSecondDerivativeCertified": False,
            "continuousResidualUpperBound": False,
            "deterministicMembership": False,
            "recurrenceAuthorityGranted": False,
        },
    }
    out = output_dir / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
