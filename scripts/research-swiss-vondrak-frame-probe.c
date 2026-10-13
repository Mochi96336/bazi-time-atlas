#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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
  swe_set_ephe_path(NULL);

  /*
   * Pin the long- and short-term precession slots to Vondrak 2011 and the
   * frame-bias slot to IAU 2006.  Nutation is deliberately not applied here:
   * this probe is only the long-term mean-ecliptic-of-date bridge.
   *
   * Astro-model order:
   *   DeltaT, long prec, short prec, nutation, bias, JPLHORA, JPLHOR, sidereal
   */
  char astro_models[] = "5,9,9,4,3,0,0,4";
  swe_set_astro_models(astro_models, 0);

  if (argc != 5) {
    fprintf(
      stderr,
      "usage: %s <mode:mean|mean-no-bias> <tt-jd> <icrf-ra-deg> <icrf-dec-deg>\n",
      argv[0]
    );
    return 2;
  }

  const char *mode = argv[1];
  const int apply_bias = strcmp(mode, "mean") == 0;
  if (!apply_bias && strcmp(mode, "mean-no-bias") != 0) {
    fprintf(stderr, "unknown mode: %s\n", mode);
    return 2;
  }

  const double tt_jd = parse_number(argv[2], "tt-jd");
  const double ra = parse_number(argv[3], "ra") * M_PI / 180.0;
  const double dec = parse_number(argv[4], "dec") * M_PI / 180.0;
  const double cos_dec = cos(dec);

  double vector[6] = {
    cos_dec * cos(ra),
    cos_dec * sin(ra),
    sin(dec),
    0.0, 0.0, 0.0
  };

  /*
   * REBOUND/DE441 states are in ICRF.  Swiss's generic precession path expects
   * the J2000 dynamical-equator input after the ICRS frame-bias step, unlike
   * the special JPLHOR path used by the existing Owen proof.
   */
  const int32 iflag = 0;
  if (apply_bias) {
    swi_bias(vector, tt_jd, iflag, FALSE);
  }

  if (swi_precess(vector, tt_jd, iflag, J2000_TO_J) != 0) {
    fprintf(stderr, "swi_precess failed\n");
    return 3;
  }

  const double obliquity = swi_epsiln(tt_jd, iflag);
  swi_coortrf(vector, vector, obliquity);

  const double longitude = normalized_degrees(atan2(vector[1], vector[0]));
  const double latitude =
    atan2(vector[2], hypot(vector[0], vector[1])) * 180.0 / M_PI;

  printf(
    "%.12f %.12f %.12f\n",
    longitude,
    latitude,
    obliquity * 180.0 / M_PI
  );
  return 0;
}
