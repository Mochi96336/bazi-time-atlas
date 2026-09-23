#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#include "swephexp.h"
#include "sweph.h"
#include "swephlib.h"

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static double parse_number(const char *text, const char *name) {
  char *end = NULL;
  errno = 0;
  double value = strtod(text, &end);
  if (errno != 0 || end == text || *end != '\0' || !isfinite(value)) {
    fprintf(stderr, "%s must be finite: %s\n", name, text);
    exit(2);
  }
  return value;
}

static double normalized_degrees(double radians) {
  double degrees = radians * 180.0 / M_PI;
  degrees = fmod(degrees, 360.0);
  if (degrees < 0.0) degrees += 360.0;
  return degrees;
}

int main(int argc, char **argv) {
  if (argc != 4) {
    fprintf(stderr, "usage: %s <tt-jd> <icrf-ra-deg> <icrf-dec-deg>\n", argv[0]);
    return 2;
  }

  const double tt_jd = parse_number(argv[1], "tt-jd");
  const double ra = parse_number(argv[2], "ra") * M_PI / 180.0;
  const double dec = parse_number(argv[3], "dec") * M_PI / 180.0;
  const double cos_dec = cos(dec);

  double vector[6] = {
    cos_dec * cos(ra),
    cos_dec * sin(ra),
    sin(dec),
    0.0, 0.0, 0.0
  };

  /*
   * Horizons quantity #45 is ICRF apparent direction. Swiss's JPL ephemeris
   * pipeline converts ICRS/GCRS directions to dynamical J2000 before its
   * JPLHOR precession stage, so reproduce that exact frame-only path here.
   */
  const int32 iflag = SEFLG_JPLHOR | SEFLG_NONUT;
  swi_bias(vector, tt_jd, iflag, FALSE);
  if (swi_precess(vector, tt_jd, iflag, J2000_TO_J) != 0) {
    fprintf(stderr, "swi_precess failed\n");
    return 3;
  }

  /*
   * Earth seasonal longitude uses the mean ecliptic-of-date plane. Do not
   * apply nutation here. For dates beyond the IAU76 short-term window,
   * SEFLG_JPLHOR makes both precession and obliquity use Owen's long-term
   * Horizons-compatible model.
   */
  const double obliquity = swi_epsiln(tt_jd, iflag);
  swi_coortrf(vector, vector, obliquity);

  const double longitude = normalized_degrees(atan2(vector[1], vector[0]));
  const double latitude = atan2(vector[2], hypot(vector[0], vector[1])) * 180.0 / M_PI;

  printf("%.12f %.12f %.12f\n", longitude, latitude, obliquity * 180.0 / M_PI);
  return 0;
}
