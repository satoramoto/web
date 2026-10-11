import neon from './presets/neon.json';
import paint from './presets/paint.json';
import spiral from './presets/spiral.json';

export const themes = [
  {id:'prism',label:'museum.themes.prism',preset:neon,name:'flexi + fishbrain - neon mindblob grafitti'},
  {id:'garden',label:'museum.themes.garden',preset:paint,name:'Zylot - Paint Spill (Music Reactive Paint Mix)'},
  {id:'horizon',label:'museum.themes.horizon',preset:spiral,name:'Geiss - Spiral Artifact'},
] as const;
export type ThemeId = typeof themes[number]['id'];
export function initialTheme(): ThemeId {
  const query=new URLSearchParams(location.search).get('theme');
  let saved:string|null=null;
  try {saved=localStorage.getItem('treeMuseum.theme');} catch { /* Storage can be disabled. */ }
  return themes.find(theme=>theme.id===(query||saved))?.id||'prism';
}
