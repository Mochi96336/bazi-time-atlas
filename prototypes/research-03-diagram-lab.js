import { fourPillarDeterminacy } from "../src/recurrence/four-pillar-determinacy.js";
import { ABSOLUTE_BOUNDARY_CONSEQUENCE_24000 as CONSEQUENCE } from "../src/research/seasonal-absolute-boundary-consequence.js";

const model=fourPillarDeterminacy({
  deltaYears:24000,
  yearSequenceAligned:true,
  discreteYearSequenceClosed:true,
  discreteDayClosed:true,
  astronomyWithinRange:true
});

const status={
  year:model.pillars.year.resolved?"supported":"unknown",
  month:model.pillars.month.resolved?"supported":"unknown",
  day:model.pillars.day.resolved?"supported":"unknown",
  hour:model.pillars.hour.resolved?"supported":"unknown"
};
const label={
  supported:"可回到同柱",
  unknown:"未能判定"
};
const detail={
  year:"同一太陽黃經 + 60 年序閉合",
  month:"同一節界方向 + 年干序可判",
  day:"缺絕對民用日相位與日界",
  hour:"缺地方時／時區、太陽時計時與已解析日干"
};

const band=document.querySelector("#pillar-band");
for(const [key,zh] of [["year","年"],["month","月"],["day","日"],["hour","時"]]){
  const item=document.createElement("article");
  item.className="pillar-item";
  item.dataset.pillar=key;
  item.dataset.state=status[key];
  item.innerHTML="<span>"+key.toUpperCase()+" · "+zh+"柱</span><strong>"+zh+"</strong><div><b>"+label[status[key]]+"</b><small>"+detail[key]+"</small></div>";
  band.appendChild(item);
}

const range="十二節提前 "+CONSEQUENCE.minBoundaryDays.toFixed(3)+"–"+CONSEQUENCE.maxBoundaryDays.toFixed(3)+" 天";
document.querySelector("#pillar-boundary-range").textContent=range;
document.querySelector("#fork-calendar-evidence").textContent=range+"；固定公曆／TT 相位沒有一起回來。";
document.querySelector("#claim-rejected-evidence").textContent=range+"，所以節界時間映射未重現。";

const params=new URLSearchParams(location.search);
if(params.get("capture")==="1")document.documentElement.dataset.capture="true";
const allowed=new Set(["pillars","fork","claims"]);
const requested=params.get("direction")||"pillars";
const direction=allowed.has(requested)?requested:"pillars";
document.querySelectorAll(".diagram-direction").forEach(section=>section.classList.toggle("is-active",section.dataset.direction===direction));
document.querySelectorAll("[data-direction-link]").forEach(link=>{
  const active=link.dataset.directionLink===direction;
  link.classList.toggle("is-active",active);
  if(active)link.setAttribute("aria-current","page");
});

const boundary=document.createElement("p");
boundary.className="claim-boundary";
boundary.textContent="研究邊界：年／月是條件式研究結論；日／時是尚未能判定，不是已證明不同。year 26026 frame 與 civil time 限制仍保留。";
document.querySelector(".diagram-direction.is-active")?.appendChild(boundary);
document.documentElement.dataset.diagramLabReady="true";
document.documentElement.dataset.diagramDirection=direction;
document.documentElement.dataset.dayStatus=model.pillars.day.status;
document.documentElement.dataset.hourStatus=model.pillars.hour.status;