#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "swephexp.h"
#include "sweph.h"
#include "swephlib.h"

/*
 * This research probe intentionally compiles the pinned Swiss swephlib.c into
 * the same translation unit.  That gives the probe access to Swiss's static
 * Vondrak pre_pequ()/pre_pecl() routines without copying their coefficient
 * tables into this repository.
 *
 * The resulting pole-matrix path is a diagnostic wrapper around the exact
 * pinned source, not a new production dependency.
 */
#include "swephlib.c"

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

static double dot3(const double a[3], const double b[3]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

static void cross3(const double a[3], const double b[3], double out[3]) {
  out[0] = a[1] * b[2] - a[2] * b[1];
  out[1] = a[2] * b[0] - a[0] * b[2];
  out[2] = a[0] * b[1] - a[1] * b[0];
}

static void normalize3(double vector[3]) {
  const double length = sqrt(dot3(vector, vector));
  if (!(length > 0.0) || !isfinite(length)) {
    fprintf(stderr, "cannot normalize zero/non-finite vector\n");
    exit(3);
  }
  vector[0] /= length;
  vector[1] /= length;
  vector[2] /= length;
}

static double clamp_unit(double value) {
  if (value > 1.0) return 1.0;
  if (value < -1.0) return -1.0;
  return value;
}

static void print_ecliptic(
  const double vector[3],
  double obliquity_radians
) {
  const double longitude = normalized_degrees(atan2(vector[1], vector[0]));
  const double latitude =
    atan2(vector[2], hypot(vector[0], vector[1])) * 180.0 / M_PI;
  printf(
    "%.12f %.12f %.12f\n",
    longitude,
    latitude,
    obliquity_radians * 180.0 / M_PI
  );
}

static void pole_matrix_direction(
  double tt_jd,
  const double input_icrf[6]
) {
  double equator_pole[3];
  double ecliptic_pole[3];
  double equinox[3];
  double y_axis[3];
  double vector[6];

  /*
   * Use the exact pole series from the pinned Swiss source.  This is the
   * geometric construction used by SOFA/ERFA ltecm:
   *
   *   z = ecliptic pole
   *   x = normalize(equator pole x ecliptic pole)
   *   y = ecliptic pole x x
   *
   * Unlike the scalar-obliquity shortcut below, this preserves the full
   * independently fitted long-term ecliptic pole.
   */
  pre_pequ(tt_jd, equator_pole);
  pre_pecl(tt_jd, ecliptic_pole);
  normalize3(equator_pole);
  normalize3(ecliptic_pole);

  cross3(equator_pole, ecliptic_pole, equinox);
  normalize3(equinox);
  cross3(ecliptic_pole, equinox, y_axis);
  normalize3(y_axis);

  memcpy(vector, input_icrf, 6 * sizeof(double));

  /*
   * DE441/REBOUND states are ICRF.  Convert ICRF -> mean dynamical J2000
   * before applying the pole basis.  This is the same full Swiss frame-bias
   * routine used by ordinary post-DE403 paths.
   */
  swi_bias(vector, tt_jd, 0, FALSE);

  double ecliptic[3] = {
    dot3(equinox, vector),
    dot3(y_axis, vector),
    dot3(ecliptic_pole, vector)
  };

  const double geometric_obliquity = acos(
    clamp_unit(dot3(equator_pole, ecliptic_pole))
  );
  print_ecliptic(ecliptic, geometric_obliquity);
}

static void scalar_obliquity_direction(
  double tt_jd,
  const double input_icrf[6]
) {
  double vector[6];
  memcpy(vector, input_icrf, 6 * sizeof(double));

  /*
   * This is retained only as a rejected diagnostic.  It mirrors the tempting
   * "precess to mean equator of date, then rotate by swi_epsiln()" shortcut.
   * At remote epochs Swiss's separately fitted long-term scalar obliquity is
   * not algebraically identical to the pole-derived ecliptic plane.
   */
  swi_bias(vector, tt_jd, 0, FALSE);
  if (swi_precess(vector, tt_jd, 0, J2000_TO_J) != 0) {
    fprintf(stderr, "swi_precess failed\n");
    exit(4);
  }
  const double scalar_obliquity = swi_epsiln(tt_jd, 0);
  swi_coortrf(vector, vector, scalar_obliquity);
  print_ecliptic(vector, scalar_obliquity);
}

int main(int argc, char **argv) {
  swe_set_ephe_path(NULL);

  /*
   * Explicitly pin Vondrak 2011 for both long- and short-term precession.
   * The pole-matrix path calls the Vondrak pole routines directly; the model
   * state here is primarily needed by frame bias and the rejected scalar path.
   */
  char astro_models[] = "5,9,9,4,3,0,0,4";
  swe_set_astro_models(astro_models, 0);

  if (argc != 5) {
    fprintf(
      stderr,
      "usage: %s <mode:pole-matrix|scalar-obliquity> <tt-jd> "
      "<icrf-ra-deg> <icrf-dec-deg>\n",
      argv[0]
    );
    return 2;
  }

  const char *mode = argv[1];
  const double tt_jd = parse_number(argv[2], "tt-jd");
  const double ra = parse_number(argv[3], "ra") * M_PI / 180.0;
  const double dec = parse_number(argv[4], "dec") * M_PI / 180.0;
  const double cos_dec = cos(dec);

  const double vector[6] = {
    cos_dec * cos(ra),
    cos_dec * sin(ra),
    sin(dec),
    0.0, 0.0, 0.0
  };

  if (strcmp(mode, "pole-matrix") == 0) {
    pole_matrix_direction(tt_jd, vector);
  } else if (strcmp(mode, "scalar-obliquity") == 0) {
    scalar_obliquity_direction(tt_jd, vector);
  } else {
    fprintf(stderr, "unknown mode: %s\n", mode);
    return 2;
  }

  return 0;
}
