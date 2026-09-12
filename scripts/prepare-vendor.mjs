import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("node_modules/tyme4ts/dist/lib/index.mjs");
const targetDir = path.resolve("vendor");
const target = path.join(targetDir, "tyme4ts-1.5.2.mjs");

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
console.log(`[vendor] ${source} -> ${target}`);
