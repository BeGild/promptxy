/**
 * Gateway SSE Transform 流测试：Gemini SSE → Claude SSE
 *
 * 目的：覆盖 createSSETransformStream('gemini') 的增量解析与输出序列化。
 */

import { describe, it, expect } from 'vitest';
import { createSSETransformStream } from '../../../src/promptxy/transformers/index.js';

describe('createSSETransformStream (gemini)', () => {
  it('should convert Gemini SSE to Claude SSE events incrementally', async () => {
    const t = createSSETransformStream('gemini');

    let out = '';
    t.on('data', (buf: Buffer) => {
      out += buf.toString('utf-8');
    });

    t.write(
      Buffer.from(
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
        'utf-8',
      ),
    );
    t.write(
      Buffer.from(
        'data: {"candidates":[{"content":{"parts":[{"text":" world"}]},"finishReason":"STOP"}],"usageMetadata":{"candidatesTokenCount":3}}\n\n',
        'utf-8',
      ),
    );
    t.end();

    await new Promise<void>((resolve, reject) => {
      t.on('end', resolve);
      t.on('error', reject);
    });

    expect(out).toContain('event: message_start');
    expect(out).toContain('event: content_block_delta');
    expect(out).toContain('event: message_stop');
  });
});

