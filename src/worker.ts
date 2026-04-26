/// <reference lib="webworker" />

import { prepare, layout } from '@chenglou/pretext';
import type { MeasureRequest, MeasureResponse } from './types.js';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<MeasureRequest>) => {
  const { id, text, font, lineHeight, width } = ev.data;
  try {
    const prepared = prepare(text, font);
    const result = layout(prepared, width, lineHeight);
    const response: MeasureResponse = {
      id,
      height: result.height,
      lineCount: result.lineCount,
    };
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
