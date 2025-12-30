import http from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取前端静态资源目录
// 开发环境: 项目根目录/frontend/dist
// 生产环境 (npm包): dist/frontend
function getFrontendDir(): string {
  // 判断是否在 npm 包环境中（dist 目录存在 frontend 子目录）
  const distFrontendPath = join(__dirname, '../frontend');
  if (existsSync(distFrontendPath)) {
    return distFrontendPath;
  }
  // 开发环境，返回项目根目录下的 frontend/dist
  return join(__dirname, '../../frontend/dist');
}

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

// 根据文件扩展名获取 MIME 类型
function getMimeType(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    html: 'text/html',
    js: 'application/javascript',
    mjs: 'application/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

// 判断路径是否为 API 路径
function isApiPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_promptxy') ||
    pathname === '/openai' ||
    pathname.startsWith('/openai/') ||
    pathname === '/gemini' ||
    pathname.startsWith('/gemini/') ||
    pathname.startsWith('/v1/')
  );
}

// 处理静态文件请求
async function serveStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  frontendDir: string,
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host ?? 'localhost'}`);
  let filepath = join(frontendDir, url.pathname);

  // 如果访问根路径或目录，返回 index.html
  if (url.pathname === '/' || url.pathname.endsWith('/')) {
    filepath = join(frontendDir, 'index.html');
  }

  // 检查文件是否存在
  if (!existsSync(filepath)) {
    // SPA 路由回退：返回 index.html
    const indexHtml = join(frontendDir, 'index.html');
    if (existsSync(indexHtml)) {
      const content = await readFile(indexHtml);
      res.setHeader('content-type', 'text/html');
      res.setHeader('content-length', content.length);
      res.end(content);
      return true;
    }
    return false;
  }

  try {
    const content = await readFile(filepath);
    const mimeType = getMimeType(filepath);
    res.setHeader('content-type', mimeType);
    res.setHeader('content-length', content.length);
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

export function createGateway(config: PromptxyConfig): http.Server {
  const logger = createLogger({ debug: config.debug });
  const frontendDir = getFrontendDir();

  return http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        jsonError(res, 400, { error: 'Invalid request' });
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

      // 健康检查
      if (req.method === 'GET' && url.pathname === '/_promptxy/health') {
        jsonError(res, 200, { status: 'ok' });
        return;
      }

      // 静态文件服务：非 API 路径由前端处理
      if (!isApiPath(url.pathname)) {
        const served = await serveStaticFile(req, res, frontendDir);
        if (served) {
          return;
        }
        // 如果静态文件不存在，返回 404
        jsonError(res, 404, { error: 'Not Found' });
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
