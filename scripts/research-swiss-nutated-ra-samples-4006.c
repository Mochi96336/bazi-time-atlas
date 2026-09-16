#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#include "swephexp.h"
#include "sweph.h"

#define TARGET_YEAR 4006
#define MAX_SAMPLE_STEP_ET_DAYS 0.25

static void die(const char *message) {
  fprintf(stderr, "%s\n", message);
  exit(1);
}

int main(int argc, char **argv) {
  if (argc != 2) die("usage: research-swiss-nutated-ra-samples-4006 <ephemeris-dir>");
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

  /* Exact pinned Swiss apparent-Sun path through light-time, annual
   * aberration, Vondrak mean-of-date precession and default nutation.
   * Gravitational deflection is explicitly excluded from this proof lane. */
  const int flags = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_XYZ |
      SEFLG_EQUATORIAL | SEFLG_NOGDEFL;

  double min_xy = HUGE_VAL;
  long min_index = -1;
  double min_et = 0.0;
  for (long i = 0; i <= intervals; i++) {
    const double jd_et = start_et + step_et * (double)i;
    double x[6] = {0};
    const int ret = swe_calc(jd_et, SE_SUN, flags, x, serr);
    if (ret < 0) {
      fprintf(stderr, "swe_calc failed at %.12f: %s\n", jd_et, serr);
      return 1;
    }
    if (!(ret & SEFLG_SWIEPH)) die("expected SWIEPH return flag");
    const double xy = hypot(x[0], x[1]);
    if (xy < min_xy) {
      min_xy = xy;
      min_index = i;
      min_et = jd_et;
    }
  }

  printf("{\n");
  printf("  \"targetYear\": %d,\n", TARGET_YEAR);
  printf("  \"method\": \"swieph-light-time-aberration-vondrak-iau2000b-nutation-et-grid-v1\",\n");
  printf("  \"sampleIntervals\": %ld,\n", intervals);
  printf("  \"sampleStepEtDays\": %.17g,\n", step_et);
  printf("  \"sampleCoverRadiusEtDays\": %.17g,\n", cover_radius_et);
  printf("  \"domain\": {\"startEtJd\": %.15f, \"endEtJd\": %.15f},\n", start_et, end_et);
  printf("  \"minSampledNutatedEquatorialXyAu\": %.17g,\n", min_xy);
  printf("  \"minSampleIndex\": %ld,\n", min_index);
  printf("  \"minSampleEtJd\": %.15f,\n", min_et);
  printf("  \"interpretation\": {\n");
  printf("    \"lightTimeEnabled\": true,\n");
  printf("    \"annualAberrationEnabled\": true,\n");
  printf("    \"vondrakPrecessionEnabled\": true,\n");
  printf("    \"defaultNutationEnabled\": true,\n");
  printf("    \"gravitationalDeflectionDisabledByScopeGuard\": true,\n");
  printf("    \"gridMinimumIsContinuousLowerBound\": false,\n");
  printf("    \"continuousRaCurvatureCertified\": false,\n");
  printf("    \"recurrenceAuthorityGranted\": false\n");
  printf("  }\n");
  printf("}\n");
  swe_close();
  return 0;
}
