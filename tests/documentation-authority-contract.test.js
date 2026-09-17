import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const architecture = readFileSync(new URL("../docs/architecture-contracts.md", import.meta.url), "utf8");
const status = readFileSync(new URL("../docs/current-status.md", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

const DIRECT_EVENT_PROVIDER = "jpl-de441-seasonal-events-v1";

test("normative docs describe Atlas temporal context as explicit rather than pinned UTC+08 authority", () => {
  assert.match(architecture, /## 2\. Atlas temporal context is explicit and shareable/);
  assert.match(architecture, /production default remains \*\*UTC\+08:00 \+ Zi-initial 23:00 next-day\*\*/);
  assert.match(architecture, /UTC offset must never be multiplied by 15° and silently promoted into longitude/);
  assert.match(architecture, /Changing temporal context does not silently move `selectedMs`/);

  assert.doesNotMatch(architecture, /The atlas civil reference is explicitly UTC\+08:00/);
  assert.match(readme, /UTC\+08:00 \+ Zi-initial 23:00 as the production default/);
  assert.match(readme, /UTC offset is not geographic longitude/);
});

test("documentation keeps bounded year-4006 direct-event runtime distinct from general DE441 state authority", () => {
  for (const text of [architecture, status, readme]) {
    assert.match(text, new RegExp(DIRECT_EVENT_PROVIDER));
  }

  assert.match(architecture, /coverage \*\*4006 only\*\*/);
  assert.match(architecture, /does \*\*not\*\* expose the proof-only DE441 state windows as a general absolute-state runtime adapter/);
  assert.match(readme, /bounded runtime slice is \*\*not\*\* a general DE441 state adapter/);

  assert.doesNotMatch(architecture, /longitude-crossing root solve has not yet been composed/);
  assert.doesNotMatch(readme, /Production deep-time seasonal epochs remain fail-closed until a real state adapter/);
});

test("documentation roles keep product checkpoint and architecture contracts complementary", () => {
  assert.match(architecture, /`docs\/current-status\.md` is the current product\/implementation checkpoint/);
  assert.match(architecture, /this file is the normative cross-cutting architecture contract/);
  assert.match(readme, /`docs\/current-status\.md`\]\(docs\/current-status\.md\) — current product\/implementation checkpoint and release frontier/);
  assert.match(readme, /`docs\/architecture-contracts\.md`\]\(docs\/architecture-contracts\.md\) — normative cross-cutting architecture and authority contracts/);
});
