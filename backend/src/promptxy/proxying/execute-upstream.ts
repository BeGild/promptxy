import type { Supplier } from "../types.js";

export type ExecuteUpstreamInput = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
  supplier: Supplier;
};

export async function executeUpstream(input: ExecuteUpstreamInput): Promise<Response> {
  return await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    redirect: "manual",
    signal: input.signal,
  });
}
