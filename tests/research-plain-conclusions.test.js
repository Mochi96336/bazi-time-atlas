import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../recurrence.html", import.meta.url), "utf8");

test("each Research section opens with a plain-language conclusion right after its header", () => {
  for (const [section, id] of [["01", "research-discrete"], ["02", "research-astronomy"], ["03", "research-evidence"]]) {
    const block = html.slice(html.indexOf(`<section id="${id}"`));
    const afterHeader = block.slice(block.indexOf("</header>") + "</header>".length).trimStart();
    assert.match(afterHeader, new RegExp(`^<p class="research-plain-conclusion" data-plain-conclusion="${section}">`), section);
  }
});

test("plain conclusions avoid unexplained jargon", () => {
  const conclusions = [...html.matchAll(/data-plain-conclusion="\d+">([^<]+)</g)].map(match => match[1]);
  assert.equal(conclusions.length, 3);
  for (const text of conclusions) {
    assert.doesNotMatch(text, /\b(TT|UT1|LCM|DE441)\b|離散|代理|相位|黃經|reference|proxy/);
  }
});
