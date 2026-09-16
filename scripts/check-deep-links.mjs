import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const candidate of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const probe = spawnSync("sh", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}

function dumpDom(path) {
  const browser = findBrowser();
  const url = new URL(path, baseURL).href;
  const result = spawnSync(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=1200",
    "--dump-dom",
    url,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Chromium DOM probe failed: ${url}`);
  }
  return { url, dom: result.stdout };
}

function openDetailsById(dom, id) {
  const details = dom.match(new RegExp(`<details[^>]*id="${id}"[^>]*>`))?.[0] ?? "";
  return /\sopen(?:="")?(?:\s|>)/.test(details);
}

function openHiddenPanelFor(dom, branch) {
  const details = dom.match(/<details[^>]*id="hidden-stems-panel"[^>]*>/)?.[0] ?? "";
  return details.includes(`data-hidden-branch="${branch}"`) && /\sopen(?:="")?(?:\s|>)/.test(details);
}

const cases = [
  {
    path: "?month=%E5%AD%90",
    label: "Annual month deep link",
    assert(dom) {
      return /id="center-value"[^>]*>子月<\/text>/.test(dom) &&
        /id="detail-title"[^>]*>子月<\/h2>/.test(dom) &&
        /id="hidden-stems-panel"[^>]*data-hidden-branch="子"/.test(dom) &&
        /子 · 癸/.test(dom);
    },
  },
  {
    path: "?lambda=271.25&yearStem=%E4%B9%99&hidden=1",
    label: "Annual exact Birth + Five Tigers + hidden stems",
    assert(dom) {
      return /data-birth-projection="271\.250000"/.test(dom) &&
        /data-five-tigers="乙"/.test(dom) &&
        /data-month-stem="戊"[^>]*data-month-branch="子"/.test(dom) &&
        /class="five-tigers-readout"/.test(dom) &&
        /目前 戊子月/.test(dom) &&
        openHiddenPanelFor(dom, "子") &&
        /data-hidden-stem="癸"[^>]*data-hidden-role="主"/.test(dom) &&
        /id="center-value"[^>]*>子月<\/text>/.test(dom);
    },
  },
  {
    path: "birth.html?tenGod=1&relations=1",
    label: "Birth Atlas instant links + Ten Gods + visible pair relations",
    assert(dom) {
      const groups = dom.match(/data-ten-god-group="[^"]+"/g) ?? [];
      const exactInstant = "2005-12-23T00%3A37%3A00.000Z";
      return /class="birth-projection-link"/.test(dom) &&
        /data-atlas-cross-view="selected-instant"/.test(dom) &&
        new RegExp(`href="[^"]*\\?instant=${exactInstant}"`).test(dom) &&
        /data-atlas-inspect="year"/.test(dom) &&
        /data-atlas-inspect="month"/.test(dom) &&
        /data-atlas-inspect="day"/.test(dom) &&
        /data-atlas-inspect="hour"/.test(dom) &&
        new RegExp(`data-href="[^"]*\\?instant=${exactInstant}&amp;inspect=year"`).test(dom) &&
        !/sexagenary\.html\?ganzhi=/.test(dom) &&
        !/data-atlas-cross-view="selected-instant"[^>]*(?:lambda|month|yearStem)=/.test(dom) &&
        /年度盤精確定位/.test(dom) &&
        /年干乙/.test(dom) &&
        /UTC\+08:00/.test(dom) &&
        openDetailsById(dom, "ten-gods-panel") &&
        /id="ten-gods-day-master"[^>]*>辛 · 陰金<\/b>/.test(dom) &&
        /id="ten-gods-derivation"/.test(dom) &&
        groups.length === 5 &&
        /data-ten-god-group="resource"[^>]*data-target-element="土"/.test(dom) &&
        /data-ten-god-group="peer"[^>]*data-target-element="金"/.test(dom) &&
        /data-ten-god-group="wealth"[^>]*data-target-element="木"/.test(dom) &&
        /data-polarity="same"[^>]*data-stem="辛"[^>]*data-ten-god="比肩"/.test(dom) &&
        /data-polarity="opposite"[^>]*data-stem="庚"[^>]*data-ten-god="劫財"/.test(dom) &&
        /data-polarity="same"[^>]*data-stem="癸"[^>]*data-ten-god="食神"/.test(dom) &&
        /data-stem="乙"[^>]*data-ten-god="偏財"/.test(dom) &&
        /data-stem="戊"[^>]*data-ten-god="正印"/.test(dom) &&
        /data-stem="壬"[^>]*data-ten-god="傷官"/.test(dom) &&
        /data-hidden-stem="癸"[^>]*data-ten-god="食神"[^>]*data-hidden-role="主"/.test(dom) &&
        openDetailsById(dom, "pillar-relations-panel") &&
        /data-relation-count="1"[^>]*data-group-count="0"/.test(dom) &&
        /data-relation-domain="branch"[^>]*data-relation-kind="six-harmony"[^>]*data-left-pillar="year"[^>]*data-right-pillar="hour"/.test(dom) &&
        /data-relation-kind="six-harmony"/.test(dom) &&
        /年支/.test(dom) && /時支/.test(dom) && /六合/.test(dom) &&
        /目前四柱沒有完整三合／三會/.test(dom) &&
        /data-punishment-count="0"/.test(dom);
    },
  },
  {
    path: "birth.html?relations=1&date=2016-12-20&time=08%3A00&utc=8",
    label: "Birth complete 申子辰 three-harmony deep link",
    assert(dom) {
      return /data-query-preset="1"/.test(dom) &&
        /id="birth-readout"[^>]*>2016-12-20 · 08:00<\/h2>/.test(dom) &&
        openDetailsById(dom, "pillar-relations-panel") &&
        /data-group-count="1"/.test(dom) &&
        /data-group-kind="three-harmony"[^>]*data-group-element="水"[^>]*data-group-members="申子辰"/.test(dom) &&
        /data-group-member="申"[^>]*data-support-pillars="year"/.test(dom) &&
        /data-group-member="子"[^>]*data-support-pillars="month,day"/.test(dom) &&
        /data-group-member="辰"[^>]*data-support-pillars="hour"/.test(dom) &&
        /三合/.test(dom) && /完整三支/.test(dom);
    },
  },
  {
    path: "birth.html?relations=1&date=2022-03-20&time=08%3A00&utc=8",
    label: "Birth complete 寅卯辰 three-meeting deep link",
    assert(dom) {
      return /data-query-preset="1"/.test(dom) &&
        /id="birth-readout"[^>]*>2022-03-20 · 08:00<\/h2>/.test(dom) &&
        openDetailsById(dom, "pillar-relations-panel") &&
        /data-group-count="1"/.test(dom) &&
        /data-group-kind="three-meeting"[^>]*data-group-element="木"[^>]*data-group-members="寅卯辰"/.test(dom) &&
        /data-group-member="寅"[^>]*data-support-pillars="year"/.test(dom) &&
        /data-group-member="卯"[^>]*data-support-pillars="month"/.test(dom) &&
        /data-group-member="辰"[^>]*data-support-pillars="hour"/.test(dom) &&
        /春 · 東方 · 完整三支/.test(dom);
    },
  },
  {
    path: "birth.html?relations=1&date=2022-06-20&time=10%3A00&utc=8",
    label: "Birth real-chart 寅巳 six-harm + directed punishment",
    assert(dom) {
      return /data-query-preset="1"/.test(dom) &&
        /id="birth-readout"[^>]*>2022-06-20 · 10:00<\/h2>/.test(dom) &&
        openDetailsById(dom, "pillar-relations-panel") &&
        /data-relation-domain="branch"[^>]*data-relation-kind="six-harm"[^>]*data-left-pillar="year"[^>]*data-right-pillar="hour"/.test(dom) &&
        /data-punishment-kind="directed"[^>]*data-source-branch="寅"[^>]*data-target-branch="巳"[^>]*data-source-pillar="year"[^>]*data-target-pillar="hour"/.test(dom) &&
        /寅巳申 · 方向鏈/.test(dom);
    },
  },
  {
    path: "birth.html?relations=1&date=2020-06-20&time=06%3A00&utc=8",
    label: "Birth real-chart 子卯 mutual punishment",
    assert(dom) {
      return /id="birth-readout"[^>]*>2020-06-20 · 06:00<\/h2>/.test(dom) &&
        /data-punishment-kind="mutual"[^>]*data-left-branch="子"[^>]*data-right-branch="卯"[^>]*data-left-pillar="year"[^>]*data-right-pillar="hour"/.test(dom) &&
        /子 ↔ 卯/.test(dom);
    },
  },
  {
    path: "birth.html?relations=1&date=2024-06-20&time=08%3A00&utc=8",
    label: "Birth real-chart 辰 self punishment",
    assert(dom) {
      return /id="birth-readout"[^>]*>2024-06-20 · 08:00<\/h2>/.test(dom) &&
        /data-punishment-kind="self"[^>]*data-self-branch="辰"[^>]*data-support-pillars="year,hour"/.test(dom) &&
        /辰 × 2/.test(dom);
    },
  },
  {
    path: "sexagenary.html?ganzhi=%E4%B9%99%E9%85%89",
    label: "Sexagenary Gan-Zhi deep link",
    assert(dom) {
      return /id="cycle-center-value"[^>]*>乙酉<\/text>/.test(dom) &&
        /id="cycle-title"[^>]*>乙酉<\/h2>/.test(dom);
    },
  },
];

for (const testCase of cases) {
  const { url, dom } = dumpDom(testCase.path);
  if (!testCase.assert(dom)) {
    throw new Error(`${testCase.label} did not resolve expected state: ${url}`);
  }
  console.log(`[deep-link] PASS ${testCase.label}: ${url}`);
}
