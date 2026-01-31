import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type StreamResponseInput = {
  res: any;
  upstreamResponse: Response;
  upstreamAbortSignal: AbortSignal;
  abortUpstream: () => void;
  shouldTransformSSE: boolean;
  transformStream?: any;
  upstreamStream?: Readable;
  onChunk?: (buf: Buffer) => void;
  onFinalize: (err: unknown) => Promise<void>;
};

function isExpectedStreamTermination(err: any): boolean {
  const msg = String(err?.message || err || '');
  return msg.includes('terminated') || msg.includes('abort') || msg.includes('aborted');
}

export async function streamResponse(input: StreamResponseInput): Promise<void> {
  const {
    res,
    upstreamResponse,
    upstreamAbortSignal,
    abortUpstream,
    shouldTransformSSE,
    transformStream,
    upstreamStream,
    onChunk,
    onFinalize,
  } = input;

  if (shouldTransformSSE && transformStream) {
    const safeUpstream = new PassThrough();
    let upstreamFinalError: any | undefined;
    let safeEnded = false;

    const endSafeUpstream = () => {
      if (safeEnded) return;
      safeEnded = true;
      try {
        safeUpstream.end();
      } catch {
        // ignore
      }
    };

    const pumpWebBodyToNode = async (): Promise<void> => {
      const body = upstreamResponse?.body as any;
      const reader = body?.getReader?.();
      if (!reader) {
        endSafeUpstream();
        return;
      }

      try {
        while (true) {
          if (upstreamAbortSignal.aborted || res.destroyed) {
            upstreamFinalError = upstreamFinalError ?? new Error('terminated');
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
          if (!safeUpstream.write(buf)) {
            await new Promise<void>(resolve => safeUpstream.once('drain', () => resolve()));
          }
        }
      } catch (err: any) {
        if (isExpectedStreamTermination(err) || upstreamAbortSignal.aborted || res.destroyed) {
          upstreamFinalError = upstreamFinalError ?? err;
        } else {
          safeUpstream.destroy(err);
          return;
        }
      } finally {
        try {
          reader.releaseLock?.();
        } catch {
          // ignore
        }
        endSafeUpstream();
      }
    };

    const pumpPromise = pumpWebBodyToNode().catch(() => {});

    try {
      if (onChunk) {
        transformStream.on('data', (chunk: any) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          onChunk(buf);
        });
      }

      await pipeline(safeUpstream as any, transformStream as any, res as any);
      await pumpPromise;
      await onFinalize(upstreamFinalError);
    } catch (err: any) {
      abortUpstream();
      endSafeUpstream();
      await pumpPromise;
      await onFinalize(upstreamFinalError ?? err);
    }

    return;
  }

  if (!upstreamStream) {
    await onFinalize(new Error('missing upstream stream'));
    return;
  }

  if (onChunk) {
    upstreamStream.on('data', (chunk: any) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      onChunk(buf);
    });
  }

  try {
    await pipeline(upstreamStream as any, res as any);
    await onFinalize(undefined);
  } catch (err: any) {
    if (isExpectedStreamTermination(err) || res.destroyed) {
      // ignore
    }
    await onFinalize(err);
  }
}
