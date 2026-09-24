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
  /*
   * Horizons quantity #31 uses the IAU76/80 Earth ecliptic-of-date system.
   * Swiss 2.06 defaults to IAU2000B nutation, so pin N1 (IAU1980/Wahr)
   * explicitly while leaving the other current model slots unchanged.
   * The JPLHOR flag below still owns the long-term Owen precession override.
   */
  char astro_models[] = "5,9,9,1,3,0,0,4";
  swe_set_astro_models(astro_models, 0);

  if (argc != 7) {
    fprintf(stderr, "usage: %s <mode:mean|apparent> <tt-jd> <icrf-ra-deg> <icrf-dec-deg> <eop-dpsi-arcsec> <eop-deps-arcsec>\n", argv[0]);
    return 2;
  }
  const char *mode = argv[1];
  const int apply_bias = strstr(mode, "with-bias") != NULL || strstr(mode, "reverse-bias") != NULL;
  const int reverse_bias = strstr(mode, "reverse-bias") != NULL;
  const int apparent_mode = strstr(mode, "apparent") != NULL;

  const double tt_jd = parse_number(argv[2], "tt-jd");
  const double ra = parse_number(argv[3], "ra") * M_PI / 180.0;
  const double dec = parse_number(argv[4], "dec") * M_PI / 180.0;
  const double eop_dpsi_arcsec = parse_number(argv[5], "eop-dpsi-arcsec");
  const double eop_deps_arcsec = parse_number(argv[6], "eop-deps-arcsec");
  const double cos_dec = cos(dec);

  double vector[6] = {
    cos_dec * cos(ra),
    cos_dec * sin(ra),
    sin(dec),
    0.0, 0.0, 0.0
  };

  /*
   * Horizons quantity #45 is an ICRF apparent direction. The JPLHOR flag is used
   * here only to select pinned Swiss's documented long-term Horizons frame
   * geometry: Owen 1990 outside 1799–2202 plus its source-defined longitude
   * alignment. Nutation itself is evaluated explicitly below to avoid the
   * EOP-backed global cache path.
   */
  const int32 iflag = SEFLG_JPLHOR;
  /*
   * Full Swiss JPLHOR forces SEFLG_ICRS and therefore skips the ICRS->J2000
   * frame-bias rotation before precession. Horizons quantity #45 is already an
   * inertial ICRF apparent direction. Bias variants remain diagnostic only.
   */
  if (apply_bias) {
    swi_bias(vector, tt_jd, iflag, reverse_bias ? TRUE : FALSE);
  }
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
  if (
    strcmp(mode, "mean") != 0
    && strcmp(mode, "apparent") != 0
    && strcmp(mode, "apparent-with-bias") != 0
    && strcmp(mode, "apparent-reverse-bias") != 0
  ) {
    fprintf(stderr, "unknown mode: %s\n", mode);
    return 2;
  }

  /*
   * Reproduce Swiss app_pos_rest() explicitly without touching its global
   * nutation cache. The previous longitude += dpsi shortcut omitted the full
   * equatorial nutation matrix and the post-ecliptic deps rotation.
   *
   * Horizons #31 uses apparent longitude in the IAU76/80 ecliptic-of-date
   * system. We therefore:
   *   1. evaluate pinned Swiss's IAU1980 base nutation;
   *   2. add the source-pinned terminal IERS dpsi/deps correction. Pinned
   *      Swiss's full JPLHOR path holds the terminal EOP correction constant
   *      when the requested date lies beyond the loaded table;
   *   3. build the same nut_matrix() as pinned Swiss;
   *   4. apply the matrix to mean equatorial-of-date;
   *   5. rotate by mean obliquity and then by deps, matching app_pos_rest().
   */
  const double obliquity = swi_epsiln(tt_jd, iflag);
  if (apparent_mode) {
    if (swi_nutation(tt_jd, 0, nutation) != 0) {
      fprintf(stderr, "swi_nutation failed\n");
      return 4;
    }
    const double arcsec_to_radians = M_PI / (180.0 * 3600.0);
    nutation[0] += eop_dpsi_arcsec * arcsec_to_radians;
    nutation[1] += eop_deps_arcsec * arcsec_to_radians;

    const double psi = nutation[0];
    const double eps = obliquity + nutation[1];
    const double sinpsi = sin(psi);
    const double cospsi = cos(psi);
    const double sineps0 = sin(obliquity);
    const double coseps0 = cos(obliquity);
    const double sineps = sin(eps);
    const double coseps = cos(eps);
    double matrix[3][3];

    matrix[0][0] = cospsi;
    matrix[0][1] = sinpsi * coseps;
    matrix[0][2] = sinpsi * sineps;
    matrix[1][0] = -sinpsi * coseps0;
    matrix[1][1] = cospsi * coseps * coseps0 + sineps * sineps0;
    matrix[1][2] = cospsi * sineps * coseps0 - coseps * sineps0;
    matrix[2][0] = -sinpsi * sineps0;
    matrix[2][1] = cospsi * coseps * sineps0 - sineps * coseps0;
    matrix[2][2] = cospsi * sineps * sineps0 + coseps * coseps0;

    double nutated[3];
    for (int i = 0; i < 3; i++) {
      nutated[i] = vector[0] * matrix[0][i]
        + vector[1] * matrix[1][i]
        + vector[2] * matrix[2][i];
    }
    for (int i = 0; i < 3; i++) vector[i] = nutated[i];
  }

  swi_coortrf(vector, vector, obliquity);
  if (apparent_mode) {
    swi_coortrf(vector, vector, nutation[1]);
  }

  const double longitude = normalized_degrees(atan2(vector[1], vector[0]));
  const double latitude = atan2(vector[2], hypot(vector[0], vector[1])) * 180.0 / M_PI;

  printf("%.12f %.12f %.12f\n", longitude, latitude, obliquity * 180.0 / M_PI);
  return 0;
}
