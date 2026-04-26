export interface VitePretextOptions {
  fallbacks?: {
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
  };
  include?: (string | RegExp)[];
  /**
   * Emit build warnings when layout-forcing DOM reads are detected in your
   * source (offsetHeight, getBoundingClientRect, clientWidth, …). These are
   * the calls that synchronously trigger layout — exactly what pretext is
   * designed to replace with cached `el.style.minHeight` reads.
   *
   * Heuristic: simple text scan, may produce false positives in comments or
   * strings. Defaults to `true`. Set `false` to silence.
   */
  warn?: boolean;
}

export interface MeasureRequest {
  id: string;
  text: string;
  font: string;
  lineHeight: number;
  width: number;
}

export interface MeasureResponse {
  id: string;
  height: number;
  lineCount: number;
}

export interface VitePretextConfig {
  fallbacks: Required<NonNullable<VitePretextOptions['fallbacks']>>;
}

declare global {
  interface Window {
    __VITE_PRETEXT_CONFIG__?: VitePretextConfig;
    __vitePretext?: {
      setEnabled: (enabled: boolean) => void;
      remeasureAll: () => void;
      getStats: () => { pendingCount: number; completedCount: number; lastMeasureMs: number };
    };
  }
}
