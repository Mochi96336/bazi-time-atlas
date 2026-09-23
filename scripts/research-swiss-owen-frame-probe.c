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
  /*
   * The low-level Swiss frame helpers read the shared swed model state.
   * Initialise that state through the public API before calling swi_bias /
   * swi_precess / nutation helpers directly. No ephemeris body calculation
   * is performed by this probe.
   */
  swe_set_ephe_path(NULL);

  if (argc != 5) {
    fprintf(stderr, "usage: %s <mode:mean|apparent> <tt-jd> <icrf-ra-deg> <icrf-dec-deg>\n", argv[0]);
    return 2;
  }
  const char *mode = argv[1];

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
   * Horizons quantity #45 is ICRF apparent direction. Swiss's Horizons-compatible path converts ICRS/GCRS directions to
   * dynamical J2000 before its long-term precession stage. Use the explicit
   * JPLHOR_APPROX model because this standalone frame probe has no EOP files
   * and must not enter the EOP-backed JPLHOR cache path.
   */
  const int32 iflag = SEFLG_JPLHOR_APPROX;
  fprintf(stderr, "stage=bias\n");
  fflush(stderr);
  swi_bias(vector, tt_jd, iflag, FALSE);
  fprintf(stderr, "stage=precess\n");
  fflush(stderr);
  if (swi_precess(vector, tt_jd, iflag, J2000_TO_J) != 0) {
    fprintf(stderr, "swi_precess failed\n");
    return 3;
  }

  /*
   * Both modes use Owen's long-term mean equator/ecliptic geometry.
   *
   * "mean" stops at the mean equator-of-date before rotating to the mean
   * ecliptic. "apparent" mirrors Swiss app_pos_rest(): it applies the JPLHOR
   * IAU80 nutation matrix to the already-apparent ICRF direction, then rotates
   * by mean obliquity and the nutation-in-obliquity term. This tests whether
   * Horizons quantity #31's apparent longitude uses the apparent equinox even
   * though the seasonal plane itself is the mean ecliptic-of-date plane.
   */
  double nutation[2] = {0.0, 0.0};
  if (strcmp(mode, "apparent") != 0 && strcmp(mode, "mean") != 0) {
    fprintf(stderr, "unknown mode: %s\n", mode);
    return 2;
  }

  /*
   * Keep the seasonal plane on Owen's mean ecliptic-of-date. Horizons
   * quantity #31 is apparent longitude, so test the apparent equinox
   * separately through nutation in longitude instead of invoking Swiss's
   * cached JPLHOR nutation matrix path (which requires full EOP runtime
   * initialization and is not a standalone frame helper).
   */
  if (strcmp(mode, "apparent") == 0) {
    if (swi_nutation(tt_jd, iflag, nutation) != 0) {
      fprintf(stderr, "swi_nutation failed\n");
      return 4;
    }
  }

  const double obliquity = swi_epsiln(tt_jd, iflag);
  swi_coortrf(vector, vector, obliquity);

  double longitude = normalized_degrees(atan2(vector[1], vector[0]));
  if (strcmp(mode, "apparent") == 0) {
    longitude = fmod(longitude + nutation[0] * 180.0 / M_PI, 360.0);
    if (longitude < 0.0) longitude += 360.0;
  }
  const double latitude = atan2(vector[2], hypot(vector[0], vector[1])) * 180.0 / M_PI;

  printf("%.12f %.12f %.12f\n", longitude, latitude, obliquity * 180.0 / M_PI);
  return 0;
}
