/// <reference lib="webworker" />

import {
  prepare,
  prepareWithSegments,
  layout,
  measureNaturalWidth,
  measureLineStats,
} from '@chenglou/pretext';
import type { MeasureRequest, MeasureResponse } from './types.js';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<MeasureRequest>) => {
  const {
    id,
    text,
    font,
    lineHeight,
    width,
    mode = 'height',
    whiteSpace,
    wordBreak,
    letterSpacing,
  } = ev.data;
  try {
    const opts = { whiteSpace, wordBreak, letterSpacing };
    let response: MeasureResponse;

    if (mode === 'width') {
      // Width / shrink-wrap mode needs natural width plus the layout stats
      // at the current container width, so use the segments handle.
      const prepared = prepareWithSegments(text, font, opts);
      const naturalWidth = measureNaturalWidth(prepared);
      const stats = measureLineStats(prepared, width);
      const height = Math.max(1, stats.lineCount) * lineHeight;
      response = {
        id,
        height,
        lineCount: stats.lineCount,
        maxLineWidth: stats.maxLineWidth,
        naturalWidth,
      };
    } else {
      // Fast path for height / lines / none.
      const prepared = prepare(text, font, opts);
      const result = layout(prepared, width, lineHeight);
      response = {
        id,
        height: result.height,
        lineCount: result.lineCount,
      };
    }

    ctx.postMessage(response);
  } catch (err) {
    ctx.postMessage({
      id,
      height: 0,
      lineCount: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
