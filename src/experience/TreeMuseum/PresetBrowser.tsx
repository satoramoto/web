import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/copy';
import { presetCatalogue } from './preset-library';
interface Props {retryId:string|null;selected:string|null;name:string;loading:boolean;error:boolean;onSelect:(id:string)=>void;onOpen:(open:boolean)=>void}
export function PresetBrowser({retryId,selected,name,loading,error,onSelect,onOpen}:Props) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[limit,setLimit]=useState(60);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const filtered=presetCatalogue.filter(preset=>preset.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>{onOpen(open);if(open&&!dialog.current?.open)dialog.current?.showModal();else if(!open&&dialog.current?.open)dialog.current.close();},[open]);
  const close=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());};
  const requested=useRef(selected);useEffect(()=>{requested.current=selected;},[selected]);
  const choose=(id:string)=>{requested.current=id;onSelect(id);};
  const step=(delta:number)=>{const pool=filtered.length?filtered:presetCatalogue;const index=pool.findIndex(preset=>preset.id===requested.current);choose(pool[(Math.max(0,index)+delta+pool.length)%pool.length].id);};
  return <>
    <div className="museum-preset-quick" role="toolbar" aria-label={t('museum.presets.quick')}><button onClick={()=>step(-1)} title={t('museum.presets.previous')} aria-label={t('museum.presets.previous')}>←</button><button onClick={()=>step(1)} title={t('museum.presets.next')} aria-label={t('museum.presets.next')}>→</button><button onClick={()=>choose(presetCatalogue[Math.floor(Math.random()*presetCatalogue.length)].id)} title={t('museum.presets.shuffle')} aria-label={t('museum.presets.shuffle')}>⤨</button><span>{t('museum.presets.shortcuts')}</span></div>
    <button className="museum-preset-trigger" ref={trigger} type="button" aria-haspopup="dialog" onClick={()=>setOpen(true)}><span>{t('museum.presets.browse',{count:String(presetCatalogue.length)})}</span><span>{name}</span></button>
    <dialog className="museum-preset-dialog" ref={dialog} aria-labelledby="preset-browser-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
      <section className="museum-preset-panel">
        <header><h2 id="preset-browser-title">{t('museum.presets.title')}</h2><button type="button" onClick={close} aria-label={t('museum.presets.close')}>×</button></header>
        <p className="museum-preset-current">{name}</p>
        <div className="museum-preset-navigation">
          <button type="button" onClick={()=>step(-1)}>{t('museum.presets.previous')}</button><button type="button" onClick={()=>step(1)}>{t('museum.presets.next')}</button><button type="button" onClick={()=>{const pool=filtered.length?filtered:presetCatalogue;choose(pool[Math.floor(Math.random()*pool.length)].id);}}>{t('museum.presets.shuffle')}</button>
        </div>
        <label htmlFor="museum-preset-search">{t('museum.presets.search')}</label>
        <input id="museum-preset-search" type="search" autoFocus value={query} onChange={event=>{setQuery(event.target.value);setLimit(60);}} placeholder={t('museum.presets.searchHint')} />
        <p role="status" className="museum-preset-status">{loading?t('museum.presets.loading'):error?t('museum.presets.failed'):t('museum.presets.results',{shown:String(Math.min(limit,filtered.length)),count:String(filtered.length)})}</p>
        <ul className="museum-preset-results">{filtered.slice(0,limit).map((preset,index)=><li key={preset.id}><button type="button" aria-pressed={selected===preset.id} onClick={()=>choose(preset.id)} onKeyDown={event=>{
          const next=event.key==='ArrowDown'?index+1:event.key==='ArrowUp'?index-1:event.key==='Home'?0:event.key==='End'?Math.min(limit,filtered.length)-1:-1;
          if(next<0)return;event.preventDefault();event.currentTarget.closest('ul')?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
        }}>{preset.name}</button></li>)}</ul>
        {filtered.length>limit&&<button className="museum-preset-more" type="button" onClick={()=>setLimit(limit+60)}>{t('museum.presets.more')}</button>}
        {error&&retryId&&<button type="button" onClick={()=>onSelect(retryId!)}>{t('museum.presets.retry')}</button>}
      </section>
    </dialog>
  </>;
}
