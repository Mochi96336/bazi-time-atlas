import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { VISUAL_CI_SUITES } from "./visual-ci-suites.mjs";

const suite = process.argv[2];
const scripts = Object.hasOwn(VISUAL_CI_SUITES, suite)
  ? VISUAL_CI_SUITES[suite]
  : null;
if (!scripts?.length) {
  console.error("Unknown visual CI suite:", suite, "available:", Object.keys(VISUAL_CI_SUITES).join(", "));
  process.exit(2);
}

const started = performance.now();
for (const name of scripts) {
  const script = resolve("scripts", name);
  if (!existsSync(script)) {
    console.error("Missing required visual check:", script);
    process.exit(2);
  }
  console.log(`[visual-ci:${suite}] START ${name}`);
  const stepStarted = performance.now();
  const result = spawnSync(process.execPath, [script], {
    stdio:"inherit",
    env:process.env
  });
  const seconds = ((performance.now() - stepStarted) / 1000).toFixed(1);
  if (result.error || result.status !== 0) {
    console.error(`[visual-ci:${suite}] FAIL ${name} after ${seconds}s (${result.error?.message ?? result.status ?? result.signal})`);
    process.exit(result.status || 1);
  }
  console.log(`[visual-ci:${suite}] PASS ${name} in ${seconds}s`);
}
console.log(`[visual-ci:${suite}] PASS all ${scripts.length} checks in ${((performance.now()-started)/1000).toFixed(1)}s`);
