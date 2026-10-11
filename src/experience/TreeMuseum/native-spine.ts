import type { ThemeId } from './themes';

type Values=Record<string,number>;
type Equation=(values:Values)=>Values;
interface AuthoredPreset {
  baseVals:Values; init_eqs_str?:string; frame_eqs_str?:string; pixel_eqs_str?:string;
  shapes:unknown[]; waves:unknown[]; warp:string; comp:string;
}
export interface NativeSpineInput {
  samples:Uint8Array; envelope:Float32Array; time:number; worldWidth:number; theme:ThemeId; injecting:boolean;
  onDeposit:()=>void;
}
// These trusted, locally vendored preset equations use the same compilation model as pinned Butterchurn2.6.7.
const compile=(source=''):Equation=>new Function('a',`${source}; return a;`) as Equation;
export function createNativeSpinePreset(authored:unknown,input:NativeSpineInput) {
  const preset=structuredClone(authored) as AuthoredPreset;
  const frame=compile(preset.frame_eqs_str);
  const colors:Record<ThemeId,[number,number,number]>={prism:[.35,.58,1],garden:[.24,.85,.62],horizon:[.72,.50,1]};
  return {...preset,
    // Spiral's original final comp rotates the freshly drawn target; show it directly instead.
    comp:input.theme==='horizon'?'shader_body { ret = texture(sampler_main, uv).rgb; }':preset.comp,
    baseVals:{...preset.baseVals,wave_a:0,darken_center:0,ob_a:0,ib_a:0,mv_a:0},
    init_eqs:compile(preset.init_eqs_str),
    frame_eqs:(a:Values)=>{
      const result=frame(a);result.wave_a=0;result.darken_center=0;result.ob_a=0;result.ib_a=0;result.mv_a=0;
      return result;
    },
    pixel_eqs:preset.pixel_eqs_str?compile(preset.pixel_eqs_str):'',
    // The selected examples have no invisible megabuf-wave dependencies. Authored warp/comp stay intact.
    shapes:[],
    waves:[{
      baseVals:{enabled:1,samples:512,sep:0,scaling:1,smoothing:0,spectrum:0,usedots:0,thick:1,additive:0,r:1,g:1,b:1,a:.5},
      init_eqs:(a:Values)=>a,
      frame_eqs:(a:Values)=>{if(input.injecting) input.onDeposit();return a;},
      point_eqs:(a:Values)=>{
        const sample=a.sample, index=Math.floor(sample*input.samples.length)%input.samples.length;
        const signed=(input.samples[index]-128)/127, envelope=input.envelope[index], y=sample*6;
        const trunk=.32*Math.sin(y*Math.PI/3+.4)+.15*Math.sin(y*Math.PI+input.time*.07);
        // The native canvas is square, so Butterchurn invAspectx/invAspecty are both1.
        a.x=.5+(trunk+signed*.3)/input.worldWidth;a.y=sample;
        const color=colors[input.theme];
        a.r=color[0]+envelope*.15;a.g=color[1]+envelope*.10;a.b=color[2];
        a.a=input.injecting?.65+envelope*.18:0;
        return a;
      },
    }],
  };
}
