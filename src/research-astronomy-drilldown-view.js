const task = document.querySelector("#research-astronomy");

function ensureStyles() {
  if (document.querySelector("link[data-research-astronomy-drilldown-styles]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./research-astronomy-drilldown.css";
  link.dataset.researchAstronomyDrilldownStyles = "1";
  document.head.appendChild(link);
}

function makeDetails(id, label) {
  const details = document.createElement("details");
  details.id = id;
  details.className = "research-astronomy-drilldown";
  details.dataset.researchDrilldown = id;
  const summary = document.createElement("summary");
  summary.textContent = label;
  details.appendChild(summary);
  return details;
}

function installAstronomyResidualDetail() {
  if (!task || document.querySelector("#astronomy-residual-detail")) return;
  const panel = task.querySelector(".astronomy-panel");
  const termGrid = task.querySelector("#astronomy-term-grid");
  const headline = panel?.firstElementChild;
  const headlineLabel = headline?.querySelector("span");
  const maxResidual = headline?.querySelector("#astronomy-max-residual");
  const rmsResidual = headline?.querySelector("#astronomy-rms-residual");
  if (!panel || !termGrid || !headline || !headlineLabel || !maxResidual || !rmsResidual) return;

  headline.classList.add("research-astronomy-rms-rail");
  headline.dataset.astronomyVisibleMetric = "rms";
  headlineLabel.textContent = "RMS 殘差";

  const detail = makeDetails("astronomy-residual-detail", "十二節殘差與模型參數");
  const meta = document.createElement("div");
  meta.className = "astronomy-detail-meta";

  const maxMetric = document.createElement("div");
  maxMetric.className = "astronomy-detail-max";
  maxMetric.dataset.astronomyDetailMetric = "max-residual";
  const maxLabel = document.createElement("span");
  maxLabel.textContent = "最大殘差";
  maxMetric.append(maxLabel, maxResidual);
  meta.appendChild(maxMetric);

  [...panel.children].slice(1).forEach(node => meta.appendChild(node));
  detail.append(meta, termGrid);
  panel.insertAdjacentElement("afterend", detail);
}

function installNearRecurrenceDetail() {
  if (!task || document.querySelector("#near-recurrence-detail")) return;
  const panel = task.querySelector(".near-search-panel");
  const body = panel?.querySelector(".near-search-body");
  if (!panel || !body) return;

  const detail = makeDetails("near-recurrence-detail", "候選分布與排名");
  detail.appendChild(body);
  panel.appendChild(detail);
}

function installMonthBoundaryDetail() {
  if (!task || document.querySelector("#month-boundary-detail")) return true;
  const panel = task.querySelector("#month-boundary-exposure");
  if (!panel) return false;

  const copy = panel.querySelector(".month-boundary-copy");
  const heading = copy?.querySelector("h3");
  const prose = copy?.querySelector("p");
  const impact = panel.querySelector(".pillar-impact-strip");
  const attribution = panel.querySelector(".full-pillar-attribution");
  const windows = panel.querySelector("#month-boundary-window-grid");

  if (heading) heading.textContent = "交節分歧窗口";

  const detail = makeDetails("month-boundary-detail", "交節窗口明細");
  if (prose) detail.appendChild(prose);
  if (impact) detail.appendChild(impact);
  if (attribution) detail.appendChild(attribution);
  if (windows) detail.appendChild(windows);
  panel.appendChild(detail);
  return true;
}

function install() {
  if (!task) return;
  ensureStyles();
  installAstronomyResidualDetail();
  installNearRecurrenceDetail();
  if (installMonthBoundaryDetail()) return;

  const observer = new MutationObserver(() => {
    if (!installMonthBoundaryDetail()) return;
    observer.disconnect();
  });
  observer.observe(task, { childList:true, subtree:true });
}

install();
