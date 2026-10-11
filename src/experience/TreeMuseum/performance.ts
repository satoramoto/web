export interface MuseumPerformance {
  fps: number; rafP95Ms: number; cpuMeanMs: number; cpuP95Ms: number; compositorGpuMs: number | null;
  canvas: number[]; field: number[]; renderer: string; requestedPower: string; paused: boolean; samples: number;
}
interface TimerExtension { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
export function createPerformanceMonitor(gl: WebGL2RenderingContext, publish: (value: MuseumPerformance)=>void) {
  const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=String(gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
  const requestedPower=gl.getContextAttributes()?.powerPreference||'unknown';
  const intervals:number[]=[], cpu:number[]=[], pending:WebGLQuery[]=[];
  let lastRaf=0,lastReport=performance.now(), active:WebGLQuery|null=null,gpuMs:number|null=null, frames=0, paused=false;
  const p95=(values:number[])=>values.length?[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*.95)]:0;
  const mean=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
  function poll() {
    if(!timer) return;
    if(gl.getParameter(timer.GPU_DISJOINT_EXT)) {pending.splice(0).forEach(query=>gl.deleteQuery(query));gpuMs=null;return;}
    while(pending.length && gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)) {
      const query=pending.shift()!;const measured=Number(gl.getQueryParameter(query,gl.QUERY_RESULT))/1e6;
      if(Number.isFinite(measured)) gpuMs=gpuMs===null?measured:gpuMs*.75+measured*.25;
      gl.deleteQuery(query);
    }
  }
  return {
    startFrame(now:number,isPaused:boolean) {
      poll();paused=isPaused;
      if(lastRaf) {intervals.push(now-lastRaf);if(intervals.length>240) intervals.shift();}
      lastRaf=now;frames++;
    },
    beginGpu() {
      if(!timer || active || pending.length>=8 || frames%7!==0) return;
      active=gl.createQuery();if(active) gl.beginQuery(timer.TIME_ELAPSED_EXT,active);
    },
    endGpu() {if(active && timer) {gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push(active);active=null;}},
    endFrame(submissionMs:number,canvas:number[],field:number[]) {
      cpu.push(submissionMs);if(cpu.length>240) cpu.shift();
      const now=performance.now();if(now-lastReport<1000) return;lastReport=now;
      const average=mean(intervals);
      publish({fps:average?1000/average:0,rafP95Ms:p95(intervals),cpuMeanMs:mean(cpu),cpuP95Ms:p95(cpu),
        compositorGpuMs:gpuMs,canvas,field,renderer,requestedPower,paused,samples:intervals.length});
    },
    idle() {lastRaf=0;},
    dispose() {
      if(active && timer) {gl.endQuery(timer.TIME_ELAPSED_EXT);gl.deleteQuery(active);active=null;}
      pending.splice(0).forEach(query=>gl.deleteQuery(query));
    },
  };
}
