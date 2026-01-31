import type { IncomingMessage } from "node:http";
import type { GatewayContext } from "../context.js";

export type ParseRequestDeps = {
  readRequestBody: (
    req: IncomingMessage,
    options: { maxBytes: number },
  ) => Promise<Buffer>;
  shouldParseJson: (contentType: string | undefined) => boolean;
};

export function createParseRequest(deps: ParseRequestDeps) {
  return async function parseRequest(
    ctx: GatewayContext,
  ): Promise<GatewayContext> {
    const method = (ctx.req?.method || "unknown") as string;
    ctx.method = method;

    const expectsBody = method !== "GET" && method !== "HEAD";
    if (!expectsBody) return ctx;

    const bodyBuffer = await deps.readRequestBody(ctx.req, {
      maxBytes: 20 * 1024 * 1024,
    });
    ctx.bodyBuffer = bodyBuffer;
    ctx.originalBodyBuffer = ctx.originalBodyBuffer ?? bodyBuffer;

    const contentType = ctx.req?.headers?.["content-type"];
    const ct = Array.isArray(contentType) ? contentType[0] : contentType;
    if (deps.shouldParseJson(ct)) {
      try {
        ctx.jsonBody = JSON.parse(bodyBuffer.toString("utf-8"));
      } catch {
        ctx.jsonBody = undefined;
      }
    }

    return ctx;
  };
}
