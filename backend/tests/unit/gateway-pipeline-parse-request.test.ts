import { describe, it, expect, vi } from 'vitest';
import { createParseRequest } from '../../src/promptxy/gateway-pipeline/steps/parse-request';

describe('parseRequest', () => {
  it('parses JSON body when content-type is json', async () => {
    const mockReadRequestBody = vi.fn().mockResolvedValue(Buffer.from('{"model":"test"}'));
    const mockShouldParseJson = vi.fn().mockReturnValue(true);

    const parseRequest = createParseRequest({
      readRequestBody: mockReadRequestBody,
      shouldParseJson: mockShouldParseJson,
    });

    const ctx: any = {
      req: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      startTime: Date.now(),
    };

    const result = await parseRequest(ctx);

    expect(mockReadRequestBody).toHaveBeenCalledWith(ctx.req, { maxBytes: 20 * 1024 * 1024 });
    expect(mockShouldParseJson).toHaveBeenCalledWith('application/json');
    expect(result.bodyBuffer).toEqual(Buffer.from('{"model":"test"}'));
    expect(result.jsonBody).toEqual({ model: 'test' });
    expect(result.method).toBe('POST');
  });

  it('skips body parsing for GET requests', async () => {
    const mockReadRequestBody = vi.fn();
    const mockShouldParseJson = vi.fn();

    const parseRequest = createParseRequest({
      readRequestBody: mockReadRequestBody,
      shouldParseJson: mockShouldParseJson,
    });

    const ctx: any = {
      req: { method: 'GET', headers: {} },
      startTime: Date.now(),
    };

    const result = await parseRequest(ctx);

    expect(mockReadRequestBody).not.toHaveBeenCalled();
    expect(result.method).toBe('GET');
  });

  it('handles invalid JSON gracefully', async () => {
    const mockReadRequestBody = vi.fn().mockResolvedValue(Buffer.from('invalid json'));
    const mockShouldParseJson = vi.fn().mockReturnValue(true);

    const parseRequest = createParseRequest({
      readRequestBody: mockReadRequestBody,
      shouldParseJson: mockShouldParseJson,
    });

    const ctx: any = {
      req: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      startTime: Date.now(),
    };

    const result = await parseRequest(ctx);

    expect(result.bodyBuffer).toEqual(Buffer.from('invalid json'));
    expect(result.jsonBody).toBeUndefined();
  });

  it('preserves originalBodyBuffer if already set', async () => {
    const mockReadRequestBody = vi.fn().mockResolvedValue(Buffer.from('new body'));
    const mockShouldParseJson = vi.fn().mockReturnValue(false);

    const parseRequest = createParseRequest({
      readRequestBody: mockReadRequestBody,
      shouldParseJson: mockShouldParseJson,
    });

    const ctx: any = {
      req: { method: 'POST', headers: {} },
      startTime: Date.now(),
      originalBodyBuffer: Buffer.from('original'),
    };

    const result = await parseRequest(ctx);

    expect(result.originalBodyBuffer).toEqual(Buffer.from('original'));
    expect(result.bodyBuffer).toEqual(Buffer.from('new body'));
  });
});
