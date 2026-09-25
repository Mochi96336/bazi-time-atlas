import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSeasonalBoundary
} from "../src/recurrence/seasonal-boundary-authority.js";
import {
  clearResearchSeasonalEvidenceForTests
} from "../src/recurrence/research-seasonal-evidence-registry.js";
import {
  installResearchSeasonal10026Fixture
} from "./helpers/install-research-seasonal-10026.js";
import {
  RESEARCH_SEASONAL_BOUNDARY_RESOLUTION_CONTRACT,
  resolveResearchSeasonalBoundary
} from "../src/recurrence/research-seasonal-boundary-resolution.js";

const LI_CHUN = 315;

test("Research overlay leaves canonical authority semantics unchanged", () => {
  assert.equal(
    RESEARCH_SEASONAL_BOUNDARY_RESOLUTION_CONTRACT.canonicalAuthorityUnmodified,
    true
  );
  assert.equal(
    RESEARCH_SEASONAL_BOUNDARY_RESOLUTION_CONTRACT.appliesOnlyWhenCanonicalStatus,
    "source-covered-runtime-missing"
  );

  const canonical = resolveSeasonalBoundary({
    year:10026,
    longitudeDegrees:LI_CHUN
  });
  assert.equal(canonical.status, "source-covered-runtime-missing");
  assert.equal(canonical.epochStatus, "unresolved");
  assert.equal(canonical.authorityClass, "qualified-source-without-runtime");
  assert.ok(canonical.sourceIds.includes("jpl-de441"));
});

test("Research overlay stays canonical until the 10026 binary evidence is installed", () => {
  clearResearchSeasonalEvidenceForTests();
  const boundary = resolveResearchSeasonalBoundary({
    year:10026,
    longitudeDegrees:LI_CHUN
  });
  assert.equal(boundary.status, "source-covered-runtime-missing");
  assert.equal(boundary.epochStatus, "unresolved");
});

test("Research overlay may consume installed 10026 DE441-derived evidence without promoting it", async () => {
  await installResearchSeasonal10026Fixture();
  const boundary = resolveResearchSeasonalBoundary({
    year:10026,
    longitudeDegrees:LI_CHUN
  });

  assert.equal(boundary.status, "resolved-research-evidence");
  assert.equal(boundary.epochStatus, "resolved");
  assert.equal(boundary.authorityClass, "source-derived-research-evidence");
  assert.equal(boundary.providerId, null);
  assert.equal(boundary.timeScale, "TT");
  assert.equal(boundary.ttJulianDay, 5383013.532143416);
  assert.equal(boundary.evidenceId, "de441-10026-source-derived-seasonal-crossing-evidence-v1");
  assert.equal(boundary.independentTargetYearTruth, false);
  assert.equal(boundary.sourceDerivedTargetYear, true);
  assert.equal(boundary.productionAuthorityGranted, false);
  assert.equal(boundary.canonicalAuthorityStatus, "source-covered-runtime-missing");
  assert.equal(boundary.blocker, "target-year-independent-validation");
});

test("Research overlay never replaces production or bounded-model resolutions", () => {
  const modern = resolveResearchSeasonalBoundary({
    year:2026,
    longitudeDegrees:LI_CHUN
  });
  const reviewed = resolveResearchSeasonalBoundary({
    year:4006,
    longitudeDegrees:LI_CHUN
  });

  assert.equal(modern.authorityClass, "declared-model-direct-event");
  assert.equal(reviewed.authorityClass, "reviewed-production-direct-event");
  assert.equal(reviewed.providerId, "jpl-de441-seasonal-events-v1");
});

test("Research overlay does not manufacture an epoch beyond absolute source coverage", () => {
  const boundary = resolveResearchSeasonalBoundary({
    year:26026,
    longitudeDegrees:LI_CHUN
  });

  assert.equal(boundary.status, "absolute-source-unavailable");
  assert.equal(boundary.epochStatus, "unresolved");
  assert.equal(boundary.ttJulianDay, null);
  assert.equal(boundary.blocker, "ephemeris-source-coverage");
});
