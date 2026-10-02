import test from "node:test";
import assert from "node:assert/strict";
import { createDecorativeDrawQueue, decorativeRenderBudget } from "../src/wheel/decorative-render-budget.js";

test("mobile and coarse-pointer landscape material use one CSS pixel and 30 decorative draws/sec", () => {
  for (const viewportWidth of [320, 390, 480]) {
    assert.deepEqual(decorativeRenderBudget({ viewportWidth, devicePixelRatio:3, coarsePointer:false }),
      { mobile:true, pixelRatio:1, frameIntervalMs:1000 / 30 });
  }
  assert.equal(decorativeRenderBudget({ viewportWidth:844, coarsePointer:true }).mobile, true);
  assert.deepEqual(decorativeRenderBudget({ viewportWidth:1440, coarsePointer:false, devicePixelRatio:3 }),
    { mobile:false, pixelRatio:2, frameIntervalMs:0 });
  assert.equal(decorativeRenderBudget({ viewportWidth:390, devicePixelRatio:3, fullQuality:true }).pixelRatio, 2);
  assert.equal(decorativeRenderBudget({ viewportWidth:390, devicePixelRatio:NaN }).pixelRatio, 1);
});

function clockQueue() {
  let time = 0, pose = 0, hidden = false, timerId = 0;
  const timers = new Map(), draws = [];
  const queue = createDecorativeDrawQueue({
    draw:() => draws.push({ time, pose }),
    nowMs:() => time,
    frameIntervalMs:() => 1000 / 30,
    isHidden:() => hidden,
    setTimer(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, at:time + delay });
      return id;
    },
    clearTimer:id => timers.delete(id)
  });
  function advance(next) {
    while (true) {
      const due = [...timers].filter(([, timer]) => timer.at <= next)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      time = due[1].at;
      timers.delete(due[0]);
      due[1].callback();
    }
    time = next;
  }
  return { queue, draws, timers, advance,
    set pose(value) { pose = value; }, set hidden(value) { hidden = value; } };
}

test("120 Hz pose input is bounded while the last pose is drawn after input ends", () => {
  const h = clockQueue();
  for (let n = 0; n < 120; n += 1) {
    h.advance(n * 1000 / 120);
    h.pose = n;
    h.queue.request();
    assert.ok(h.timers.size <= 1);
  }
  h.advance(1050);
  assert.ok(h.draws.length <= 32, `draws=${h.draws.length}`);
  assert.ok(h.draws.length >= 30);
  assert.equal(h.draws.at(-1).pose, 119);
  assert.equal(h.timers.size, 0);
});

test("pending material stays quiet in a hidden document and resumes with its newest pose", () => {
  const h = clockQueue();
  h.queue.request();
  h.advance(10);
  h.pose = 1;
  h.queue.request();
  h.hidden = true;
  h.queue.visibilityChanged();
  h.pose = 2;
  h.queue.request();
  h.advance(1000);
  assert.equal(h.draws.length, 1);
  assert.equal(h.timers.size, 0);
  h.hidden = false;
  h.queue.visibilityChanged();
  assert.equal(h.draws.at(-1).pose, 2);
  assert.equal(h.timers.size, 0);
});

test("geometry invalidation draws immediately and cancels the stale delayed submission", () => {
  const h = clockQueue();
  h.queue.request();
  h.advance(10);
  h.queue.request();
  h.pose = 5;
  h.queue.request({ immediate:true });
  assert.equal(h.draws.at(-1).pose, 5);
  assert.equal(h.timers.size, 0);
  h.advance(100);
  assert.equal(h.draws.length, 2);
});
