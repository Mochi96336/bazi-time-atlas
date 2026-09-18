import test from "node:test";
import assert from "node:assert/strict";
import { SolarTerm } from "tyme4ts";
import {
  SOLAR_TERM_REFERENCE_UTC_OFFSET,
  formatSolarTermEvent,
  jieBoundaryContext,
  solarTermEventsBetween,
  solarTermEventsForCivilYear,
  solarTermNamedEventsBetween
} from "../src/astronomy/solar-term-boundaries.js";

const HOUR_MS = 3_600_000;

function utcMillisFromTymeSolarTime(time) {
  const date = new Date(0);
  date.setUTCFullYear(time.getYear(), time.getMonth() - 1, time.getDay());
  date.setUTCHours(time.getHour(), time.getMinute(), time.getSecond(), 0);
  return date.getTime() - SOLAR_TERM_REFERENCE_UTC_OFFSET * HOUR_MS;
}

test("2024 civil year exposes all 24 exact solar-term events in chronological order", () => {
  const events = solarTermEventsForCivilYear(2024);
  assert.equal(events.length, 24);
  assert.equal(events.filter(event => event.kind === "jie").length, 12);
  assert.equal(new Set(events.map(event => event.name)).size, 24);
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(events[index].instantMs > events[index - 1].instantMs);
  }
});

test("Li Chun event is the same physical instant as Tyme's exact boundary", () => {
  const event = solarTermEventsForCivilYear(2024).find(item => item.name === "立春");
  const tyme = SolarTerm.fromName(2024, "立春").getJulianDay().getSolarTime();
  assert.equal(event.instantMs, utcMillisFromTymeSolarTime(tyme));
  assert.match(formatSolarTermEvent(event), /^立春 2024-02-/);
});

test("jie boundary context changes sides exactly across Li Chun", () => {
  const liChun = solarTermEventsForCivilYear(2024).find(item => item.name === "立春");
  const before = jieBoundaryContext(liChun.instantMs - 1_000);
  const after = jieBoundaryContext(liChun.instantMs + 1_000);

  assert.equal(before.next.name, "立春");
  assert.equal(before.next.instantMs, liChun.instantMs);
  assert.equal(after.previous.name, "立春");
  assert.equal(after.previous.instantMs, liChun.instantMs);
});

test("eventsBetween keeps exact jie events across a narrow boundary window", () => {
  const jingZhe = solarTermEventsForCivilYear(2024).find(item => item.name === "驚蟄");
  const events = solarTermEventsBetween(jingZhe.instantMs - 2_000, jingZhe.instantMs + 2_000);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "驚蟄");
});

test("named range query can build a multi-decade Li Chun rail without expanding all 24 terms", () => {
  const start = Date.UTC(2020, 0, 1);
  const end = Date.UTC(2030, 11, 31, 23, 59, 59);
  const events = solarTermNamedEventsBetween(start, end, ["立春"]);
  assert.equal(events.length, 11);
  assert.ok(events.every(event => event.name === "立春"));
  assert.equal(events[0].referenceFields.year, 2020);
  assert.equal(events.at(-1).referenceFields.year, 2030);
});


test("default jie context reuses the same interval without changing boundary ownership", () => {
  const events = solarTermEventsForCivilYear(2024).filter(event => event.kind === "jie");
  const previous = events[3];
  const next = events[4];
  const firstMs = previous.instantMs + Math.floor((next.instantMs - previous.instantMs) / 3);
  const secondMs = previous.instantMs + Math.floor((next.instantMs - previous.instantMs) * 2 / 3);

  const first = jieBoundaryContext(firstMs);
  const second = jieBoundaryContext(secondMs);

  assert.equal(first.previous, previous);
  assert.equal(first.next, next);
  assert.equal(second.previous, previous);
  assert.equal(second.next, next);
  assert.notEqual(first, second);
});

test("explicit search span bypasses the default jie interval cache", () => {
  const events = solarTermEventsForCivilYear(2024).filter(event => event.kind === "jie");
  const previous = events[5];
  const next = events[6];
  const middleMs = previous.instantMs + Math.floor((next.instantMs - previous.instantMs) / 2);

  const seeded = jieBoundaryContext(middleMs);
  assert.equal(seeded.previous, previous);
  assert.equal(seeded.next, next);

  const narrow = jieBoundaryContext(middleMs, { searchSpanDays:1 });
  assert.equal(narrow.previous, null);
  assert.equal(narrow.next, null);
});
