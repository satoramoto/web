declare module 'butterchurn' {
  interface AudioLevels {
    timeByteArray: Uint8Array;
    timeByteArrayL: Uint8Array;
    timeByteArrayR: Uint8Array;
  }
  interface NativeRenderer {
    targetFrameBuffer:WebGLFramebuffer;prevFrameBuffer:WebGLFramebuffer;compFrameBuffer:WebGLFramebuffer;
    targetTexture:WebGLTexture;prevTexture:WebGLTexture;frameNum:number;texsizeX:number;texsizeY:number;
    blurShader1:{blurHorizontalFrameBuffer:WebGLFramebuffer;blurVerticalFrameBuffer:WebGLFramebuffer};
    blurShader2:{blurHorizontalFrameBuffer:WebGLFramebuffer;blurVerticalFrameBuffer:WebGLFramebuffer};
    blurShader3:{blurHorizontalFrameBuffer:WebGLFramebuffer;blurVerticalFrameBuffer:WebGLFramebuffer};
  }
  interface Visualizer {
    /** Version-pinned2.6.7 internals used only for feedback reset and deposit-stage diagnostics. */
    renderer:NativeRenderer;
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
