#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#include "swephexp.h"

#define TARGET_YEAR 4006
#define MAX_SAMPLE_STEP_ET_DAYS 0.25

static void die(const char *message) {
  fprintf(stderr, "%s\n", message);
  exit(1);
}

static void calc_checked(double jd_et, int flags, double *x, char *serr) {
  const int ret = swe_calc(jd_et, SE_SUN, flags, x, serr);
  if (ret < 0) {
    fprintf(stderr, "swe_calc failed at %.12f: %s\n", jd_et, serr);
    exit(1);
  }
  if (!(ret & SEFLG_SWIEPH)) die("expected SWIEPH return flag");
  if (!(ret & SEFLG_EQUATORIAL)) die("corrected RA sampler did not return equatorial coordinates");
  if (!(ret & SEFLG_XYZ)) die("corrected RA sampler did not return Cartesian coordinates");
}

int main(int argc, char **argv) {
  if (argc != 2) die("usage: research-swiss-equatorial-ra-frame-correction-4006 <ephemeris-dir>");
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

  const int common = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_XYZ | SEFLG_EQUATORIAL |
      SEFLG_NONUT | SEFLG_TRUEPOS | SEFLG_NOABERR | SEFLG_NOGDEFL;
  const int j2000_flags = common | SEFLG_J2000;
  const int mean_of_date_flags = common;

  double min_j2000_xy = HUGE_VAL;
  double min_mod_xy = HUGE_VAL;
  long min_j2000_index = -1;
  long min_mod_index = -1;
  double min_j2000_et = 0;
  double min_mod_et = 0;

  for (long i = 0; i <= intervals; i++) {
    const double jd_et = start_et + step_et * (double)i;
    double j2000[6] = {0}, mod[6] = {0};
    calc_checked(jd_et, j2000_flags, j2000, serr);
    calc_checked(jd_et, mean_of_date_flags, mod, serr);
    const double jxy = hypot(j2000[0], j2000[1]);
    const double mxy = hypot(mod[0], mod[1]);
    if (jxy < min_j2000_xy) {
      min_j2000_xy = jxy;
      min_j2000_index = i;
      min_j2000_et = jd_et;
    }
    if (mxy < min_mod_xy) {
      min_mod_xy = mxy;
      min_mod_index = i;
      min_mod_et = jd_et;
    }
  }

  printf("{\n");
  printf("  \"targetYear\": %d,\n", TARGET_YEAR);
  printf("  \"method\": \"swiss-true-geometric-equatorial-ra-frame-correction-et-grid-v1\",\n");
  printf("  \"sampleIntervals\": %ld,\n", intervals);
  printf("  \"sampleStepEtDays\": %.17g,\n", step_et);
  printf("  \"sampleCoverRadiusEtDays\": %.17g,\n", cover_radius_et);
  printf("  \"domain\": {\"startEtJd\": %.15f, \"endEtJd\": %.15f},\n", start_et, end_et);
  printf("  \"j2000\": {\"minSampledEquatorialXyAu\": %.17g, \"minSampleIndex\": %ld, \"minSampleEtJd\": %.15f},\n",
         min_j2000_xy, min_j2000_index, min_j2000_et);
  printf("  \"meanOfDate\": {\"minSampledEquatorialXyAu\": %.17g, \"minSampleIndex\": %ld, \"minSampleEtJd\": %.15f},\n",
         min_mod_xy, min_mod_index, min_mod_et);
  printf("  \"interpretation\": {\n");
  printf("    \"equatorialFlagExplicit\": true,\n");
  printf("    \"trueGeometricPosition\": true,\n");
  printf("    \"lightTimeDisabled\": true,\n");
  printf("    \"annualAberrationDisabled\": true,\n");
  printf("    \"nutationDisabled\": true,\n");
  printf("    \"j2000SampleIsEquatorial\": true,\n");
  printf("    \"meanOfDateSampleIsEquatorial\": true,\n");
  printf("    \"gridMinimumIsContinuousLowerBound\": false,\n");
  printf("    \"recurrenceAuthorityGranted\": false\n");
  printf("  }\n");
  printf("}\n");
  swe_close();
  return 0;
}
