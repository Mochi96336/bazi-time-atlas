#!/usr/bin/env python3
import json
import os
import sys

import swisseph as swe


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

        # Swiss Ephemeris documents swe_time_equ() as taking ET/TT, while
        # deltat_ex() takes UT. Keep the scale conversion explicit so the
        # reference and aligned production path evaluate the same ephemeris
        # instant. FLG_SWIEPH also binds Delta-T to the selected ephemeris
        # context instead of relying on the legacy automatic guess.
        delta_t_days = float(swe.deltat_ex(jd_ut, swe.FLG_SWIEPH))
        jd_et = jd_ut + delta_t_days
        equation_days = float(swe.time_equ(jd_et))

        _, retflags = swe.calc_ut(jd_ut, swe.SUN, swe.FLG_SWIEPH)
        ephemeris_flag = int(retflags & ephe_mask)
        ephemeris_flags.add(ephemeris_flag)
        if ephemeris_flag != swe.FLG_SWIEPH:
            raise RuntimeError(
                f"Swiss Ephemeris did not use SWIEPH data at "
                f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}; "
                f"retflags={retflags}, ephemeris_flag={ephemeris_flag}"
            )

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
                "ephemerisFlag": ephemeris_flag,
            }
        )

    json.dump(
        {
            "library": "Swiss Ephemeris",
            "version": swe.version,
            "equationOfTimeFunction": "swe_time_equ",
            "deltaTFunction": "swe_deltat_ex(FLG_SWIEPH)",
            "signConvention": "local-apparent-time-minus-local-mean-time",
            "sampleTimeScale": "UT",
            "equationInputTimeScale": "ET/TT",
            "ephemerisPath": ephe_path,
            "ephemerisFlags": sorted(ephemeris_flags),
            "rows": rows,
        },
        sys.stdout,
        separators=(",", ":"),
    )


if __name__ == "__main__":
    main()
