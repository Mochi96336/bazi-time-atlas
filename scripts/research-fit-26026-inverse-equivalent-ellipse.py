#!/usr/bin/env python3
"""Inverse-fit an equivalent Kepler ellipse from the merged #572 timing curve.

This research lane asks a deliberately narrower question than a full orbital
reconstruction:

    If all we retain is the time at which the apparent solar longitude crosses
    each integer degree, how much of the within-year timing shape can be
    represented by a single Kepler-like ellipse?

The inversion uses Kepler's second law.  For a central-force ellipse,

    r^2 d(theta)/dt = constant,

so adjacent crossing intervals provide an effective radial profile

    r_eff(theta) proportional to sqrt(dt/dtheta).

The normalized radial samples are then fit to

    r(theta) = p / (1 + e cos(theta - varpi)).

The reciprocal form is linear:

    1/r = A + B cos(theta) + C sin(theta),

which makes the fit deterministic and avoids a nonlinear optimizer.

The result is explicitly an *equivalent timing ellipse*, not a claim that the
deep-time N-body trajectory has become an exact two-body ellipse.  For the
target year, the timing inversion is independently checked against the actual
Earth-Sun range in the #572 continuous N-body state window.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np

SECONDS_PER_DAY = 86400.0
AU_KM = 149_597_870.7
J2000_JULIAN_DAY = 2451545.0

# Exact constants mirrored from src/astronomy/naif-tt-tdb-time-bridge.js.
NAIF_K_SECONDS = 1.657e-3
NAIF_EB = 1.671e-2
NAIF_M0 = 6.239996
NAIF_M1 = 1.99096871e-7
NAIF_FIXED_POINT_ITERATIONS = 6

EXPECTED_CROSSINGS = 360
EXPECTED_INTERVALS = 359
TARGET_YEAR = 26026
BASE_YEAR = 2026


def circular_difference_degrees(left: float, right: float) -> float:
    return abs((left - right + 180.0) % 360.0 - 180.0)


def tt_jd_to_tdb_jd(tt_jd: float) -> float:
    tt_seconds = (tt_jd - J2000_JULIAN_DAY) * SECONDS_PER_DAY
    tdb_seconds = tt_seconds
    for _ in range(NAIF_FIXED_POINT_ITERATIONS):
        mean_anomaly = NAIF_M0 + NAIF_M1 * tdb_seconds
        eccentric_anomaly = mean_anomaly + NAIF_EB * math.sin(mean_anomaly)
        tdb_seconds = tt_seconds + NAIF_K_SECONDS * math.sin(eccentric_anomaly)
    return J2000_JULIAN_DAY + tdb_seconds / SECONDS_PER_DAY


def unwrap_longitudes(points: list[dict]) -> np.ndarray:
    values = np.asarray([float(point["longitudeDegrees"]) for point in points])
    unwrapped = values.copy()
    for index in range(1, len(unwrapped)):
        while unwrapped[index] <= unwrapped[index - 1]:
            unwrapped[index] += 360.0
    return unwrapped


def interval_profile(longitudes_unwrapped: np.ndarray, times_jd: np.ndarray) -> dict:
    dt_days = np.diff(times_jd)
    if len(dt_days) != EXPECTED_INTERVALS or not np.all(dt_days > 0.0):
        raise RuntimeError("crossing times must be strictly increasing")
    midpoint_degrees = (longitudes_unwrapped[:-1] + longitudes_unwrapped[1:]) / 2.0
    mean_dt = float(np.mean(dt_days))
    normalized_radius = np.sqrt(dt_days / mean_dt)
    return {
        "midpointDegrees": midpoint_degrees,
        "dtDaysPerDegree": dt_days,
        "meanDtDaysPerDegree": mean_dt,
        "normalizedRadius": normalized_radius,
    }


def fit_reciprocal_polar_ellipse(
    midpoint_degrees: np.ndarray,
    radius: np.ndarray,
) -> dict:
    theta = np.deg2rad(midpoint_degrees)
    design = np.column_stack(
        [np.ones_like(theta), np.cos(theta), np.sin(theta)]
    )
    reciprocal = 1.0 / radius
    a, b, c = np.linalg.lstsq(design, reciprocal, rcond=None)[0]

    p = 1.0 / a
    eccentricity = math.hypot(b, c) / a
    perihelion_degrees = math.degrees(math.atan2(c, b)) % 360.0
    model = p / (
        1.0
        + eccentricity
        * np.cos(theta - math.radians(perihelion_degrees))
    )
    residual = radius - model

    return {
        "p": float(p),
        "eccentricity": float(eccentricity),
        "perihelionSolarLongitudeDegrees": float(perihelion_degrees),
        "rmsNormalizedRadius": float(np.sqrt(np.mean(residual**2))),
        "maxAbsNormalizedRadius": float(np.max(np.abs(residual))),
        "modelRadius": model,
        "residualRadius": residual,
    }


def fit_interval_first_harmonic(
    midpoint_degrees: np.ndarray,
    dt_days_per_degree: np.ndarray,
) -> dict:
    theta = np.deg2rad(midpoint_degrees)
    design = np.column_stack(
        [np.ones_like(theta), np.cos(theta), np.sin(theta)]
    )
    constant, cosine, sine = np.linalg.lstsq(
        design, dt_days_per_degree, rcond=None
    )[0]
    amplitude = math.hypot(cosine, sine)
    maximum_dt_phase_degrees = math.degrees(math.atan2(sine, cosine)) % 360.0

    # For small e, dt/dtheta ~= const * (1 - 2 e cos(theta-varpi)).
    eccentricity = amplitude / (2.0 * constant)
    perihelion_degrees = (maximum_dt_phase_degrees + 180.0) % 360.0

    return {
        "meanDaysPerDegree": float(constant),
        "equivalentPeriodDays": float(360.0 * constant),
        "firstHarmonicAmplitudeDaysPerDegree": float(amplitude),
        "smallEccentricityEstimate": float(eccentricity),
        "perihelionSolarLongitudeDegrees": float(perihelion_degrees),
    }


def fit_drift_harmonics(
    longitudes_unwrapped: np.ndarray,
    drift_days: np.ndarray,
    harmonic_count: int,
) -> dict:
    theta = np.deg2rad(longitudes_unwrapped)
    cycle = (longitudes_unwrapped - longitudes_unwrapped[0]) / 360.0

    columns = [np.ones_like(theta), cycle]
    labels = ["constantDays", "cycleSlopeDays"]
    for harmonic in range(1, harmonic_count + 1):
        columns.append(np.cos(harmonic * theta))
        columns.append(np.sin(harmonic * theta))
        labels.append(f"cos{harmonic}Days")
        labels.append(f"sin{harmonic}Days")

    design = np.column_stack(columns)
    coefficients = np.linalg.lstsq(design, drift_days, rcond=None)[0]
    model = design @ coefficients
    residual = drift_days - model

    total_ss = float(np.sum((drift_days - np.mean(drift_days)) ** 2))
    residual_ss = float(np.sum(residual**2))
    r_squared = 1.0 - residual_ss / total_ss

    result = {
        "harmonicCount": harmonic_count,
        "coefficients": {
            label: float(value)
            for label, value in zip(labels, coefficients)
        },
        "rSquared": float(r_squared),
        "rmsResidualMinutes": float(
            np.sqrt(np.mean(residual**2)) * 24.0 * 60.0
        ),
        "maxAbsResidualMinutes": float(
            np.max(np.abs(residual)) * 24.0 * 60.0
        ),
    }
    if harmonic_count >= 1:
        cosine = coefficients[2]
        sine = coefficients[3]
        amplitude_days = math.hypot(cosine, sine)
        result["firstHarmonic"] = {
            "amplitudeDays": float(amplitude_days),
            "peakToPeakHours": float(2.0 * amplitude_days * 24.0),
            "phaseDegrees": float(
                math.degrees(math.atan2(sine, cosine)) % 360.0
            ),
        }
    return result


def hermite_position(
    left: dict,
    right: dict,
    fraction: float,
    step_days: float,
) -> np.ndarray:
    u = fraction
    u2 = u * u
    u3 = u2 * u
    h00 = 2.0 * u3 - 3.0 * u2 + 1.0
    h10 = u3 - 2.0 * u2 + u
    h01 = -2.0 * u3 + 3.0 * u2
    h11 = u3 - u2

    p0 = np.asarray(left["positionAu"], dtype=np.float64)
    p1 = np.asarray(right["positionAu"], dtype=np.float64)
    v0 = np.asarray(left["velocityAuPerDay"], dtype=np.float64)
    v1 = np.asarray(right["velocityAuPerDay"], dtype=np.float64)

    return (
        h00 * p0
        + h10 * step_days * v0
        + h01 * p1
        + h11 * step_days * v1
    )


def earth_sun_range_at_tdb(state_window: dict, tdb_jd: float) -> float:
    start = float(state_window["startTdbJulianDay"])
    end = float(state_window["endTdbJulianDay"])
    step = float(state_window["stepDays"])
    samples = state_window["samples"]

    if not (start <= tdb_jd <= end):
        raise RuntimeError(f"TDB JD {tdb_jd} is outside the state window")

    offset = (tdb_jd - start) / step
    left_index = int(math.floor(offset))
    fraction = offset - left_index

    if left_index >= len(samples) - 1:
        sample = samples[-1]
        earth = np.asarray(sample["earth"]["positionAu"], dtype=np.float64)
        sun = np.asarray(sample["sun"]["positionAu"], dtype=np.float64)
    else:
        left = samples[left_index]
        right = samples[left_index + 1]
        earth = hermite_position(left["earth"], right["earth"], fraction, step)
        sun = hermite_position(left["sun"], right["sun"], fraction, step)

    return float(np.linalg.norm(sun - earth))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeline", required=True, type=Path)
    parser.add_argument("--state", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    timeline = json.loads(args.timeline.read_text())
    state = json.loads(args.state.read_text())

    if timeline.get("researchOnly") is not True:
        raise RuntimeError("timeline must remain research-only")
    if timeline.get("catalogueYear") != TARGET_YEAR:
        raise RuntimeError("unexpected target year")
    if timeline.get("sampling", {}).get("crossingCount") != EXPECTED_CROSSINGS:
        raise RuntimeError("expected the merged #572 360-point timeline")
    if state.get("validation", {}).get("accepted") is not True:
        raise RuntimeError("continuous state window is not accepted")

    points = timeline["curve"]
    longitudes = unwrap_longitudes(points)
    if not np.allclose(np.diff(longitudes), 1.0):
        raise RuntimeError("timeline must advance in exact one-degree steps")

    base_times = np.asarray(
        [point["baseline2026TtJulianDay"] for point in points],
        dtype=np.float64,
    )
    target_times = np.asarray(
        [point["ttJulianDay"] for point in points],
        dtype=np.float64,
    )
    drift_days = np.asarray(
        [point["gregorianCycleDriftDays"] for point in points],
        dtype=np.float64,
    )

    base_profile = interval_profile(longitudes, base_times)
    target_profile = interval_profile(longitudes, target_times)

    base_ellipse = fit_reciprocal_polar_ellipse(
        base_profile["midpointDegrees"],
        base_profile["normalizedRadius"],
    )
    target_ellipse = fit_reciprocal_polar_ellipse(
        target_profile["midpointDegrees"],
        target_profile["normalizedRadius"],
    )

    base_interval_harmonic = fit_interval_first_harmonic(
        base_profile["midpointDegrees"],
        base_profile["dtDaysPerDegree"],
    )
    target_interval_harmonic = fit_interval_first_harmonic(
        target_profile["midpointDegrees"],
        target_profile["dtDaysPerDegree"],
    )

    # Validate the target inverse timing ellipse against the actual N-body
    # Earth-Sun distance sampled at each interval midpoint.
    midpoint_tt = (target_times[:-1] + target_times[1:]) / 2.0
    actual_range_au = np.asarray(
        [
            earth_sun_range_at_tdb(
                state["stateWindow"],
                tt_jd_to_tdb_jd(float(tt_jd)),
            )
            for tt_jd in midpoint_tt
        ],
        dtype=np.float64,
    )
    actual_range_ellipse = fit_reciprocal_polar_ellipse(
        target_profile["midpointDegrees"],
        actual_range_au,
    )

    inferred_radius = target_profile["normalizedRadius"]
    best_scale_au = float(
        np.dot(inferred_radius, actual_range_au)
        / np.dot(inferred_radius, inferred_radius)
    )
    scaled_inferred_au = inferred_radius * best_scale_au
    inverse_vs_state_residual_au = actual_range_au - scaled_inferred_au

    inverse_state_correlation = float(
        np.corrcoef(inferred_radius, actual_range_au)[0, 1]
    )
    inverse_state_rms_km = float(
        np.sqrt(np.mean(inverse_vs_state_residual_au**2)) * AU_KM
    )
    inverse_state_max_km = float(
        np.max(np.abs(inverse_vs_state_residual_au)) * AU_KM
    )

    one_harmonic_drift = fit_drift_harmonics(longitudes, drift_days, 1)
    two_harmonic_drift = fit_drift_harmonics(longitudes, drift_days, 2)

    base_peri = math.radians(
        base_ellipse["perihelionSolarLongitudeDegrees"]
    )
    target_peri = math.radians(
        target_ellipse["perihelionSolarLongitudeDegrees"]
    )
    base_e_vector = np.asarray(
        [
            base_ellipse["eccentricity"] * math.cos(base_peri),
            base_ellipse["eccentricity"] * math.sin(base_peri),
        ]
    )
    target_e_vector = np.asarray(
        [
            target_ellipse["eccentricity"] * math.cos(target_peri),
            target_ellipse["eccentricity"] * math.sin(target_peri),
        ]
    )
    eccentricity_vector_change = float(
        np.linalg.norm(target_e_vector - base_e_vector)
    )

    representative_period_days = (
        base_interval_harmonic["equivalentPeriodDays"]
        + target_interval_harmonic["equivalentPeriodDays"]
    ) / 2.0
    predicted_first_order_amplitude_days = (
        representative_period_days
        / math.pi
        * eccentricity_vector_change
    )
    observed_first_harmonic_amplitude_days = one_harmonic_drift[
        "firstHarmonic"
    ]["amplitudeDays"]
    amplitude_ratio = (
        predicted_first_order_amplitude_days
        / observed_first_harmonic_amplitude_days
    )

    target_e_difference = abs(
        target_ellipse["eccentricity"]
        - actual_range_ellipse["eccentricity"]
    )
    target_peri_difference_degrees = circular_difference_degrees(
        target_ellipse["perihelionSolarLongitudeDegrees"],
        actual_range_ellipse["perihelionSolarLongitudeDegrees"],
    )

    # For visualization, interpolate the eccentricity vector rather than e and
    # varpi independently.  This avoids angular wrap and remains well-behaved
    # if the path passes near a circular orbit.  These are endpoint morph
    # coordinates only; they are not a physical ephemeris for intermediate
    # historical years.
    morph_keyframes = []
    for fraction in (0.0, 0.25, 0.5, 0.75, 1.0):
        vector = (
            (1.0 - fraction) * base_e_vector
            + fraction * target_e_vector
        )
        eccentricity = float(np.linalg.norm(vector))
        perihelion = (
            math.degrees(math.atan2(vector[1], vector[0])) % 360.0
            if eccentricity > 0.0
            else 0.0
        )
        morph_keyframes.append({
            "fraction": fraction,
            "eccentricity": eccentricity,
            "perihelionSolarLongitudeDegrees": perihelion,
            "eccentricityVector": [float(vector[0]), float(vector[1])],
        })

    accepted = (
        target_e_difference < 5e-5
        and target_peri_difference_degrees < 1.0
        and inverse_state_correlation > 0.99
        and one_harmonic_drift["rSquared"] > 0.999
        and one_harmonic_drift["rmsResidualMinutes"] < 30.0
        and two_harmonic_drift["rmsResidualMinutes"] < 5.0
        and 0.98 < amplitude_ratio < 1.02
    )

    result = {
        "schemaVersion": 1,
        "researchOnly": True,
        "question": (
            "how much of the year-26026 seasonal timing deformation can be "
            "represented by an inverse-fit equivalent Kepler ellipse"
        ),
        "source": {
            "timelinePullRequest": 572,
            "timelineMergedMainSha": (
                "3648ade276c965c08951c40ea0490ed8153a4e47"
            ),
            "timelineResolutionDegrees": 1,
            "targetStateStepDays": state["stateWindow"]["stepDays"],
        },
        "method": {
            "inverseLaw": "r_eff proportional to sqrt(dt/dtheta)",
            "fit": "linear reciprocal polar ellipse",
            "fitEquation": "1/r = A + B cos(theta) + C sin(theta)",
            "angleSemantics": "apparent solar longitude",
            "targetRangeValidation": (
                "Hermite-interpolated Earth-Sun ICRF distance at interval "
                "midpoint, with the repo NAIF TT-to-TDB approximation"
            ),
        },
        "baseline2026EquivalentEllipse": {
            key: value
            for key, value in base_ellipse.items()
            if key not in {"modelRadius", "residualRadius"}
        },
        "target26026EquivalentEllipse": {
            key: value
            for key, value in target_ellipse.items()
            if key not in {"modelRadius", "residualRadius"}
        },
        "target26026ActualRangeEllipse": {
            key: value
            for key, value in actual_range_ellipse.items()
            if key not in {"modelRadius", "residualRadius"}
        },
        "intervalFirstHarmonic": {
            "baseline2026": base_interval_harmonic,
            "target26026": target_interval_harmonic,
        },
        "inverseValidationAgainstTargetState": {
            "eccentricityAbsoluteDifference": target_e_difference,
            "perihelionDifferenceDegrees": target_peri_difference_degrees,
            "radiusProfileCorrelation": inverse_state_correlation,
            "bestScaleAu": best_scale_au,
            "rmsScaledRadiusResidualKm": inverse_state_rms_km,
            "maxScaledRadiusResidualKm": inverse_state_max_km,
        },
        "driftDecomposition": {
            "actualPeakToPeakHours": (
                float(np.ptp(drift_days)) * 24.0
            ),
            "oneHarmonicPlusLinearTrend": one_harmonic_drift,
            "twoHarmonicsPlusLinearTrend": two_harmonic_drift,
            "eccentricityVectorChange": eccentricity_vector_change,
            "representativePeriodDays": representative_period_days,
            "firstOrderEllipseDifferencePrediction": {
                "amplitudeDays": predicted_first_order_amplitude_days,
                "peakToPeakHours": (
                    2.0 * predicted_first_order_amplitude_days * 24.0
                ),
                "ratioToObservedFirstHarmonicAmplitude": amplitude_ratio,
            },
        },
        "visualizationMorphContract": {
            "shapeCoordinates": "eccentricity vector [e cos(varpi), e sin(varpi)]",
            "interpolation": "v(s) = (1-s) v_2026 + s v_26026",
            "keyframes": morph_keyframes,
            "commonPhaseOffsetDays": float(np.mean(drift_days)),
            "phaseMustRemainSeparateFromEllipseShape": True,
            "physicalIntermediateYearsClaimed": False,
        },
        "summary": {
            "accepted": accepted,
            "baselineEquivalentEccentricity": (
                base_ellipse["eccentricity"]
            ),
            "targetEquivalentEccentricity": (
                target_ellipse["eccentricity"]
            ),
            "baselineEquivalentPerihelionSolarLongitudeDegrees": (
                base_ellipse["perihelionSolarLongitudeDegrees"]
            ),
            "targetEquivalentPerihelionSolarLongitudeDegrees": (
                target_ellipse["perihelionSolarLongitudeDegrees"]
            ),
            "targetActualRangeEccentricity": (
                actual_range_ellipse["eccentricity"]
            ),
            "targetActualRangePerihelionSolarLongitudeDegrees": (
                actual_range_ellipse["perihelionSolarLongitudeDegrees"]
            ),
            "oneHarmonicExplainedVariance": (
                one_harmonic_drift["rSquared"]
            ),
            "oneHarmonicRmsResidualMinutes": (
                one_harmonic_drift["rmsResidualMinutes"]
            ),
            "twoHarmonicRmsResidualMinutes": (
                two_harmonic_drift["rmsResidualMinutes"]
            ),
        },
        "claimBoundary": {
            "equivalentTimingEllipseResolved": accepted,
            "trueOsculatingElementsClaimed": False,
            "twoBodyExactnessClaimed": False,
            "apparentLongitudeUsedAsTrueAnomaly": False,
            "targetStateRangeUsedForIndependentShapeCheck": True,
            "productionAuthorityGranted": False,
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    print(
        json.dumps(
            {
                "accepted": accepted,
                "baseline": {
                    "e": result["summary"][
                        "baselineEquivalentEccentricity"
                    ],
                    "perihelionSolarLongitudeDegrees": result["summary"][
                        "baselineEquivalentPerihelionSolarLongitudeDegrees"
                    ],
                },
                "target": {
                    "e": result["summary"]["targetEquivalentEccentricity"],
                    "perihelionSolarLongitudeDegrees": result["summary"][
                        "targetEquivalentPerihelionSolarLongitudeDegrees"
                    ],
                },
                "targetActualRange": {
                    "e": result["summary"]["targetActualRangeEccentricity"],
                    "perihelionSolarLongitudeDegrees": result["summary"][
                        "targetActualRangePerihelionSolarLongitudeDegrees"
                    ],
                },
                "inverseValidation": result[
                    "inverseValidationAgainstTargetState"
                ],
                "driftDecomposition": result["driftDecomposition"],
            },
            indent=2,
        )
    )

    if not accepted:
        raise RuntimeError("inverse equivalent ellipse research gates failed")


if __name__ == "__main__":
    main()
