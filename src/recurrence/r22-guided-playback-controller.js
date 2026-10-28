// R22 teaching playback over the EXISTING canonical integer-year Δ controller.
// Deliberate jumps are labelled. Only the final approach is sampled in real years.
// The 160° phase fan is a folded shortest-distance gauge, never a physical spinner.
export function createR22GuidedPlaybackController({
 playButton, playIcon, playLabel,
 getDelta, setDelta, getStops, maxDelta,
 requestFrame=globalThis.requestAnimationFrame?.bind(globalThis),
 cancelFrame=globalThis.cancelAnimationFrame?.bind(globalThis),
 setTimer=globalThis.setTimeout?.bind(globalThis),
 clearTimer=globalThis.clearTimeout?.bind(globalThis),
 yearsPerSecond=20, approachYears=20, skipNoticeMs=600, holdMs=1600,
 getReducedMotion=()=>false,
 onStageChange=()=>{},onPlayingChange=()=>{},onStop=()=>{}
}={}){
 for(const [name,fn] of Object.entries({getDelta,setDelta,getStops,maxDelta,
   requestFrame,cancelFrame,setTimer,clearTimer,getReducedMotion,
   onStageChange,onPlayingChange,onStop})){
  if(typeof fn!=="function")throw new TypeError(name+" must be function");
 }
 for(const [name,value] of Object.entries({yearsPerSecond,approachYears,skipNoticeMs,holdMs})){
  if(!Number.isFinite(value)||value<0)throw new RangeError(name+" must be finite nonnegative");
 }
 if(yearsPerSecond<=0||!Number.isInteger(approachYears)){
  throw new RangeError("yearsPerSecond must be positive and approachYears an integer");
 }
 let active=false,stage="idle",target=null,frameId=null,timerId=null,epoch=0;
 let fromDelta=0,startedAt=null,lastSample=null,stops=[];
 function updateButton(){
  const name=active?"暫停時間推演":"播放時間推演";
  playButton?.setAttribute("aria-pressed",String(active));
  playButton?.setAttribute("aria-label",name);
  playButton?.setAttribute("title",name);
  if(playIcon)playIcon.textContent=active?"Ⅱ":"▶";
  if(playLabel)playLabel.textContent=active?"暫停":"播放";
  onPlayingChange(active);
 }
 function publish(next,extra={}){
  stage=next;
  onStageChange(Object.freeze({stage:next,target,delta:getDelta(),...extra}));
 }
 function clearScheduled(){
  if(frameId!==null){cancelFrame(frameId);frameId=null;}
  if(timerId!==null){clearTimer(timerId);timerId=null;}
 }
 function schedule(ms,fn){
  const expected=epoch;
  timerId=setTimer(()=>{
   timerId=null;
   if(active&&expected===epoch)fn();
  },ms);
 }
 function stop({commit=true,reason="stopped"}={}){
  const wasActive=active;
  active=false;epoch++;
  clearScheduled();target=null;
  publish(reason==="complete"?"complete":"idle",{reason});
  updateButton();
  if(wasActive)onStop({commit,reason});
 }
 function nextStop(){
  const position=Number(getDelta());
  return stops.find(n=>n>position)??null;
 }
 function completeTarget(){
  if(!active)return;
  publish("hold",{message:"精確停靠，觀察哪一層還沒歸零"});
  if(target===stops.at(-1)){
   // Last milestone remains visible without a hidden delayed restart.
   schedule(holdMs,()=>stop({commit:true,reason:"complete"}));
  }else{
   schedule(holdMs,proceed);
  }
 }
 function approach(){
  if(!active)return;
  fromDelta=getDelta();startedAt=null;lastSample=fromDelta;
  publish("approach",{message:"逐年取樣，接近下一個對齊時刻"});
  const expected=epoch;
  const tick=timestamp=>{
   frameId=null;
   if(!active||expected!==epoch||stage!=="approach")return;
   if(startedAt===null)startedAt=timestamp;
   const next=Math.min(target,fromDelta+Math.floor(
    Math.max(0,timestamp-startedAt)*yearsPerSecond/1000));
   if(next!==lastSample){
    setDelta(next,{source:"playback",syncQuery:false});
    lastSample=next;
   }
   if(next>=target){completeTarget();return;}
   frameId=requestFrame(tick);
  };
  if(fromDelta>=target){
   setDelta(target,{source:"playback",syncQuery:false});
   completeTarget();
  }else frameId=requestFrame(tick);
 }
 function proceed(){
  if(!active)return;
  const next=nextStop();
  if(next===null){stop({commit:true,reason:"complete"});return;}
  target=next;
  const previous=getDelta();
  const approachFrom=Math.max(previous,target-approachYears);
  if(approachFrom>previous+1){
   // Explicit discontinuous jump: never fake all the lost daily revolutions.
   setDelta(approachFrom,{source:"playback",syncQuery:false});
   publish("skip",{from:previous,to:approachFrom,skippedYears:approachFrom-previous,
     message:"教學跳轉，不是等速流逝"});
   schedule(skipNoticeMs,approach);
  }else approach();
 }
 function start(){
  if(active)return;
  const ceiling=Math.min(24000,Math.max(0,Math.floor(Number(maxDelta())||0)));
  stops=[...new Set(getStops()
   .map(item=>typeof item==="number"?item:item.year)
   .filter(n=>Number.isInteger(n)&&n>=0&&n<=ceiling))].sort((a,b)=>a-b);
  if(!stops.length||ceiling<=0)return;
  if(getDelta()>=stops.at(-1)){
   setDelta(0,{source:"playback-reset",syncQuery:true});
  }
  const upcoming=nextStop();
  if(upcoming===null)return;
  if(getReducedMotion()){
   // User-triggered one exact milestone per click; no automatic motion or timer.
   target=upcoming;
   setDelta(target,{source:"playback",syncQuery:true});
   publish("step",{message:"減少動態：逐次按播放跳至下一個停靠點"});
   target=null;
   onStop({commit:false,reason:"reduced-motion-step"});
   return;
  }
  epoch++;active=true;updateButton();proceed();
 }
 function toggle(){
  if(active)stop({commit:true,reason:"paused"});
  else start();
 }
 updateButton();
 return {start,stop,toggle,get playing(){return active;},get stage(){return stage;},
  get target(){return target;}};
}
