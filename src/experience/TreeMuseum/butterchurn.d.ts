declare module 'butterchurn' {
  interface AudioLevels {
    timeByteArray: Uint8Array;
    timeByteArrayL: Uint8Array;
    timeByteArrayR: Uint8Array;
  }
  interface Visualizer {
    loadPreset(preset: unknown, blendTime: number): void;
    render(options: { audioLevels: AudioLevels; elapsedTime: number }): void;
    setRendererSize(width: number, height: number): void;
  }
  const butterchurn: {
    createVisualizer(context: AudioContext | null, canvas: HTMLCanvasElement, options: {
      width: number; height: number; pixelRatio: number; textureRatio: number; meshWidth?: number; meshHeight?: number;
    }): Visualizer;
  };
  export default butterchurn;
}
