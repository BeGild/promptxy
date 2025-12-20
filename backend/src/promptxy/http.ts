import type { IncomingMessage } from "node:http";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "proxy-connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "host",
]);

export async function readRequestBody(
  req: IncomingMessage,
  options: { maxBytes: number }
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > options.maxBytes) {
      throw new Error(`request body too large: ${total} bytes (max ${options.maxBytes})`);
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}

export function shouldParseJson(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("application/json");
}

export function cloneAndFilterRequestHeaders(
  headers: IncomingMessage["headers"]
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) continue;
    if (lowerKey === "content-length") continue;

    // Avoid upstream compression complexity for MVP.
    if (lowerKey === "accept-encoding") continue;

    // Node may provide value as string[]; join per RFC.
    out[lowerKey] = Array.isArray(value) ? value.join(",") : value;
  }

  out["accept-encoding"] = "identity";

  return out;
}

export function filterResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) return;
    out[lowerKey] = value;
  });
  return out;
}

export function joinUrl(base: string, pathWithLeadingSlash: string, search: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = pathWithLeadingSlash.startsWith("/")
    ? pathWithLeadingSlash
    : `/${pathWithLeadingSlash}`;
  return `${normalizedBase}${normalizedPath}${search}`;
}
