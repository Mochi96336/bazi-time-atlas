#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "swephexp.h"
#include "sweph.h"

#define TARGET_YEAR 4006
#define SAMPLE_STEP_DAYS 0.25
#define COVER_RADIUS_DAYS (SAMPLE_STEP_DAYS / 2.0)
#define COVER_TOLERANCE_DAYS 1e-7

typedef struct {
  const char *name;
  int internal_index;
  long segment_count;
  double first_tseg0;
  double last_tseg1;
  double last_seen_tseg0;
  double min_dseg;
  int max_ncoe;
  int max_neval;
  long rotated_segments;
  long reference_ellipse_segments;
  double max_position_bound_au;
  double max_velocity_bound_au_per_day;
  double max_acceleration_bound_au_per_day2;
} body_bound;

static double max2(double a, double b) { return a > b ? a : b; }

static void die(const char *message) {
  fprintf(stderr, "%s\n", message);
  exit(1);
}

static double cheb_first_derivative_basis_bound(int n) {
  return (double)n * (double)n;
}

static double cheb_second_derivative_basis_bound(int n) {
  const double n2 = (double)n * (double)n;
  return n2 * (n2 - 1.0) / 3.0;
}

static void segment_vector_bounds(
    const struct plan_data *pdp,
    double *position_bound,
    double *velocity_bound,
    double *acceleration_bound) {
  double pcoord[3] = {0, 0, 0};
  double vcoord[3] = {0, 0, 0};
  double acoord[3] = {0, 0, 0};
  if (pdp->segp == NULL || pdp->neval <= 0 || pdp->ncoe <= 0 || pdp->dseg <= 0) {
    die("invalid loaded SWIEPH Chebyshev segment");
  }
  const double dx_dt = 2.0 / pdp->dseg;
  for (int coord = 0; coord < 3; coord++) {
    const double *coeff = pdp->segp + coord * pdp->ncoe;
    pcoord[coord] = fabs(coeff[0]) * 0.5;
    for (int n = 1; n < pdp->neval; n++) {
      const double abs_c = fabs(coeff[n]);
      pcoord[coord] += abs_c;
      vcoord[coord] += abs_c * cheb_first_derivative_basis_bound(n) * dx_dt;
      if (n >= 2) {
        acoord[coord] += abs_c * cheb_second_derivative_basis_bound(n) * dx_dt * dx_dt;
      }
    }
  }
  *position_bound = hypot(hypot(pcoord[0], pcoord[1]), pcoord[2]);
  *velocity_bound = hypot(hypot(vcoord[0], vcoord[1]), vcoord[2]);
  *acceleration_bound = hypot(hypot(acoord[0], acoord[1]), acoord[2]);
}

static void inspect_loaded_segment(body_bound *body) {
  struct plan_data *pdp = &swed.pldat[body->internal_index];
  if (pdp->segp == NULL) {
    fprintf(stderr, "%s segment not loaded\n", body->name);
    exit(1);
  }
  if (body->segment_count > 0 && fabs(pdp->tseg0 - body->last_seen_tseg0) <= 1e-12) {
    return;
  }
  if (body->segment_count > 0 && pdp->tseg0 > body->last_tseg1 + COVER_TOLERANCE_DAYS) {
    fprintf(stderr, "%s segment coverage gap: previous end %.15f, next start %.15f\n",
            body->name, body->last_tseg1, pdp->tseg0);
    exit(1);
  }

  double pbound = 0, vbound = 0, abound = 0;
  segment_vector_bounds(pdp, &pbound, &vbound, &abound);

  if (body->segment_count == 0) {
    body->first_tseg0 = pdp->tseg0;
    body->min_dseg = pdp->dseg;
  }
  body->segment_count += 1;
  body->last_seen_tseg0 = pdp->tseg0;
  body->last_tseg1 = pdp->tseg1;
  body->min_dseg = body->min_dseg < pdp->dseg ? body->min_dseg : pdp->dseg;
  body->max_ncoe = body->max_ncoe > pdp->ncoe ? body->max_ncoe : pdp->ncoe;
  body->max_neval = body->max_neval > pdp->neval ? body->max_neval : pdp->neval;
  if (pdp->iflg & SEI_FLG_ROTATE) body->rotated_segments += 1;
  if (pdp->refep != NULL) body->reference_ellipse_segments += 1;
  body->max_position_bound_au = max2(body->max_position_bound_au, pbound);
  body->max_velocity_bound_au_per_day = max2(body->max_velocity_bound_au_per_day, vbound);
  body->max_acceleration_bound_au_per_day2 = max2(body->max_acceleration_bound_au_per_day2, abound);
}

static int calc_checked(double jd_ut, int planet, int flags, double *x, char *serr) {
  const int ret = swe_calc_ut(jd_ut, planet, flags, x, serr);
  if (ret < 0) {
    fprintf(stderr, "swe_calc_ut failed for planet %d at %.9f: %s\n", planet, jd_ut, serr);
    exit(1);
  }
  if (!(ret & SEFLG_SWIEPH)) {
    fprintf(stderr, "expected SWIEPH for planet %d at %.9f, retflag=%d\n", planet, jd_ut, ret);
    exit(1);
  }
  return ret;
}

static void print_body_json(const body_bound *body) {
  printf("{\n");
  printf("      \"segmentCount\": %ld,\n", body->segment_count);
  printf("      \"firstTseg0\": %.15f,\n", body->first_tseg0);
  printf("      \"lastTseg1\": %.15f,\n", body->last_tseg1);
  printf("      \"minSegmentDays\": %.15f,\n", body->min_dseg);
  printf("      \"maxNcoe\": %d,\n", body->max_ncoe);
  printf("      \"maxNeval\": %d,\n", body->max_neval);
  printf("      \"rotatedSegments\": %ld,\n", body->rotated_segments);
  printf("      \"referenceEllipseSegments\": %ld,\n", body->reference_ellipse_segments);
  printf("      \"maxPositionCoefficientEnvelopeAu\": %.17g,\n", body->max_position_bound_au);
  printf("      \"maxVelocityBoundAuPerDay\": %.17g,\n", body->max_velocity_bound_au_per_day);
  printf("      \"maxAccelerationBoundAuPerDaySquared\": %.17g\n", body->max_acceleration_bound_au_per_day2);
  printf("    }");
}

int main(int argc, char **argv) {
  if (argc != 2) die("usage: research-swiss-segment-curvature-bound-4006 <ephemeris-dir>");
  swe_set_ephe_path(argv[1]);

  char serr[AS_MAXCH] = {0};
  const double start_ut = swe_julday(TARGET_YEAR, 1, 1, 0.0, SE_GREG_CAL);
  const double end_ut = swe_julday(TARGET_YEAR + 1, 1, 1, 0.0, SE_GREG_CAL);
  const double start_et = start_ut + swe_deltat_ex(start_ut, SEFLG_SWIEPH, serr);
  const double end_et = end_ut + swe_deltat_ex(end_ut, SEFLG_SWIEPH, serr);
  const long intervals = lround((end_ut - start_ut) / SAMPLE_STEP_DAYS);
  if (intervals != 1460) die("unexpected quarter-day interval count for year 4006");

  body_bound emb = {.name="earthMoonBarycenter", .internal_index=SEI_EARTH};
  body_bound sunb = {.name="sunBarycenter", .internal_index=SEI_SUNBARY};
  body_bound moon = {.name="moonGeocentric", .internal_index=SEI_MOON};

  const int load_flags = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_XYZ | SEFLG_J2000 | SEFLG_NONUT | SEFLG_TRUEPOS | SEFLG_BARYCTR;
  double min_sampled_relative_xy_au = HUGE_VAL;
  double min_sampled_relative_r_au = HUGE_VAL;

  for (long i = 0; i <= intervals; i++) {
    const double jd_ut = start_ut + i * SAMPLE_STEP_DAYS;
    double xs[6] = {0}, xe[6] = {0}, xm[6] = {0};
    calc_checked(jd_ut, SE_SUN, load_flags, xs, serr);
    calc_checked(jd_ut, SE_EARTH, load_flags, xe, serr);
    /* Explicit Moon call guarantees the lunar SWIEPH segment needed by embofs is loaded. */
    calc_checked(jd_ut, SE_MOON, SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_XYZ | SEFLG_J2000 | SEFLG_NONUT | SEFLG_TRUEPOS, xm, serr);

    inspect_loaded_segment(&emb);
    inspect_loaded_segment(&sunb);
    inspect_loaded_segment(&moon);

    const double rx = xs[0] - xe[0];
    const double ry = xs[1] - xe[1];
    const double rz = xs[2] - xe[2];
    const double rxy = hypot(rx, ry);
    const double r = hypot(rxy, rz);
    if (rxy < min_sampled_relative_xy_au) min_sampled_relative_xy_au = rxy;
    if (r < min_sampled_relative_r_au) min_sampled_relative_r_au = r;
  }

  body_bound *bodies[] = {&emb, &sunb, &moon};
  for (int i = 0; i < 3; i++) {
    body_bound *b = bodies[i];
    if (b->segment_count <= 0) die("no SWIEPH segments inspected");
    if (b->first_tseg0 > start_et + COVER_TOLERANCE_DAYS || b->last_tseg1 < end_et - COVER_TOLERANCE_DAYS) {
      fprintf(stderr, "%s segment coverage does not span year-4006 ET domain\n", b->name);
      return 1;
    }
  }

  const double earth_moon_mrat = EARTH_MOON_MRAT;
  const double earth_velocity_bound = emb.max_velocity_bound_au_per_day
      + moon.max_velocity_bound_au_per_day / (earth_moon_mrat + 1.0);
  const double earth_acceleration_bound = emb.max_acceleration_bound_au_per_day2
      + moon.max_acceleration_bound_au_per_day2 / (earth_moon_mrat + 1.0);
  const double relative_velocity_bound = earth_velocity_bound + sunb.max_velocity_bound_au_per_day;
  const double relative_acceleration_bound = earth_acceleration_bound + sunb.max_acceleration_bound_au_per_day2;

  const double hard_relative_xy_lower_au = min_sampled_relative_xy_au
      - relative_velocity_bound * COVER_RADIUS_DAYS;
  const double hard_relative_r_lower_au = min_sampled_relative_r_au
      - relative_velocity_bound * COVER_RADIUS_DAYS;
  if (!(hard_relative_xy_lower_au > 0) || !(hard_relative_r_lower_au > 0)) {
    die("sample-plus-hard-speed lower distance bound is not positive");
  }

  /* For alpha = atan2(y,x):
   * |alpha''| <= A_xy/rho + 2 V_xy^2/rho^2.
   * Using full 3D V/A bounds is conservative for XY components. */
  const double geometric_ra_second_derivative_bound_rad_per_day2 =
      relative_acceleration_bound / hard_relative_xy_lower_au
      + 2.0 * relative_velocity_bound * relative_velocity_bound
        / (hard_relative_xy_lower_au * hard_relative_xy_lower_au);
  const double geometric_ra_second_derivative_bound_deg_per_day2 =
      geometric_ra_second_derivative_bound_rad_per_day2 * 180.0 / M_PI;

  printf("{\n");
  printf("  \"targetYear\": %d,\n", TARGET_YEAR);
  printf("  \"method\": \"swieph-post-rotback-chebyshev-markov-envelope-v1\",\n");
  printf("  \"sampleStepDays\": %.17g,\n", SAMPLE_STEP_DAYS);
  printf("  \"sampleCoverRadiusDays\": %.17g,\n", COVER_RADIUS_DAYS);
  printf("  \"domain\": {\"startUtJd\": %.15f, \"endUtJd\": %.15f, \"startEtJd\": %.15f, \"endEtJd\": %.15f},\n",
         start_ut, end_ut, start_et, end_et);
  printf("  \"bodies\": {\n");
  printf("    \"earthMoonBarycenter\": "); print_body_json(&emb); printf(",\n");
  printf("    \"sunBarycenter\": "); print_body_json(&sunb); printf(",\n");
  printf("    \"moonGeocentric\": "); print_body_json(&moon); printf("\n");
  printf("  },\n");
  printf("  \"earthMoonMassRatio\": %.17g,\n", earth_moon_mrat);
  printf("  \"derivedHardBounds\": {\n");
  printf("    \"earthVelocityAuPerDay\": %.17g,\n", earth_velocity_bound);
  printf("    \"earthAccelerationAuPerDaySquared\": %.17g,\n", earth_acceleration_bound);
  printf("    \"sunRelativeVelocityAuPerDay\": %.17g,\n", relative_velocity_bound);
  printf("    \"sunRelativeAccelerationAuPerDaySquared\": %.17g,\n", relative_acceleration_bound);
  printf("    \"minSampledSunRelativeXyAu\": %.17g,\n", min_sampled_relative_xy_au);
  printf("    \"minSampledSunRelativeDistanceAu\": %.17g,\n", min_sampled_relative_r_au);
  printf("    \"hardSunRelativeXyLowerAu\": %.17g,\n", hard_relative_xy_lower_au);
  printf("    \"hardSunRelativeDistanceLowerAu\": %.17g,\n", hard_relative_r_lower_au);
  printf("    \"geometricJ2000RaSecondDerivativeBoundRadPerDaySquared\": %.17g,\n", geometric_ra_second_derivative_bound_rad_per_day2);
  printf("    \"geometricJ2000RaSecondDerivativeBoundDegPerDaySquared\": %.17g\n", geometric_ra_second_derivative_bound_deg_per_day2);
  printf("  },\n");
  printf("  \"interpretation\": {\n");
  printf("    \"chebyshevSegmentVelocityAccelerationBoundsAnalytic\": true,\n");
  printf("    \"sampleBetweenDistanceLowerBoundUsesCertifiedVelocityEnvelope\": true,\n");
  printf("    \"geometricJ2000RaSecondDerivativeBoundAnalytic\": true,\n");
  printf("    \"apparentPositionCorrectionChainCertified\": false,\n");
  printf("    \"longTermSiderealSecondDerivativeCertified\": false,\n");
  printf("    \"swissEotSecondDerivativeCertified\": false,\n");
  printf("    \"continuousResidualUpperBound\": false,\n");
  printf("    \"recurrenceAuthorityGranted\": false\n");
  printf("  }\n");
  printf("}\n");

  swe_close();
  return 0;
}
