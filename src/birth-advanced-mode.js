const form = document.querySelector("#birth-form");
const panel = document.querySelector("#birth-advanced-controls");
const summary = document.querySelector("#birth-advanced-summary");
const utcOffsetInput = document.querySelector("#birth-utc-offset");
const query = new URLSearchParams(location.search);

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatUtcOffset(value) {
  const offset = Number(value);
  if (!Number.isFinite(offset)) return "UTC ?";
  const totalMinutes = Math.round(Math.abs(offset) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = offset < 0 ? "−" : "+";
  return `UTC${sign}${pad(hours)}:${pad(minutes)}`;
}

function boundarySummary() {
  const selected = form?.elements.namedItem("day-boundary")?.value;
  return selected === "civil-midnight" ? "00:00 換日" : "23:00 換日";
}

function updateSummary() {
  if (!panel || !summary || !utcOffsetInput) return;
  const text = `${formatUtcOffset(utcOffsetInput.value)} · ${boundarySummary()}`;
  summary.textContent = text;
  panel.dataset.advancedOpen = String(panel.open);
  panel.dataset.advancedSummary = text;
}

if (panel && form) {
  if (query.get("advanced") === "1" || query.has("lon")) panel.open = true;
  panel.addEventListener("toggle", updateSummary);
  form.addEventListener("input", updateSummary);
  form.addEventListener("change", updateSummary);
  updateSummary();
}
