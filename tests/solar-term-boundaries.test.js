import test from "node:test";
import assert from "node:assert/strict";
import { SolarTerm } from "tyme4ts";
import {
  SOLAR_TERM_REFERENCE_UTC_OFFSET,
  formatSolarTermEvent,
  jieBoundaryContext,
  solarTermEventsBetween,
  solarTermEventsForCivilYear
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
