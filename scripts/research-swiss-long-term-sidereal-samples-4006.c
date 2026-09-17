#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#include "swephexp.h"
#include "sweph.h"
#include "swephlib.h"

#define TARGET_YEAR 4006
#define MAX_SAMPLE_STEP_UT_DAYS 0.25
#define POST_2050_SIDEREAL_ALIGNMENT_OFFSET_HOURS (0.001385646 / 15.0)

static void die(const char *message) {
  fprintf(stderr, "%s\n", message);
  exit(1);
}

static double wrap_hours(double value) {
  double x = fmod(value + 12.0, 24.0);
  if (x < 0) x += 24.0;
  return x - 12.0;
}

int main(int argc, char **argv) {
  if (argc != 2) die("usage: research-swiss-long-term-sidereal-samples-4006 <ephemeris-dir>");
  swe_set_ephe_path(argv[1]);

  const double start_ut = swe_julday(TARGET_YEAR, 1, 1, 0.0, SE_GREG_CAL);
  const double end_ut = swe_julday(TARGET_YEAR + 1, 1, 1, 0.0, SE_GREG_CAL);
  const double span_ut = end_ut - start_ut;
  const long intervals = (long)ceil(span_ut / MAX_SAMPLE_STEP_UT_DAYS);
  const double step_ut = span_ut / (double)intervals;
  const double cover_radius_ut = step_ut / 2.0;
  if (!(step_ut > 0 && step_ut <= MAX_SAMPLE_STEP_UT_DAYS)) die("invalid UT sampling step");

  const double j2000_et = J2000 + swe_deltat_ex(J2000, -1, NULL);
  const double j2000_obliquity_deg = swi_epsiln(j2000_et, 0) * RADTODEG;
  const double dlt = AUNIT / CLIGHT / 86400.0;

  double min_xy = HUGE_VAL;
  double max_abs_z = 0.0;
  double max_abs_dpsi_rad = 0.0;
  double max_abs_eot_angle_deg = 0.0;
  double max_sidtime_parity_hours = 0.0;
  long min_index = -1;
  double min_ut = 0.0;

  for (long i = 0; i <= intervals; i++) {
    const double tjd_ut = start_ut + step_ut * (double)i;
    const double tjd_et = tjd_ut + swe_deltat_ex(tjd_ut, -1, NULL);
    const double t = (tjd_et - J2000) / 365250.0;
    const double t2 = t * t;
    const double t3 = t * t2;

    double dlon = 100.46645683 +
      (1295977422.83429 * t - 2.04411 * t2 - 0.00523 * t3) / 3600.0;
    dlon = swe_degnorm(dlon - dlt * 360.0 / 365.2425);

    double xs[6] = {dlon * DEGTORAD, 0.0, 1.0, 0.0, 0.0, 0.0};
    swi_polcart(xs, xs);
    swi_coortrf(xs, xs, -j2000_obliquity_deg * DEGTORAD);
    swi_precess(xs, tjd_et, 0, -1);

    const double mean_obliquity_deg = swi_epsiln(tjd_et, 0) * RADTODEG;
    double nutlo[2] = {0.0, 0.0};
    swi_nutation(tjd_et, 0, nutlo);
    const double true_obliquity_deg = mean_obliquity_deg + nutlo[1] * RADTODEG;
    const double abs_dpsi_rad = fabs(nutlo[0]);
    if (abs_dpsi_rad > max_abs_dpsi_rad) max_abs_dpsi_rad = abs_dpsi_rad;

    swi_coortrf(xs, xs, mean_obliquity_deg * DEGTORAD);
    const double xy = hypot(xs[0], xs[1]);
    const double abs_z = fabs(xs[2]);
    if (xy < min_xy) {
      min_xy = xy;
      min_index = i;
      min_ut = tjd_ut;
    }
    if (abs_z > max_abs_z) max_abs_z = abs_z;

    swi_cartpol(xs, xs);
    const double mean_longitude_deg = xs[0] * RADTODEG;
    const double equation_of_equinoxes_deg =
      nutlo[0] * RADTODEG * cos(true_obliquity_deg * DEGTORAD);
    const double dhour_deg = fmod(tjd_ut - 0.5, 1.0) * 360.0;
    const double reconstructed_hours =
      swe_degnorm(mean_longitude_deg + equation_of_equinoxes_deg + dhour_deg) / 15.0 -
      POST_2050_SIDEREAL_ALIGNMENT_OFFSET_HOURS;
    const double public_hours = swe_sidtime(tjd_ut);
    const double parity = fabs(wrap_hours(reconstructed_hours - public_hours));
    if (parity > max_sidtime_parity_hours) max_sidtime_parity_hours = parity;

    char serr[AS_MAXCH] = {0};
    double eot_days = 0.0;
    if (swe_time_equ(tjd_ut, &eot_days, serr) == ERR) {
      fprintf(stderr, "swe_time_equ failed at %.12f: %s\n", tjd_ut, serr);
      return 1;
    }
    const double abs_eot_angle_deg = fabs(eot_days * 360.0);
    if (abs_eot_angle_deg > max_abs_eot_angle_deg) max_abs_eot_angle_deg = abs_eot_angle_deg;
  }

  const double start_et = start_ut + swe_deltat_ex(start_ut, -1, NULL);
  const double end_et = end_ut + swe_deltat_ex(end_ut, -1, NULL);

  printf("{\n");
  printf("  \"targetYear\": %d,\n", TARGET_YEAR);
  printf("  \"method\": \"pinned-swiss-sidtime-long-term-vector-and-time-equ-ut-grid-v2\",\n");
  printf("  \"sampleIntervals\": %ld,\n", intervals);
  printf("  \"sampleStepUtDays\": %.17g,\n", step_ut);
  printf("  \"sampleCoverRadiusUtDays\": %.17g,\n", cover_radius_ut);
  printf("  \"domain\": {\"startUtJd\": %.15f, \"endUtJd\": %.15f, \"startEtJd\": %.15f, \"endEtJd\": %.15f},\n",
         start_ut, end_ut, start_et, end_et);
  printf("  \"minSampledPreEqeqEclipticXy\": %.17g,\n", min_xy);
  printf("  \"maxSampledAbsPreEqeqEclipticZ\": %.17g,\n", max_abs_z);
  printf("  \"maxSampledAbsDpsiRad\": %.17g,\n", max_abs_dpsi_rad);
  printf("  \"maxSampledAbsPublicEotAngleDeg\": %.17g,\n", max_abs_eot_angle_deg);
  printf("  \"minSampleIndex\": %ld,\n", min_index);
  printf("  \"minSampleUtJd\": %.15f,\n", min_ut);
  printf("  \"maxAbsReconstructedVsPublicSidtimeHours\": %.17g,\n", max_sidtime_parity_hours);
  printf("  \"interpretation\": {\n");
  printf("    \"longTermSiderealBranchReconstructed\": true,\n");
  printf("    \"post2050AlignmentOffsetApplied\": true,\n");
  printf("    \"publicTimeEquSampled\": true,\n");
  printf("    \"gridMinimumIsContinuousLowerBound\": false,\n");
  printf("    \"sampledDpsiMaximumIsContinuousUpperBound\": false,\n");
  printf("    \"sampledEotMaximumIsContinuousUpperBound\": false,\n");
  printf("    \"sampledParityIsAuthority\": false,\n");
  printf("    \"continuousSiderealCurvatureCertified\": false,\n");
  printf("    \"publicTimeEquWrapBranchCertified\": false,\n");
  printf("    \"recurrenceAuthorityGranted\": false\n");
  printf("  }\n");
  printf("}\n");
  swe_close();
  return 0;
}
