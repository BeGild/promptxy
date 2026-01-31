export type RequestContext = {
  requestId?: string;
  sessionId?: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  // 最小摘要：后续按需要扩展，但避免塞入协议细节
  bodySummary?: {
    model?: string;
    stream?: boolean;
  };
};

export type RoutePlan = {
  localService: string;
  supplier: string;
  supplierProtocol: string;
  targetModel: string;
  transformer?: string; // none/registry key
  flags?: {
    allowPassthrough?: boolean;
    forceStream?: boolean;
  };
};
