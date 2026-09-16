import test from "node:test";
import assert from "node:assert/strict";

import {
  clearLegacyProjectionUrl,
  selectedInstantUrl
} from "../src/interaction/selected-instant-url.js";

test("committed Selected Instant replaces legacy projection and preserves unrelated URL state", () => {
  const instantMs = Date.parse("2026-09-15T20:14:52.000Z");
  const href = selectedInstantUrl(
    "https://example.test/atlas/?lambda=271.25&month=%E5%AD%90&yearStem=%E4%B9%99&keep=1#analysis",
    instantMs
  );
  const url = new URL(href);
  assert.equal(url.searchParams.get("instant"), "2026-09-15T20:14:52.000Z");
  assert.equal(url.searchParams.get("keep"), "1");
  assert.equal(url.hash, "#analysis");
  assert.equal(url.searchParams.has("lambda"), false);
  assert.equal(url.searchParams.has("month"), false);
  assert.equal(url.searchParams.has("yearStem"), false);
});

test("committed Selected Instant replaces an older exact instant instead of accumulating state", () => {
  const href = selectedInstantUrl(
    "https://example.test/atlas/?instant=2026-01-01T00%3A00%3A00.000Z&keep=1",
    Date.parse("2026-09-15T20:15:09.000Z")
  );
  const url = new URL(href);
  assert.deepEqual(url.searchParams.getAll("instant"), ["2026-09-15T20:15:09.000Z"]);
  assert.equal(url.searchParams.get("keep"), "1");
});

test("leaving legacy projection removes only projection keys", () => {
  const href = clearLegacyProjectionUrl(
    "https://example.test/atlas/?lambda=271.25&month=%E5%AD%90&yearStem=%E4%B9%99&keep=1#analysis"
  );
  const url = new URL(href);
  assert.equal(url.searchParams.get("keep"), "1");
  assert.equal(url.hash, "#analysis");
  assert.equal(url.searchParams.has("lambda"), false);
  assert.equal(url.searchParams.has("month"), false);
  assert.equal(url.searchParams.has("yearStem"), false);
});

test("clearing projection keys never discards an already committed exact instant", () => {
  const href = clearLegacyProjectionUrl(
    "https://example.test/atlas/?instant=2026-09-15T20%3A14%3A52.000Z&lambda=271.25&keep=1#analysis"
  );
  const url = new URL(href);
  assert.equal(url.searchParams.get("instant"), "2026-09-15T20:14:52.000Z");
  assert.equal(url.searchParams.get("keep"), "1");
  assert.equal(url.hash, "#analysis");
  assert.equal(url.searchParams.has("lambda"), false);
});

test("invalid URL or instant inputs fail closed", () => {
  assert.equal(selectedInstantUrl("not a url", Date.now()), null);
  assert.equal(selectedInstantUrl("https://example.test/atlas/", Number.NaN), null);
  assert.equal(selectedInstantUrl("https://example.test/atlas/", Number.MAX_VALUE), null);
  assert.equal(clearLegacyProjectionUrl("not a url"), null);
});
