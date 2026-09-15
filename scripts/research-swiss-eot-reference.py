#!/usr/bin/env python3
import json
import os
import sys

import swisseph as swe


def require_swieph(jd_ut: float, body: int, body_name: str, ephe_mask: int, label: str) -> int:
    _, retflags = swe.calc_ut(jd_ut, body, swe.FLG_SWIEPH)
    ephemeris_flag = int(retflags & ephe_mask)
    if ephemeris_flag != swe.FLG_SWIEPH:
        raise RuntimeError(
            f"Swiss Ephemeris did not use SWIEPH for {body_name} at {label}; "
            f"retflags={retflags}, ephemeris_flag={ephemeris_flag}"
        )
    return ephemeris_flag


def main() -> None:
    ephe_path = os.environ.get("SWISSEPH_EPHE_PATH")
    if not ephe_path:
        raise RuntimeError("SWISSEPH_EPHE_PATH is required")
    swe.set_ephe_path(ephe_path)

    samples = json.load(sys.stdin)
    if not isinstance(samples, list) or not samples:
        raise RuntimeError("expected a non-empty JSON sample array on stdin")

    ephe_mask = swe.FLG_JPLEPH | swe.FLG_SWIEPH | swe.FLG_MOSEPH
    rows = []
    ephemeris_flags = set()

    for sample in samples:
        year = int(sample["year"])
        month = int(sample["month"])
        day = int(sample["day"])
        hour = int(sample["hour"])
        minute = int(sample.get("minute", 0))
        second = float(sample.get("second", 0))
        if not 0 <= hour <= 23:
            raise RuntimeError(f"hour out of range: {hour}")
        if not 0 <= minute <= 59:
            raise RuntimeError(f"minute out of range: {minute}")
        if not 0 <= second < 60:
            raise RuntimeError(f"second out of range: {second}")

        decimal_hour = hour + minute / 60.0 + second / 3600.0
        jd_ut = swe.julday(year, month, day, decimal_hour, swe.GREG_CAL)
        label = f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}"

        # Swiss Ephemeris' public C implementation declares swe_time_equ()
        # with a tjd_ut argument, and swetest passes its UT variable directly.
        # Verify both planetary and lunar SWIEPH files are actually active
        # before evaluating the reference; missing data must never silently
        # fall back to Moshier for this deep-time capture.
        sun_ephemeris_flag = require_swieph(jd_ut, swe.SUN, "Sun", ephe_mask, label)
        moon_ephemeris_flag = require_swieph(jd_ut, swe.MOON, "Moon", ephe_mask, label)
        ephemeris_flags.add(sun_ephemeris_flag)
        ephemeris_flags.add(moon_ephemeris_flag)

        equation_days = float(swe.time_equ(jd_ut))
        delta_t_days = float(swe.deltat_ex(jd_ut, swe.FLG_SWIEPH))
        jd_et = jd_ut + delta_t_days

        rows.append(
            {
                "year": year,
                "month": month,
                "day": day,
                "hour": hour,
                "minute": minute,
                "second": second,
                "julianDayUt": jd_ut,
                "julianDayEt": jd_et,
                "equationOfTimeMinutes": equation_days * 1440.0,
                "deltaTSeconds": delta_t_days * 86400.0,
                "sunEphemerisFlag": sun_ephemeris_flag,
                "moonEphemerisFlag": moon_ephemeris_flag,
            }
        )

    json.dump(
        {
            "library": "Swiss Ephemeris",
            "version": swe.version,
            "equationOfTimeFunction": "swe_time_equ(tjd_ut)",
            "deltaTFunction": "swe_deltat_ex(tjd_ut, FLG_SWIEPH)",
            "signConvention": "local-apparent-time-minus-local-mean-time",
            "inputTimeScale": "UT",
            "sampleTimeScale": "UT",
            "equationInputTimeScale": "UT",
            "ephemerisPath": ephe_path,
            "ephemerisFlags": sorted(ephemeris_flags),
            "rows": rows,
        },
        sys.stdout,
        separators=(",", ":"),
    )


if __name__ == "__main__":
    main()
