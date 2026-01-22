/**
 * Gateway SSE Transform 流测试：Codex SSE → Claude SSE
 *
 * 目的：覆盖 createSSETransformStream('codex') 的增量解析与输出序列化。
 */

import { describe, it, expect } from 'vitest';
import { createSSETransformStream } from '../../../src/promptxy/transformers/index.js';

describe('createSSETransformStream (codex)', () => {
  it('should convert Codex SSE to Claude SSE with stable id and completion usage', async () => {
    const t = createSSETransformStream('codex');

    let out = '';
    t.on('data', (buf: Buffer) => {
      out += buf.toString('utf-8');
    });

    t.write(
      Buffer.from(
        'data: {"type":"response.created","id":"resp_123","status":"in_progress"}\n\n',
        'utf-8',
      ),
    );
    t.write(
      Buffer.from(
        'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
        'utf-8',
      ),
    );
    t.write(
      Buffer.from(
        'data: {"type":"response.completed","id":"resp_123","usage":{"input_tokens":100,"input_tokens_details":{"cached_tokens":50},"output_tokens":200,"output_tokens_details":{"reasoning_tokens":75},"total_tokens":300}}\n\n',
        'utf-8',
      ),
    );
    t.end();

    await new Promise<void>((resolve, reject) => {
      t.on('end', resolve);
      t.on('error', reject);
    });

    expect(out).toContain('event: message_start');
    expect(out).toContain('event: message_stop');

    // message_start.message.id 应来自 response.created.id
    expect(out).toContain('"type":"message_start"');
    expect(out).toContain('"id":"resp_123"');

    // completion usage 必须包含官方四字段
    expect(out).toContain('"usage":{"input_tokens":100');
    expect(out).toContain('"cache_read_input_tokens":50');
    expect(out).toContain('"cache_creation_input_tokens":0');
    // reasoning_tokens 不进入 Claude usage（仅审计用）
    expect(out).not.toContain('"reasoning_tokens"');
  });
});
