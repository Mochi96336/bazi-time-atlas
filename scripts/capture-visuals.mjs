import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const outputDir = fileURLToPath(new URL("../visual-artifacts/", import.meta.url));

const viewports = [
  {
    name: "desktop-1440x1100",
    context: {
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
  },
  {
    name: "tablet-834x1112",
    context: {
      viewport: { width: 834, height: 1112 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: true,
    },
  },
  {
    name: "iphone-428x926",
    context: {
      viewport: { width: 428, height: 926 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const diagnostics = [];
let failed = false;

try {
  for (const scenario of viewports) {
    const context = await browser.newContext({
      ...scenario.context,
      locale: "zh-TW",
    });
    const page = await context.newPage();

    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.locator("#atlas-wheel").waitFor({ state: "visible" });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const wheel = document.querySelector("#atlas-wheel");
      const frame = document.querySelector(".wheel-frame");
      const inspector = document.querySelector(".inspector");
      const wheelRect = wheel?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      const inspectorRect = inspector?.getBoundingClientRect();
      const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth ?? 0);
      const clientWidth = root.clientWidth;

      return {
        viewport: { width: innerWidth, height: innerHeight },
        document: {
          scrollWidth,
          clientWidth,
          horizontalOverflowPx: Math.max(0, scrollWidth - clientWidth),
          scrollHeight: root.scrollHeight,
        },
        wheel: wheelRect
          ? {
              width: Math.round(wheelRect.width * 100) / 100,
              height: Math.round(wheelRect.height * 100) / 100,
              visible: wheelRect.width > 0 && wheelRect.height > 0,
            }
          : null,
        frame: frameRect
          ? {
              width: Math.round(frameRect.width * 100) / 100,
              height: Math.round(frameRect.height * 100) / 100,
            }
          : null,
        inspector: inspectorRect
          ? {
              width: Math.round(inspectorRect.width * 100) / 100,
              top: Math.round(inspectorRect.top * 100) / 100,
            }
          : null,
      };
    });

    const issues = [];
    if (!result.wheel?.visible) issues.push("atlas wheel is not visible");
    if ((result.document.horizontalOverflowPx ?? 0) > 2) {
      issues.push(`horizontal overflow: ${result.document.horizontalOverflowPx}px`);
    }
    if ((result.wheel?.width ?? 0) < Math.min(300, result.viewport.width - 32)) {
      issues.push(`atlas wheel rendered unexpectedly narrow: ${result.wheel?.width ?? 0}px`);
    }

    await page.screenshot({
      path: path.join(outputDir, `${scenario.name}-full.png`),
      fullPage: true,
      animations: "disabled",
    });

    await page.locator(".wheel-frame").screenshot({
      path: path.join(outputDir, `${scenario.name}-wheel.png`),
      animations: "disabled",
    });

    diagnostics.push({ name: scenario.name, ...result, issues });
    if (issues.length) failed = true;

    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDir, "diagnostics.json"),
  `${JSON.stringify(diagnostics, null, 2)}\n`,
  "utf8",
);

for (const entry of diagnostics) {
  const status = entry.issues.length ? "FAIL" : "PASS";
  console.log(
    `[${status}] ${entry.name}: wheel=${entry.wheel?.width ?? 0}px, overflow=${entry.document.horizontalOverflowPx}px`,
  );
  for (const issue of entry.issues) console.error(`  - ${issue}`);
}

if (failed) process.exitCode = 1;
