#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#include "swephexp.h"
#include "sweph.h"
#include "swephlib.h"

#define TARGET_YEAR 4006
#define MAX_SAMPLE_STEP_ET_DAYS 0.25
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
  if (pdp->segp == NULL || pdp->neval <= 0 || pdp->ncoe <= 0 || pdp->dseg <= 0)
    die("invalid loaded SWIEPH Chebyshev segment");
  const double dx_dt = 2.0 / pdp->dseg;
  for (int coord = 0; coord < 3; coord++) {
    const double *coeff = pdp->segp + coord * pdp->ncoe;
    pcoord[coord] = fabs(coeff[0]) * 0.5;
    for (int n = 1; n < pdp->neval; n++) {
      const double abs_c = fabs(coeff[n]);
      pcoord[coord] += abs_c;
      vcoord[coord] += abs_c * cheb_first_derivative_basis_bound(n) * dx_dt;
      if (n >= 2)
        acoord[coord] += abs_c * cheb_second_derivative_basis_bound(n) * dx_dt * dx_dt;
    }
  }
  *position_bound = hypot(hypot(pcoord[0], pcoord[1]), pcoord[2]);
  *velocity_bound = hypot(hypot(vcoord[0], vcoord[1]), vcoord[2]);
  *acceleration_bound = hypot(hypot(acoord[0], acoord[1]), acoord[2]);
}

static void inspect_loaded_segment(body_bound *body) {
  struct plan_data *pdp = &swed.pldat[body->internal_index];
  if (pdp->segp == NULL) die("expected loaded SWIEPH segment");
  if (body->segment_count > 0 && fabs(pdp->tseg0 - body->last_seen_tseg0) <= 1e-12) return;
  if (body->segment_count > 0 && pdp->tseg0 > body->last_tseg1 + COVER_TOLERANCE_DAYS)
    die("SWIEPH segment coverage gap");

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
  body->max_position_bound_au = max2(body->max_position_bound_au, pbound);
  body->max_velocity_bound_au_per_day = max2(body->max_velocity_bound_au_per_day, vbound);
  body->max_acceleration_bound_au_per_day2 = max2(body->max_acceleration_bound_au_per_day2, abound);
}

static void calc_checked(double jd_et, int planet, int flags, double *x, char *serr) {
  const int ret = swe_calc(jd_et, planet, flags, x, serr);
  if (ret < 0) {
    fprintf(stderr, "swe_calc failed for planet %d at %.12f: %s\n", planet, jd_et, serr);
    exit(1);
  }
  if (!(ret & SEFLG_SWIEPH)) die("expected SWIEPH return flag");
}

static void print_body_json(const body_bound *body) {
  printf("{\n");
  printf("      \"segmentCount\": %ld,\n", body->segment_count);
  printf("      \"firstTseg0\": %.17g,\n", body->first_tseg0);
  printf("      \"lastTseg1\": %.17g,\n", body->last_tseg1);
  printf("      \"minSegmentDays\": %.17g,\n", body->min_dseg);
  printf("      \"maxNcoe\": %d,\n", body->max_ncoe);
  printf("      \"maxNeval\": %d,\n", body->max_neval);
  printf("      \"maxPositionCoefficientEnvelopeAu\": %.17g,\n", body->max_position_bound_au);
  printf("      \"maxVelocityBoundAuPerDay\": %.17g,\n", body->max_velocity_bound_au_per_day);
  printf("      \"maxAccelerationBoundAuPerDaySquared\": %.17g\n", body->max_acceleration_bound_au_per_day2);
  printf("    }");
}

int main(int argc, char **argv) {
  if (argc != 2) die("usage: research-swiss-light-time-precessed-ra-samples-4006 <ephemeris-dir>");
  swe_set_ephe_path(argv[1]);

  char serr[AS_MAXCH] = {0};
  const double start_ut = swe_julday(TARGET_YEAR, 1, 1, 0.0, SE_GREG_CAL);
  const double end_ut = swe_julday(TARGET_YEAR + 1, 1, 1, 0.0, SE_GREG_CAL);
  const double start_et = start_ut + swe_deltat_ex(start_ut, SEFLG_SWIEPH, serr);
  const double end_et = end_ut + swe_deltat_ex(end_ut, SEFLG_SWIEPH, serr);
  const double span_et = end_et - start_et;
  const long intervals = (long)ceil(span_et / MAX_SAMPLE_STEP_ET_DAYS);
  const double step_et = span_et / (double)intervals;
  const double cover_radius_et = step_et / 2.0;
  if (!(step_et > 0 && step_et <= MAX_SAMPLE_STEP_ET_DAYS)) die("invalid ET sampling step");

  body_bound emb = {.name="earthMoonBarycenter", .internal_index=SEI_EARTH};
  body_bound sunb = {.name="sunBarycenter", .internal_index=SEI_SUNBARY};
  body_bound moon = {.name="moonGeocentric", .internal_index=SEI_MOON};

  const int bary_flags = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_XYZ | SEFLG_J2000 |
      SEFLG_NONUT | SEFLG_TRUEPOS | SEFLG_BARYCTR;
  const int moon_flags = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_XYZ | SEFLG_J2000 |
      SEFLG_NONUT | SEFLG_TRUEPOS;
  /* Exact Swiss geocentric Sun path with light-time enabled, but with annual
   * aberration and nutation disabled. For the Sun path Swiss does not apply
   * gravitational deflection, but NOGDEFL is set as an explicit scope guard.
   * J2000 is intentionally absent so Vondrak precession to mean-of-date runs. */
  const int light_time_flags = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_XYZ |
      SEFLG_EQUATORIAL | SEFLG_NOABERR | SEFLG_NOGDEFL | SEFLG_NONUT;

  double min_sampled_light_time_precessed_xy_au = HUGE_VAL;
  long min_index = -1;
  double min_jd_et = 0;

  for (long i = 0; i <= intervals; i++) {
    const double jd_et = start_et + step_et * (double)i;
    double xs[6] = {0}, xe[6] = {0}, xm[6] = {0}, app[6] = {0};
    calc_checked(jd_et, SE_SUN, bary_flags, xs, serr);
    calc_checked(jd_et, SE_EARTH, bary_flags, xe, serr);
    calc_checked(jd_et, SE_MOON, moon_flags, xm, serr);
    inspect_loaded_segment(&emb);
    inspect_loaded_segment(&sunb);
    inspect_loaded_segment(&moon);

    calc_checked(jd_et, SE_SUN, light_time_flags, app, serr);
    const double rxy = hypot(app[0], app[1]);
    if (rxy < min_sampled_light_time_precessed_xy_au) {
      min_sampled_light_time_precessed_xy_au = rxy;
      min_index = i;
      min_jd_et = jd_et;
    }
  }

  body_bound *bodies[] = {&emb, &sunb, &moon};
  for (int i = 0; i < 3; i++) {
    body_bound *b = bodies[i];
    if (b->segment_count <= 0) die("no SWIEPH segments inspected");
    if (!(step_et <= b->min_dseg)) die("sample cadence can skip a complete SWIEPH segment");
  }

  printf("{\n");
  printf("  \"targetYear\": %d,\n", TARGET_YEAR);
  printf("  \"method\": \"swieph-two-pass-sun-light-time-plus-vondrak-precession-et-grid-v1\",\n");
  printf("  \"sampleIntervals\": %ld,\n", intervals);
  printf("  \"sampleStepEtDays\": %.17g,\n", step_et);
  printf("  \"sampleCoverRadiusEtDays\": %.17g,\n", cover_radius_et);
  printf("  \"lightTimeDaysPerAu\": %.17g,\n", AUNIT / CLIGHT / 86400.0);
  printf("  \"domain\": {\"startEtJd\": %.15f, \"endEtJd\": %.15f},\n", start_et, end_et);
  printf("  \"bodies\": {\n");
  printf("    \"earthMoonBarycenter\": "); print_body_json(&emb); printf(",\n");
  printf("    \"sunBarycenter\": "); print_body_json(&sunb); printf(",\n");
  printf("    \"moonGeocentric\": "); print_body_json(&moon); printf("\n");
  printf("  },\n");
  printf("  \"earthMoonMassRatio\": %.17g,\n", (double)EARTH_MOON_MRAT);
  printf("  \"minSampledLightTimePrecessedXyAu\": %.17g,\n", min_sampled_light_time_precessed_xy_au);
  printf("  \"minSampleIndex\": %ld,\n", min_index);
  printf("  \"minSampleEtJd\": %.15f,\n", min_jd_et);
  printf("  \"interpretation\": {\n");
  printf("    \"uniformEtGrid\": true,\n");
  printf("    \"swissTwoPassSunLightTimeEnabled\": true,\n");
  printf("    \"annualAberrationDisabled\": true,\n");
  printf("    \"nutationDisabled\": true,\n");
  printf("    \"vondrakPrecessionEnabled\": true,\n");
  printf("    \"gridMinimumIsContinuousLowerBound\": false,\n");
  printf("    \"continuousRaCurvatureCertified\": false,\n");
  printf("    \"recurrenceAuthorityGranted\": false\n");
  printf("  }\n");
  printf("}\n");
  swe_close();
  return 0;
}
