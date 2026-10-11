import spiral from './presets/spiral.json';
import mandala from './presets/mandala.json';
import wiring from './presets/wiring.json';
import glowsticks from './presets/glowsticks.json';
import reaction from './presets/reaction.json';
import pond from './presets/pond.json';
import fire from './presets/fire.json';

export const themes = [
  {id:'prism',label:'museum.themes.prism',presets:[mandala,glowsticks,wiring],names:["Phat+fiShbRaiN+Eo.S_Mandala_Chasers_remix", "Eo.S. - glowsticks v2 05 and proton lights (+Krash\u2032s beat code) _Phat_remix02b", "Martin - acid wiring"]},
  {id:'garden',label:'museum.themes.garden',presets:[reaction,pond,fire],names:["Geiss - Reaction Diffusion 2", "Flexi - alien fish pond", "Cope - The Neverending Explosion of Red Liquid Fire"]},
  {id:'horizon',label:'museum.themes.horizon',presets:[wiring,spiral,glowsticks],names:["Martin - acid wiring", "Geiss - Spiral Artifact", "Eo.S. - glowsticks v2 05 and proton lights (+Krash\u2032s beat code) _Phat_remix02b"]},
] as const;
export type ThemeId = typeof themes[number]['id'];
export function initialTheme(): ThemeId {
  const query=new URLSearchParams(location.search).get('theme');
  let saved:string|null=null;
  try {saved=localStorage.getItem('treeMuseum.theme');} catch { /* Storage can be disabled. */ }
  return themes.find(theme=>theme.id===(query||saved))?.id||'prism';
}
