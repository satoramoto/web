import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '../../i18n/copy';
import { createMuseumRenderer } from './renderer';
import type { MuseumPerformance } from './performance';
import { themes, initialTheme, type ThemeId } from './themes';
import { PresetBrowser } from './PresetBrowser';
import { initialPreset, loadLibraryPreset, presetCatalogue } from './preset-library';
import { chapters, projects, viewportLength, wrapJourney } from './journey';
import './museum.css';


function TreeMuseum() {
  const perfEnabled=new URLSearchParams(location.search).get('perf')==='1';
  const [theme,setTheme]=useState<ThemeId>(initialTheme);
  const startingPreset=useRef(initialPreset());
  const [presetId,setPresetId]=useState<string|null>(null);
  const [pickerOpen,setPickerOpen]=useState(false),[presetLoading,setPresetLoading]=useState(false),[presetError,setPresetError]=useState(false);
  const [retryPresetId,setRetryPresetId]=useState<string|null>(null);
  const requestedPreset=useRef<string|null>(startingPreset.current||presetCatalogue.find(preset=>preset.name===themes.find(item=>item.id===theme)?.name)?.id||null);
  const selectionRequest=useRef(0),selectionAbort=useRef<AbortController|null>(null);
  const themeButtons=useRef<(HTMLButtonElement|null)[]>([]);
  const [perf,setPerf]=useState<MuseumPerformance|null>(null);
  const [injecting,setInjecting]=useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createMuseumRenderer> | null>(null);
  const branches=useRef<(SVGGElement|null)[]>([]);
  const labels = useRef<(HTMLButtonElement | null)[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const [active,setActive] = useState<number | null>(null);
  const [paused,setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [error,setError] = useState(false);
  const [explored,setExplored] = useState(false);
  const activeRef = useRef(active); activeRef.current=active;
  const pickerRef=useRef(false);pickerRef.current=pickerOpen;
  async function selectLibrary(id:string) {
    const candidate=presetCatalogue.find(preset=>preset.id===id);if(!candidate)return;requestedPreset.current=id;
    const request=++selectionRequest.current;selectionAbort.current?.abort();const controller=new AbortController();selectionAbort.current=controller;
    setPresetLoading(true);setPresetError(false);setRetryPresetId(id);
    try{const preset=await loadLibraryPreset(id,controller.signal);if(request!==selectionRequest.current||!renderer.current)return;
      await renderer.current.setPreset(preset,candidate.name);if(request!==selectionRequest.current)return;
      setPresetId(id);setPresetError(false);setError(false);
      const url=new URL(location.href);url.searchParams.set('preset',id);history.replaceState(null,'',url);
      try{localStorage.setItem('treeMuseum.preset',id);}catch{/* Storage can be disabled. */}
    }catch{if(request===selectionRequest.current&&!controller.signal.aborted){setPresetError(true);setError(false);}}
    finally{if(request===selectionRequest.current)setPresetLoading(false);}
  }
  function chooseTheme(value:ThemeId){
    requestedPreset.current=presetCatalogue.find(preset=>preset.name===themes.find(item=>item.id===value)?.name)?.id||null;selectionRequest.current++;selectionAbort.current?.abort();setPresetId(null);setRetryPresetId(null);setPresetLoading(false);setPresetError(false);setError(false);renderer.current?.setTheme(value);setTheme(value);
    const url=new URL(location.href);url.searchParams.delete('preset');url.searchParams.set('theme',value);history.replaceState(null,'',url);try{localStorage.removeItem('treeMuseum.preset');}catch{/* Storage may be disabled. */}
  }
  useEffect(()=> {
    document.title=t('museum.documentTitle');
    let labelsFrame=0;
    const perfTimer=perfEnabled?window.setInterval(()=>setPerf(window.__treeMuseum?.performance||null),1000):0;
    try { renderer.current=createMuseumRenderer(canvas.current!,()=>setError(true),theme); }
    catch { setError(true); }
    if(startingPreset.current)void selectLibrary(startingPreset.current);
    const updateLabels = () => {
      const position=renderer.current?.position || 0;
      labels.current.forEach((label,index)=>{
        if (!label) return;
        const y=wrapJourney(projects[index].worldY-position);
        const visible=y>.65&&y<viewportLength-.55;
        const point=renderer.current?.getSpinePoint(projects[index].worldY);
        const branch=branches.current[index];
        if(branch&&point){
          branch.style.display=visible?'':'none';
          const rect=label.getBoundingClientRect(),endX=(projects[index].side<0?rect.right:rect.left)/innerWidth*1000;
          const x=point.x*1000,sy=point.y*1000;
          branch.querySelector('path')?.setAttribute('d',`M ${x} ${sy} C ${x+(endX-x)*.4} ${sy}, ${endX} ${sy}, ${endX} ${sy}`);
          branch.querySelector('circle')?.setAttribute('cx',String(x));branch.querySelector('circle')?.setAttribute('cy',String(sy));
        }
        label.hidden=!visible; label.tabIndex=visible?0:-1;
        label.style.top=`${y/viewportLength*100}%`;
        label.style.opacity=String(Math.min(1,(y-.65)*3,(viewportLength-.55-y)*3));
      });
      document.querySelectorAll<HTMLElement>('.museum-chapter').forEach((label,index)=>{
        const y=wrapJourney(chapters[index].worldY-position);label.hidden=y>.65+viewportLength;
        label.style.top=`${y/viewportLength*100}%`;
      });
      labelsFrame=requestAnimationFrame(updateLabels);
    };
    updateLabels();
    const move = (delta: number) => {renderer.current?.move(delta);setExplored(true);};
    const wheel = (event: WheelEvent) => {
      if(activeRef.current!==null || pickerRef.current || event.ctrlKey) return;
      event.preventDefault();
      const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
      move(Math.max(-1,Math.min(1,pixels*.003)));
    };
    let touchY=0;
    const touchStart=(event:TouchEvent)=>{touchY=event.touches[0].clientY;};
    const touchMove=(event:TouchEvent)=>{
      if(activeRef.current!==null||pickerRef.current) return;
      event.preventDefault();const y=event.touches[0].clientY;move((touchY-y)*.009);touchY=y;
    };
    const key=(event:KeyboardEvent)=>{
      if(activeRef.current!==null||pickerRef.current) return;
      const target=event.target;
      if(target instanceof HTMLElement&&target.closest('input,textarea,select,[contenteditable]'))return;
      if(event.key==='['||event.key===']'||event.key.toLowerCase()==='r') {
        event.preventDefault();const index=presetCatalogue.findIndex(preset=>preset.id===requestedPreset.current);
        const next=event.key.toLowerCase()==='r'?Math.floor(Math.random()*presetCatalogue.length):(Math.max(0,index)+(event.key==='['?-1:1)+presetCatalogue.length)%presetCatalogue.length;
        void selectLibrary(presetCatalogue[next].id);return;
      }
      if(event.key===' ' && target instanceof HTMLElement && target.closest('button,a')) return;
      const deltas:Record<string,number>={ArrowDown:.35,ArrowUp:-.35,PageDown:2,PageUp:-2,' ':event.shiftKey?-2:2};
      if(event.key in deltas) {event.preventDefault();move(deltas[event.key]);}
      if(event.key==='Home') {event.preventDefault();renderer.current?.reset();}
    };
    addEventListener('wheel',wheel,{passive:false});addEventListener('touchstart',touchStart,{passive:true});
    addEventListener('touchmove',touchMove,{passive:false});addEventListener('keydown',key);
    return()=>{
      selectionRequest.current++;selectionAbort.current?.abort();clearInterval(perfTimer);cancelAnimationFrame(labelsFrame);renderer.current?.dispose();renderer.current=null;
      removeEventListener('wheel',wheel);removeEventListener('touchstart',touchStart);removeEventListener('touchmove',touchMove);removeEventListener('keydown',key);
    };
  },[]);
  useEffect(()=>{
    renderer.current?.setTheme(theme);
    try {localStorage.setItem('treeMuseum.theme',theme);} catch { /* Storage can be disabled. */ }
    const url=new URL(location.href);url.searchParams.set('theme',theme);history.replaceState(null,'',url);
  },[theme]);
  useEffect(()=>{renderer.current?.setPaused(paused||active!==null);},[paused,active]);
  useEffect(()=>{
    const element=dialog.current;
    if(active!==null && element && !element.open) element.showModal();
    else if(element?.open) element.close();
  },[active]);
  const selected=active===null?null:projects[active];
  const close=()=>{const previous=active;setActive(null);if(previous!==null) requestAnimationFrame(()=>labels.current[previous]?.focus());};
  return <main className="tree-museum" aria-label={t('museum.label')}>
    <canvas ref={canvas} className="museum-canvas" aria-hidden="true" />
    {perfEnabled && perf && <output id="museum-performance" className="museum-performance" aria-label={t('museum.perf.label')} data-native-position={window.__treeMuseum?.nativePosition.toFixed(3)} data-native-frames={window.__treeMuseum?.nativeFrames} data-native-deposits={window.__treeMuseum?.nativeDeposits} data-native-target-bound={String(window.__treeMuseum?.nativeTargetBound)} data-injecting={String(injecting)} data-quality={window.__treeMuseum?.quality.tier} data-quality-transitions={window.__treeMuseum?.quality.transitions} data-fps={perf.fps.toFixed(1)} data-raf-p95-ms={perf.rafP95Ms.toFixed(2)} data-cpu-p95-ms={perf.cpuP95Ms.toFixed(2)} data-compositor-gpu-ms={perf.compositorGpuMs?.toFixed(2)||'unavailable'}>
      <span>{t('museum.perf.timing',{fps:perf.fps.toFixed(1),raf:perf.rafP95Ms.toFixed(2)})}</span>
      <span>{t('museum.perf.cpu',{mean:perf.cpuMeanMs.toFixed(2),p95:perf.cpuP95Ms.toFixed(2)})}</span>
      <span>{perf.compositorGpuMs===null?t('museum.perf.gpuUnavailable'):t('museum.perf.gpu',{ms:perf.compositorGpuMs.toFixed(2)})}</span>
      <span>{t('museum.perf.size',{canvas:perf.canvas.join(' × '),field:perf.field.join(' × ')})}</span>
      <span>{t('museum.perf.context',{power:perf.requestedPower})} · {t(perf.paused?'museum.perf.paused':'museum.perf.running')}</span>
      <span>{t('museum.perf.quality',{tier:window.__treeMuseum?.quality.tier||'high',reason:t(`museum.perf.qualityReasons.${window.__treeMuseum?.quality.reason||'warmup'}`),changes:String(window.__treeMuseum?.quality.transitions||0)})}</span>
      <span>{t('museum.perf.native',{frames:String(window.__treeMuseum?.nativeFrames||0),deposits:String(window.__treeMuseum?.nativeDeposits||0),points:String(window.__treeMuseum?.nativeWavePoints||0)})}</span>
      <span>{t('museum.perf.bands',{bass:(window.__treeMuseum?.nativeBands?.bass||0).toFixed(2),mid:(window.__treeMuseum?.nativeBands?.mid||0).toFixed(2),treble:(window.__treeMuseum?.nativeBands?.treble||0).toFixed(2)})}</span>
      <span>{t(window.__treeMuseum?.nativeTargetBound?'museum.perf.targetBound':'museum.perf.targetUnknown')}</span>
      <span>{perf.renderer}</span>
      <button type="button" aria-pressed={injecting} onClick={()=>{renderer.current?.setInjecting(!injecting);setInjecting(!injecting);}}>{t(injecting?'museum.perf.stopInjection':'museum.perf.resumeInjection')}</button>
    </output>}
    <header className="museum-heading"><span>{t('museum.heading')}</span><span className="museum-heading-line" /></header>
    <div className="museum-controls">
      <button type="button" aria-label={t(paused?'museum.resume':'museum.pause')} title={t(paused?'museum.resume':'museum.pause')} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<span aria-hidden="true">▷</span>:<span aria-hidden="true">Ⅱ</span>}</button>
      <button type="button" aria-label={t('museum.reset')} title={t('museum.reset')} onClick={()=>renderer.current?.reset()}><span aria-hidden="true">↺</span></button>
    </div>
    <div className="museum-themes" role="toolbar" aria-label={t('museum.themes.label')}>
      {themes.map((item,index)=><button key={item.id} ref={button=>{themeButtons.current[index]=button;}} type="button" aria-pressed={presetId===null&&theme===item.id} onClick={()=>chooseTheme(item.id)} onKeyDown={event=>{
        const next=event.key==='ArrowRight'?(index+1)%themes.length:event.key==='ArrowLeft'?(index+themes.length-1)%themes.length:event.key==='Home'?0:event.key==='End'?themes.length-1:-1;
        if(next<0) return;event.preventDefault();event.stopPropagation();chooseTheme(themes[next].id);themeButtons.current[next]?.focus();
      }}>{t(item.label)}</button>)}
    </div>
    <PresetBrowser retryId={retryPresetId} selected={retryPresetId||presetId||presetCatalogue.find(preset=>preset.name===themes.find(item=>item.id===theme)!.name)?.id||null} name={presetCatalogue.find(preset=>preset.id===presetId)?.name||themes.find(item=>item.id===theme)!.name} loading={presetLoading} error={presetError} onSelect={id=>{void selectLibrary(id);}} onOpen={setPickerOpen} />
    <nav className="museum-chapter-nav" aria-label={t('museum.journey.chapters')}>
      {chapters.map(chapter=><button key={chapter.owner} onClick={()=>{renderer.current?.jump(chapter.worldY-1.4);setExplored(true);}}>{chapter.owner}<small>{chapter.count}</small></button>)}
    </nav>
    <svg className="museum-connections" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">{projects.map((project,index)=><g key={project.url} ref={element=>{branches.current[index]=element;}} style={{display:'none'}}><path/><circle r="1.8"/></g>)}</svg>
    <nav className="museum-projects" aria-label={t('museum.projects')}>
      {chapters.map((chapter,index)=><div className="museum-chapter" key={chapter.owner} hidden><small>{String(index+1).padStart(2,'0')} / {t('museum.journey.public',{count:String(chapter.count)})}</small><h2>{chapter.owner}</h2></div>)}
      {projects.map((project,index)=><button className={`museum-project museum-project-${project.side<0?'left':'right'}`} key={project.url} ref={element=>{labels.current[index]=element;}} type="button" style={project.side<0?{left:`${4+(index%3)*3}%`}:{right:`${4+(index%3)*3}%`}} hidden onClick={()=>setActive(index)} aria-haspopup="dialog">
        <span className="museum-project-number">{String(index+1).padStart(2,'0')}</span><span className="museum-project-name">{project.name}</span>
      </button>)}
    </nav>
    <div className={`museum-scroll-cue${explored?' museum-scroll-cue-used':''}`}><span>{t('museum.scroll')}</span><span aria-hidden="true">↓</span></div>
    {error && <p className="museum-error" role="status">{t('museum.error')}</p>}
    <dialog className="museum-dialog" ref={dialog} aria-labelledby="project-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget) close();}}>
      {selected && <article className="museum-detail">
        <button className="museum-close" type="button" onClick={close} aria-label={t('museum.close')} autoFocus><span aria-hidden="true">×</span></button>
        <p className="museum-detail-number">{String(active!+1).padStart(2,'0')} <span> / </span> {selected.owner} · {selected.language||t('museum.journey.repository')} {selected.fork&&<> · {t('museum.journey.fork')}</>} {selected.archived&&<> · {t('museum.journey.archived')}</>}</p>
        <h1 id="project-title">{selected.name}</h1>
        <p className="museum-detail-description">{selected.description||t('museum.journey.noDescription')}</p>
        <a href={selected.url} target="_blank" rel="noopener noreferrer">{t('museum.repository')}<span aria-hidden="true">↗</span></a>
        <div className="museum-detail-footer">{t('museum.returnHint')}</div>
      </article>}
    </dialog>
  </main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<TreeMuseum />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
