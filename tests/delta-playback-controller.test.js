import test from "node:test";
import assert from "node:assert/strict";

import { createDeltaPlaybackController } from "../src/recurrence/delta-playback-controller.js";

class FakeElement {
  constructor(text = "") {
    this.textContent = text;
    this.attributes = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function fakeFrames() {
  let nextId = 0;
  const callbacks = new Map();
  const cancelled = [];
  return {
    callbacks,
    cancelled,
    requestFrame(callback) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      cancelled.push(id);
      callbacks.delete(id);
    }
  };
}

test("Research time playback advances the canonical delta and owns Play/Pause UI", () => {
  let delta = 0;
  const updates = [];
  const stops = [];
  const button = new FakeElement();
  const icon = new FakeElement("▶");
  const label = new FakeElement("播放");
  const frames = fakeFrames();
  const controller = createDeltaPlaybackController({
    playButton:button,
    playIcon:icon,
    playLabel:label,
    getDelta:() => delta,
    setDelta:(value, options) => {
      delta = value;
      updates.push({ value, options });
    },
    maxDelta:() => 24000,
    yearsPerSecond:20,
    requestFrame:frames.requestFrame,
    cancelFrame:frames.cancelFrame,
    onStop:payload => stops.push(payload)
  });

  assert.equal(button.getAttribute("aria-pressed"), "false");
  controller.start();
  assert.equal(controller.playing, true);
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(button.getAttribute("aria-label"), "暫停時間推演");
  assert.equal(icon.textContent, "Ⅱ");
  assert.equal(label.textContent, "暫停");

  frames.callbacks.get(1)(1000);
  frames.callbacks.get(2)(1100);
  assert.equal(delta, 2);
  assert.deepEqual(updates.at(-1), {
    value:2,
    options:{ source:"playback", syncQuery:false }
  });

  controller.stop();
  assert.equal(controller.playing, false);
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.getAttribute("aria-label"), "播放時間推演");
  assert.equal(icon.textContent, "▶");
  assert.equal(label.textContent, "播放");
  assert.deepEqual(stops, [{ commit:true }]);
});

test("Research time playback stops at 24000 and restarts from zero at the edge", () => {
  let delta = 23999;
  const updates = [];
  const frames = fakeFrames();
  const controller = createDeltaPlaybackController({
    playButton:new FakeElement(),
    playIcon:new FakeElement(),
    playLabel:new FakeElement(),
    getDelta:() => delta,
    setDelta:(value, options) => {
      delta = value;
      updates.push({ value, options });
    },
    maxDelta:() => 24000,
    yearsPerSecond:20,
    requestFrame:frames.requestFrame,
    cancelFrame:frames.cancelFrame
  });

  controller.start();
  frames.callbacks.get(1)(1000);
  frames.callbacks.get(2)(1100);
  assert.equal(delta, 24000);
  assert.equal(controller.playing, false);

  controller.start();
  assert.equal(delta, 0);
  assert.deepEqual(updates.at(-1), {
    value:0,
    options:{ source:"playback-reset", syncQuery:true }
  });
  assert.equal(controller.playing, true);
});

test("manual takeover can stop playback without committing a second query state", () => {
  let delta = 400;
  const stops = [];
  const frames = fakeFrames();
  const controller = createDeltaPlaybackController({
    playButton:new FakeElement(),
    playIcon:new FakeElement(),
    playLabel:new FakeElement(),
    getDelta:() => delta,
    setDelta:value => { delta = value; },
    maxDelta:() => 24000,
    requestFrame:frames.requestFrame,
    cancelFrame:frames.cancelFrame,
    onStop:payload => stops.push(payload)
  });

  controller.start();
  controller.stop({ commit:false });
  assert.equal(controller.playing, false);
  assert.deepEqual(stops, [{ commit:false }]);
});
