export const qualityTiers = {
  high: {source:512,cadence:30,field:[640,960],mask:[512,768],scale:1,display:1440},
  balanced: {source:320,cadence:24,field:[384,640],mask:[384,640],scale:.85,display:1152},
  low: {source:192,cadence:18,field:[256,384],mask:[256,512],scale:.65,display:900},
} as const;
export type QualityTier = keyof typeof qualityTiers;
export interface QualityStatus {tier:QualityTier;mode:'auto'|QualityTier;reason:'warmup'|'override'|'holding'|'slow'|'headroom';transitions:number;fps:number;rafP95Ms:number}
export function createQualityController() {
  const requested=new URLSearchParams(location.search).get('quality');
  const mode:QualityStatus['mode']=requested && Object.hasOwn(qualityTiers,requested)?requested as QualityTier:'auto';
  const status:QualityStatus={tier:mode==='auto'?'high':mode,mode,reason:mode==='auto'?'warmup':'override',transitions:0,fps:0,rafP95Ms:0};
  const tiers:QualityTier[]=['high','balanced','low'];
  let previous=0,warmup=0,windowStart=0,cooldown=0,slow=0,fast=0;
  const intervals:number[]=[];
  const suspend=()=>{previous=0;warmup=0;windowStart=0;intervals.length=0;slow=0;fast=0;};
  return {status,suspend,record(now:number,active:boolean) {
    if(!active) {suspend();return false;}
    if(!previous) {previous=now;warmup=now;windowStart=now;return false;}
    const interval=now-previous;previous=now;
    // Unclamped wall intervals include genuine overload. Inactive focus/visibility is gated above.
    if(now-warmup<4000) return false;
    intervals.push(interval);
    if(now-windowStart<1000 || intervals.length<2) return false;
    windowStart=now;
    status.fps=1000/(intervals.reduce((sum,value)=>sum+value,0)/intervals.length);
    intervals.sort((a,b)=>a-b);status.rafP95Ms=intervals[Math.floor((intervals.length-1)*.95)];intervals.length=0;
    if(mode!=='auto') return false;
    status.reason='holding';
    slow=status.fps<54||status.rafP95Ms>24?slow+1:0;
    fast=status.fps>=58.5&&status.rafP95Ms<19?fast+1:0;
    if(now<cooldown) return false;
    const index=tiers.indexOf(status.tier);
    const next=slow>=3&&index<2?index+1:fast>=15&&index>0?index-1:index;
    if(next===index) return false;
    status.tier=tiers[next];status.reason=next>index?'slow':'headroom';status.transitions++;
    cooldown=now+(next>index?10000:25000);suspend();return true;
  }};
}
