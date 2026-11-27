// Screenshots of research scenes at several sizes, for looking (the user
// judges by eye; check phone AND desktop for every scene you touched).
//
//   node scripts/research-checks/shots.mjs                       default sizes and scenes
//   node scripts/research-checks/shots.mjs 390x844,1280x720 c22:.38,end:.9
//
// Files: tmp/research-checks/shot-<w>x<h>-<scene>-<p>.jpg
import { writeFileSync } from "node:fs";
import { OUT, launch, openResearch, screen, sleep, viewport } from "./cdp.mjs";

const sizes = (process.argv[2] || "390x844,1280x720,1920x1080").split(",").map(s => s.split("x").map(Number));
const scenes = (process.argv[3] || "open1:.9,c11:.5,c22:.38,c24:.6,c32:.6,end:.9").split(",").map(s => { const [id, p] = s.split(":"); return [id, Number(p)]; });

const b = await launch();
for (const [w, h] of sizes) {
  await viewport(b, w, h);
  await openResearch(b);
  for (const [id, p] of scenes) {
    // (a jump on a phone dims, scrolls, and the scroll feel may settle onto a stop)
    await b.ev(`__research.jump(${JSON.stringify(id)}, ${p}), 1`);
    await sleep(2200);
    const file = `${OUT}/shot-${w}x${h}-${id}-${p}.jpg`;
    writeFileSync(file, await screen(b, { scale: Math.min(1, 1280 / w) }));
    console.log(file);
  }
}
b.close();
