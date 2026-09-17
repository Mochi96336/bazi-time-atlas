import test from "node:test";
import assert from "node:assert/strict";

import { createFrameCommitQueue } from "../src/interaction/frame-commit-queue.js";

class FakeFrames {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
  }

  request = callback => {
    const id = this.nextId++;
    this.pending.set(id, callback);
    return id;
  };

  cancel = id => this.pending.delete(id);

  run(timeStamp = 0) {
    const entry = this.pending.entries().next().value;
    if (!entry) return false;
    const [id, callback] = entry;
    this.pending.delete(id);
    callback(timeStamp);
    return true;
  }
}

test("many schedules before a display frame collapse into one commit", () => {
  const frames = new FakeFrames();
  let commits = 0;
  const queue = createFrameCommitQueue({
    commit: () => { commits += 1; },
    requestFrame: frames.request,
    cancelFrame: frames.cancel
  });

  assert.equal(queue.schedule(), true);
  assert.equal(queue.schedule(), false);
  assert.equal(queue.schedule(), false);
  assert.equal(frames.pending.size, 1);
  assert.equal(commits, 0);

  assert.equal(frames.run(16), true);
  assert.equal(commits, 1);
  assert.equal(queue.pending, false);
  assert.equal(queue.scheduled, false);
});

test("flush commits immediately and cancels the queued animation frame", () => {
  const frames = new FakeFrames();
  let commits = 0;
  const queue = createFrameCommitQueue({
    commit: () => { commits += 1; },
    requestFrame: frames.request,
    cancelFrame: frames.cancel
  });

  queue.schedule();
  assert.equal(frames.pending.size, 1);
  assert.equal(queue.flush(), true);
  assert.equal(commits, 1);
  assert.equal(frames.pending.size, 0);
  assert.equal(queue.flush(), false);
});

test("cancel drops pending work without committing it", () => {
  const frames = new FakeFrames();
  let commits = 0;
  const queue = createFrameCommitQueue({
    commit: () => { commits += 1; },
    requestFrame: frames.request,
    cancelFrame: frames.cancel
  });

  queue.schedule();
  assert.equal(queue.cancel(), true);
  assert.equal(frames.pending.size, 0);
  assert.equal(queue.pending, false);
  assert.equal(commits, 0);
});

test("missing requestAnimationFrame falls back to an immediate commit", () => {
  let commits = 0;
  const queue = createFrameCommitQueue({
    commit: () => { commits += 1; },
    requestFrame: null,
    cancelFrame: null
  });

  assert.equal(queue.schedule(), true);
  assert.equal(commits, 1);
  assert.equal(queue.pending, false);
  assert.equal(queue.scheduled, false);
});
