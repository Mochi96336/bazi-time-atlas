import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("material shader probe retries only Chromium launch failures with a bounded attempt count", async () => {
  const source = await readFile(
    new URL("../scripts/check-material-shader.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /const launchAttempts = 2;/);
  assert.match(source, /for \(let attempt = 1; attempt <= launchAttempts; attempt \+= 1\)/);
  assert.match(source, /if \(result\.status === 0\) return result;/);
  assert.match(source, /RETRY launch/);
  assert.match(source, /failed to launch Chromium after bounded retry/);
});

test("shader activation assertion stays outside the launch retry loop", async () => {
  const source = await readFile(
    new URL("../scripts/check-material-shader.mjs", import.meta.url),
    "utf8"
  );

  const launchFunctionEnd = source.indexOf("\n}\n\nconst browser = findBrowser()");
  const shaderAssertion = source.indexOf("if (!result.stdout.includes");
  assert.ok(launchFunctionEnd > 0);
  assert.ok(shaderAssertion > launchFunctionEnd);
});
