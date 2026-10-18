const params=new URLSearchParams(location.search);
const mode=params.get("mode")==="gallery"?"gallery":"editorial";
document.documentElement.dataset.mode=mode;
for(const link of document.querySelectorAll("[data-mode-link]")){
  const active=link.dataset.modeLink===mode;
  link.classList.toggle("is-active",active);
  if(active)link.setAttribute("aria-current","page"); else link.removeAttribute("aria-current");
}
document.documentElement.dataset.rhythmLabReady="true";
