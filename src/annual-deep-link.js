import "./app.js";
import { baziMonths } from "./data.js";

const requestedMonth = new URLSearchParams(window.location.search).get("month");
const validMonth = baziMonths.some(month => month.branch === requestedMonth);

if (validMonth) {
  const target = document.querySelector(
    `[data-select-type="month"][data-select-key="${requestedMonth}"]`
  );
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}
