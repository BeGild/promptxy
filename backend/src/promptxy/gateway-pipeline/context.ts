import type { RoutePlan } from "../gateway-contracts.js";
import type { IncomingMessage, ServerResponse } from "http";

export type GatewayErrorCategory =
  | "parse"
  | "auth"
  | "routing"
  | "rules"
  | "transform"
  | "proxying"
  | "streaming"
  | "recording";

export class GatewayError extends Error {
  category: GatewayErrorCategory;
  status: number;
  code: string;
  meta?: Record<string, unknown>;

  constructor(input: {
    category: GatewayErrorCategory;
    status: number;
    code: string;
    message: string;
    meta?: Record<string, unknown>;
  }) {
    super(input.message);
    this.category = input.category;
    this.status = input.status;
    this.code = input.code;
    this.meta = input.meta;
  }
}

export type GatewayContext = {
  req: IncomingMessage;
  res: ServerResponse;
  startTime: number;
  url?: URL;
  method?: string;

  // parsed/request
  originalBodyBuffer?: Buffer;
  bodyBuffer?: Buffer;
  jsonBody?: any;

  // routing/transform
  routeMatch?: any;
  routePlan?: RoutePlan;
  transformerChain?: string[];
  transformTrace?: any;

  // rules
  matches?: any[];
  warnings?: string[];

  // upstream/response
  upstreamUrl?: string;
  upstreamResponse?: Response;
};
