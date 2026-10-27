import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { VISUAL_CI_SUITES } from "../scripts/visual-ci-suites.mjs";

const workflow = readFileSync(new URL("../.github/workflows/visual.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("parallel visual CI retains every existing screenshot command and determinacy PNG", () => {
  const priorCommands = packageJson.scripts["visual:check"].split(" && ")
    .map(command => {
      const match = command.match(/^node (scripts\/[\w-]+\.mjs)$/);
      assert.ok(match, "unexpected visual:check command: " + command);
      return match[1].replace("scripts/", "");
    });
  const screenshotSuites = Object.entries(VISUAL_CI_SUITES)
    .filter(([name]) => name.startsWith("capture-"));
  const screenshotChecks = screenshotSuites.flatMap(([, checks]) => checks);
  assert.equal(new Set(screenshotChecks).size, screenshotChecks.length, "duplicate screenshot checks");
  assert.deepEqual(
    [...screenshotChecks].sort(),
    [...priorCommands, "visual-check-determinacy.mjs", "visual-check-research-01-diagram-lab.mjs", "visual-check-research-02-diagram-lab.mjs", "visual-check-research-02-production.mjs", "visual-check-research-03-diagram-lab.mjs", "visual-check-research-03-production.mjs", "visual-check-r22-native-fan-baseline.mjs"].sort(),
    "parallel PNG CI must preserve the complete existing visual:check inventory"
  );
  assert.ok(VISUAL_CI_SUITES["capture-material"].indexOf("visual-check-material-prototype.mjs")
    < VISUAL_CI_SUITES["capture-material"].indexOf("visual-check-material-ablation.mjs"),
    "material ablation depends on prototype screenshot files");
});

test("all seven matrix shards execute real existing scripts exactly once", () => {
  const expected = ["shader", "home", "research",
    "capture-pages", "capture-interactions", "capture-material", "capture-responsive"];
  assert.deepEqual(Object.keys(VISUAL_CI_SUITES), expected);
  const scripts = Object.values(VISUAL_CI_SUITES).flat();
  assert.equal(new Set(scripts).size, scripts.length);
  assert.equal(scripts.length, 54, "keep the full browser + screenshot checks, including seasonal Research, Research diagram labs, and Research production evidence");
  for (const script of scripts) {
    assert.ok(existsSync(new URL("../scripts/" + script, import.meta.url)), "missing " + script);
  }
  assert.match(workflow, /suite: \[shader, home, research, capture-pages, capture-interactions, capture-material, capture-responsive\]/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /run: node scripts\/run-visual-ci-suite\.mjs/);
  assert.ok(VISUAL_CI_SUITES.research.includes("check-seasonal-drift-evidence-live.mjs"));
  assert.ok(
    VISUAL_CI_SUITES["capture-pages"].includes("visual-check-research-01-diagram-lab.mjs"),
    "Research 01 diagram lab must keep deterministic desktop/mobile PNG evidence"
  );
  assert.ok(
    VISUAL_CI_SUITES["capture-pages"].includes("visual-check-research-02-diagram-lab.mjs"),
    "Research 02 diagram lab must keep deterministic desktop/mobile PNG evidence"
  );
  assert.ok(
    VISUAL_CI_SUITES["capture-pages"].includes("visual-check-research-02-production.mjs"),
    "Research 02 production must keep deterministic desktop/mobile PNG evidence"
  );
  assert.ok(
    VISUAL_CI_SUITES["capture-pages"].includes("visual-check-research-03-diagram-lab.mjs"),
    "Research 03 diagram lab must keep deterministic desktop/mobile PNG evidence"
  );
  assert.ok(
    VISUAL_CI_SUITES["capture-pages"].includes("visual-check-research-03-production.mjs"),
    "Research 03 production must keep deterministic desktop/mobile PNG evidence"
  );
});

test("parallel visual gate preserves prior CI protection and combined PNG artifact", () => {
  assert.match(workflow, /capture:\s*\n\s*name: capture/);
  assert.match(workflow, /needs: verify/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /test "\$VERIFY_RESULT" = "success"/);
  assert.match(workflow, /merge-multiple: true/);
  assert.ok(workflow.includes("pattern: visual-shard-*"));
  assert.match(workflow, /matrix.suite == 'home'/, "home diagnostic evidence must reach the combined artifact");
  assert.match(workflow, /mobile-camera-lifecycle.json/);
  assert.match(workflow, /mobile-camera-recovered-390x844.png/);
  assert.match(workflow, /mobile-material-budget.json/);
  assert.ok(workflow.includes('test "$file_count" -ge 94'), "keep at least 94 combined evidence files");
  assert.match(workflow, /name: visual-png-selfcheck/);
  assert.match(workflow, /run: npm run vendor:prepare/, "browser vendor must be generated without full npm test");
  assert.doesNotMatch(workflow, /^\s*run: npm test\s*$/m, "Quality Gate owns duplicated Node tests");
  const quality = readFileSync(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");
  assert.match(quality, /run: npm run check/, "Quality Gate must still run tests and syntax");
});