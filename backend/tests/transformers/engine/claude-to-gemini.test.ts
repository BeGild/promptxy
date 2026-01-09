/**
 * TransformerEngine 集成测试：Claude → Gemini
 *
 * 目标：确保在 transformer=gemini 时不会走 Claude→Codex 的 render 逻辑，
 * 从而避免向 Gemini 上游发送含 `instructions/input/tools[]` 的错误请求体。
 */

import { describe, it, expect } from 'vitest';
import { createProtocolTransformer } from '../../../src/promptxy/transformers/index.js';

describe('TransformerEngine (Claude → Gemini)', () => {
  it('should build Gemini v1beta request body (no instructions)', async () => {
    const engine = createProtocolTransformer();

    const result = await engine.transform({
      supplier: {
        id: 's1',
        name: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        transformer: { default: ['gemini'] },
      },
      request: {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-stainless-runtime': 'node',
        },
        body: {
          model: 'gemini-3-flash-preview',
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: '你好，你是谁' }],
          stream: true,
          max_tokens: 128,
        },
      },
      stream: true,
    });

    expect(result.request.path).toBe(
      '/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse',
    );

    expect(result.request.body).toHaveProperty('contents');
    expect(result.request.body).toHaveProperty('systemInstruction');

    expect(result.request.body).not.toHaveProperty('instructions');
    expect(result.request.body).not.toHaveProperty('input');
  });

  it('should adapt path when supplier.baseUrl ends with /v1beta/models', async () => {
    const engine = createProtocolTransformer();

    const result = await engine.transform({
      supplier: {
        id: 's2',
        name: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        transformer: { default: ['gemini'] },
      },
      request: {
        method: 'POST',
        path: '/v1/messages',
        headers: {},
        body: {
          model: 'gemini-2.5-flash-lite',
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        },
      },
    });

    expect(result.request.path).toBe('/gemini-2.5-flash-lite:generateContent');
  });
});

