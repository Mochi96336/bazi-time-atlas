import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OWEN_HORIZONS_FRAME_PROOF_CONTRACT } from "../src/astronomy/owen-horizons-frame-proof-contract.js";

test("Owen frame proof is pinned to the same Swiss source already used by long-term research", () => {
  const c = OWEN_HORIZONS_FRAME_PROOF_CONTRACT;
  assert.equal(c.pinnedSwissCommit, "9083a12d59e98034fb2337061481ac8800c16e64");
  assert.match(c.sourceModel, /Owen 1990/);
  assert.equal(c.inputFrame, "ICRF apparent direction (Horizons quantity #45)");
  assert.equal(c.outputFrame, "Earth mean ecliptic-of-date direction (Horizons quantity #31)");
  assert.equal(c.seasonalPlaneSemantics, "mean-ecliptic-of-date");
  assert.equal(c.apparentEquinoxCorrectionTested, true);
  assert.equal(c.fullTrueEclipticClaim, false);
});

test("Owen proof must first recover existing 4006 Horizons truth before touching 10026", () => {
  const c = OWEN_HORIZONS_FRAME_PROOF_CONTRACT;
  assert.equal(c.validation.catalogueYear, 4006);
  assert.equal(c.validation.pinnedDirectionCount, 18);
  assert.equal(c.validation.maximumAngularResidualArcsec, 0.05);
  assert.equal(c.proofOnly, true);
  assert.equal(c.year10026FramePromoted, false);
  assert.equal(c.productionIntegrated, false);
});

test("probe compares mean frame against the apparent-equinox path without claiming a true-ecliptic seasonal plane", async () => {
  const source = await readFile(
    new URL("../scripts/research-swiss-owen-frame-probe.c", import.meta.url),
    "utf8"
  );
  assert.match(source, /swi_bias/);
  assert.match(source, /swi_precess/);
  assert.match(source, /SEFLG_JPLHOR/);
  assert.match(source, /swi_epsiln/);
  assert.match(source, /swi_coortrf/);
  assert.match(source, /swi_nutate\s*\(/);
  assert.match(source, /swi_nutation\s*\(/);
  assert.match(source, /mode, "mean"/);
  assert.match(source, /mode, "apparent"/);
});
