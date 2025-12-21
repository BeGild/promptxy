import http from 'node:http';
import { Readable } from 'node:stream';
import { mutateClaudeBody } from './adapters/claude.js';
import { mutateCodexBody } from './adapters/codex.js';
import { mutateGeminiBody } from './adapters/gemini.js';
import {
  cloneAndFilterRequestHeaders,
  filterResponseHeaders,
  joinUrl,
  readRequestBody,
  shouldParseJson,
} from './http.js';
import { createLogger } from './logger.js';
import { PromptxyConfig, PromptxyClient, PromptxyRuleMatch } from './types.js';

type RouteInfo = {
  client: PromptxyClient;
  prefix: '' | '/openai' | '/gemini';
  upstreamBaseUrl: string;
};

function getRouteInfo(pathname: string, config: PromptxyConfig): RouteInfo {
  if (pathname === '/openai' || pathname.startsWith('/openai/')) {
    return { client: 'codex', prefix: '/openai', upstreamBaseUrl: config.upstreams.openai };
  }
  if (pathname === '/gemini' || pathname.startsWith('/gemini/')) {
    return { client: 'gemini', prefix: '/gemini', upstreamBaseUrl: config.upstreams.gemini };
  }
  return { client: 'claude', prefix: '', upstreamBaseUrl: config.upstreams.anthropic };
}

function stripPrefix(pathname: string, prefix: string): string {
  if (!prefix) return pathname;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(prefix + '/')) return pathname.slice(prefix.length);
  return pathname;
}

function jsonError(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

function summarizeMatches(matches: PromptxyRuleMatch[]): string {
  if (matches.length === 0) return 'no rules';
  const ids = Array.from(new Set(matches.map(m => m.ruleId)));
  return `rules=${ids.join(',')} ops=${matches.length}`;
}

export function createGateway(config: PromptxyConfig): http.Server {
  const logger = createLogger({ debug: config.debug });

  return http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        jsonError(res, 400, { error: 'Invalid request' });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

      if (req.method === 'GET' && url.pathname === '/_promptxy/health') {
        jsonError(res, 200, { status: 'ok' });
        return;
      }

      const route = getRouteInfo(url.pathname, config);
      const upstreamPath = stripPrefix(url.pathname, route.prefix);
      const upstreamUrl = joinUrl(route.upstreamBaseUrl, upstreamPath, url.search);

      const headers = cloneAndFilterRequestHeaders(req.headers);

      let bodyBuffer: Buffer | undefined;
      let jsonBody: any | undefined;
      const expectsBody = req.method !== 'GET' && req.method !== 'HEAD';

      if (expectsBody) {
        bodyBuffer = await readRequestBody(req, { maxBytes: 20 * 1024 * 1024 });

        const contentType = req.headers['content-type'];
        if (shouldParseJson(Array.isArray(contentType) ? contentType[0] : contentType)) {
          try {
            jsonBody = JSON.parse(bodyBuffer.toString('utf-8'));
          } catch {
            // Keep passthrough behavior when JSON is invalid; upstream will reject if needed.
            jsonBody = undefined;
          }
        }
      }

      let matches: PromptxyRuleMatch[] = [];
      const warnings: string[] = [];

      if (jsonBody && typeof jsonBody === 'object') {
        if (route.client === 'claude') {
          const result = mutateClaudeBody({
            body: jsonBody,
            method: req.method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
        } else if (route.client === 'codex') {
          const result = mutateCodexBody({
            body: jsonBody,
            method: req.method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
          warnings.push(...result.warnings);
        } else if (route.client === 'gemini') {
          const result = mutateGeminiBody({
            body: jsonBody,
            method: req.method,
            path: upstreamPath,
            rules: config.rules,
          });
          jsonBody = result.body;
          matches = result.matches;
        }
      }

      if (config.debug) {
        logger.debug(
          `[promptxy] ${route.client.toUpperCase()} ${req.method} ${url.pathname} -> ${upstreamUrl} (${summarizeMatches(
            matches,
          )}${warnings.length ? ` warnings=${warnings.length}` : ''})`,
        );
        for (const w of warnings) {
          logger.debug(`[promptxy] warning: ${w}`);
        }
      }

      const upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: expectsBody
          ? jsonBody
            ? Buffer.from(JSON.stringify(jsonBody))
            : bodyBuffer
          : undefined,
        redirect: 'manual',
      });

      res.statusCode = upstreamResponse.status;

      const responseHeaders = filterResponseHeaders(upstreamResponse.headers);
      for (const [key, value] of Object.entries(responseHeaders)) {
        try {
          res.setHeader(key, value);
        } catch {
          // Ignore invalid headers for Node response.
        }
      }

      if (!upstreamResponse.body) {
        res.end();
        return;
      }

      Readable.fromWeb(upstreamResponse.body as any).pipe(res);
    } catch (error: any) {
      jsonError(res, 500, {
        error: 'promptxy_error',
        message: error?.message ?? String(error),
      });
    }
  });
}
