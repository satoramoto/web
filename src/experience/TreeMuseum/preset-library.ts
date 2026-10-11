import catalogue from '../../content/museum-presets.json';
export const presetCatalogue=catalogue as {id:string;name:string}[];
export function initialPreset():string|null {
  const query=new URLSearchParams(location.search).get('preset');let saved:string|null=null;
  try{saved=localStorage.getItem('treeMuseum.preset');}catch{/* Storage may be disabled. */}
  const requested=query||(new URLSearchParams(location.search).has('theme')?null:saved);
  return presetCatalogue.find(preset=>preset.id===requested)?.id||null;
}
export async function loadLibraryPreset(id:string,signal:AbortSignal):Promise<unknown> {
  if(!presetCatalogue.some(preset=>preset.id===id))throw new Error('Unknown preset');
  const response=await fetch(`${import.meta.env.BASE_URL}preset-library/${id}.json`,{signal});
  if(!response.ok)throw new Error(`Preset load failed (${response.status})`);
  return response.json();
}
