import test from "node:test";
import assert from "node:assert/strict";

import { createKineticPlaybackController } from "../src/interaction/kinetic-playback-controller.js";
import { DAY_MS } from "../src/interaction/kinetic-playback.js";

class FakeElement {
  constructor() {
    this.textContent = "";
    this.value = "";
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function createFakeFrames() {
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

function createState(overrides = {}) {
  return {
    anchorMs: 0,
    selectedMs: 0,
    scale: "day",
    playing: false,
    animationFrame: null,
    lastAnimationTs: null,
    ...overrides
  };
}

test("playback controller owns start, frame advance, and stop UI lifecycle", () => {
  const state = createState();
  const slider = new FakeElement();
  const playButton = new FakeElement();
  const frames = createFakeFrames();
  let prepareCalls = 0;
  let renderCalls = 0;
  const controller = createKineticPlaybackController({
    state,
    slider,
    playButton,
    updateWheel: () => { renderCalls += 1; },
    prepareStart: () => {
      assert.equal(state.playing, false);
      prepareCalls += 1;
    },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  });

  controller.start();
  assert.equal(prepareCalls, 1);
  assert.equal(state.playing, true);
  assert.equal(state.animationFrame, 1);
  assert.equal(playButton.textContent, "暫停");
  assert.equal(playButton.getAttribute("aria-pressed"), "true");

  frames.callbacks.get(1)(1000);
  assert.equal(state.selectedMs, 0);
  assert.equal(state.lastAnimationTs, 1000);
  assert.equal(state.animationFrame, 2);
  assert.equal(renderCalls, 0);

  frames.callbacks.get(2)(1100);
  assert.equal(state.selectedMs, DAY_MS * 0.025);
  assert.equal(Number(slider.value), 0.025);
  assert.equal(state.lastAnimationTs, 1100);
  assert.equal(state.animationFrame, 3);
  assert.equal(renderCalls, 1);

  controller.stop();
  assert.equal(state.playing, false);
  assert.equal(state.animationFrame, null);
  assert.equal(state.lastAnimationTs, null);
  assert.deepEqual(frames.cancelled, [3]);
  assert.equal(playButton.textContent, "播放");
  assert.equal(playButton.getAttribute("aria-pressed"), "false");
});

test("playback controller clamps at the scale edge and stops without scheduling another frame", () => {
  const state = createState({ selectedMs: DAY_MS * 0.99 });
  const slider = new FakeElement();
  const playButton = new FakeElement();
  const frames = createFakeFrames();
  let renderCalls = 0;
  const controller = createKineticPlaybackController({
    state,
    slider,
    playButton,
    updateWheel: () => { renderCalls += 1; },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  });

  controller.start();
  frames.callbacks.get(1)(1000);
  frames.callbacks.get(2)(1100);

  assert.equal(state.selectedMs, DAY_MS);
  assert.equal(slider.value, "1");
  assert.equal(renderCalls, 1);
  assert.equal(state.playing, false);
  assert.equal(state.animationFrame, null);
  assert.equal(state.lastAnimationTs, null);
  assert.deepEqual(frames.cancelled, [2]);
  assert.equal(playButton.textContent, "播放");
  assert.equal(playButton.getAttribute("aria-pressed"), "false");
});

test("toggle delegates only between playback start and stop", () => {
  const state = createState();
  const slider = new FakeElement();
  const playButton = new FakeElement();
  const frames = createFakeFrames();
  const controller = createKineticPlaybackController({
    state,
    slider,
    playButton,
    updateWheel() {},
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame
  });

  controller.toggle();
  assert.equal(controller.playing, true);
  assert.equal(state.animationFrame, 1);

  controller.toggle();
  assert.equal(controller.playing, false);
  assert.equal(state.animationFrame, null);
  assert.deepEqual(frames.cancelled, [1]);
});
