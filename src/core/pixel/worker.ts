/// <reference lib="webworker" />
import { analyzePhoto } from './extract';

self.onmessage = (e: MessageEvent) => {
  const { id, rgba, size, centerHint } = e.data;
  try {
    const analysis = analyzePhoto(new Uint8ClampedArray(rgba), size, { centerHint });
    (self as unknown as Worker).postMessage({ id, analysis });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
