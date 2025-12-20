import { access, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PromptxyConfig, PromptxyRule } from "./types.js";

type PartialConfig = Partial<PromptxyConfig> & {
  listen?: Partial<PromptxyConfig["listen"]>;
  upstreams?: Partial<PromptxyConfig["upstreams"]>;
  rules?: PromptxyRule[];
};

const DEFAULT_CONFIG: PromptxyConfig = {
  listen: {
    host: "127.0.0.1",
    port: 7070,
  },
  upstreams: {
    anthropic: "https://api.anthropic.com",
    openai: "https://api.openai.com",
    gemini: "https://generativelanguage.googleapis.com",
  },
  rules: [],
  debug: false,
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function assertUrl(label: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL, got: ${value}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must be http/https URL, got: ${value}`);
  }
}

function assertConfig(config: PromptxyConfig): PromptxyConfig {
  if (!config.listen || typeof config.listen !== "object") {
    throw new Error(`config.listen must be an object`);
  }

  if (!config.listen.host || typeof config.listen.host !== "string") {
    throw new Error(`config.listen.host must be a string`);
  }

  if (
    typeof config.listen.port !== "number" ||
    !Number.isInteger(config.listen.port) ||
    config.listen.port < 1 ||
    config.listen.port > 65535
  ) {
    throw new Error(`config.listen.port must be an integer in [1, 65535]`);
  }

  if (!config.upstreams || typeof config.upstreams !== "object") {
    throw new Error(`config.upstreams must be an object`);
  }
  assertUrl("config.upstreams.anthropic", config.upstreams.anthropic);
  assertUrl("config.upstreams.openai", config.upstreams.openai);
  assertUrl("config.upstreams.gemini", config.upstreams.gemini);

  if (!Array.isArray(config.rules)) {
    throw new Error(`config.rules must be an array`);
  }

  for (const rule of config.rules) {
    if (!rule || typeof rule !== "object") {
      throw new Error(`rule must be an object`);
    }
    if (!rule.id || typeof rule.id !== "string") {
      throw new Error(`rule.id must be a string`);
    }
    if (!rule.when || typeof rule.when !== "object") {
      throw new Error(`rule.when must be an object (rule: ${rule.id})`);
    }
    if (!rule.when.client || typeof rule.when.client !== "string") {
      throw new Error(`rule.when.client must be a string (rule: ${rule.id})`);
    }
    if (!rule.when.field || typeof rule.when.field !== "string") {
      throw new Error(`rule.when.field must be a string (rule: ${rule.id})`);
    }
    if (!Array.isArray(rule.ops) || rule.ops.length === 0) {
      throw new Error(`rule.ops must be a non-empty array (rule: ${rule.id})`);
    }
    for (const op of rule.ops) {
      if (!op || typeof op !== "object" || typeof (op as any).type !== "string") {
        throw new Error(`rule.ops entries must be objects with type (rule: ${rule.id})`);
      }
    }
  }

  return config;
}

function mergeConfig(base: PromptxyConfig, incoming: PartialConfig): PromptxyConfig {
  return {
    listen: {
      host: incoming.listen?.host ?? base.listen.host,
      port: incoming.listen?.port ?? base.listen.port,
    },
    upstreams: {
      anthropic: incoming.upstreams?.anthropic ?? base.upstreams.anthropic,
      openai: incoming.upstreams?.openai ?? base.upstreams.openai,
      gemini: incoming.upstreams?.gemini ?? base.upstreams.gemini,
    },
    rules: incoming.rules ?? base.rules,
    debug: incoming.debug ?? base.debug,
  };
}

function applyEnvOverrides(config: PromptxyConfig): PromptxyConfig {
  const host = process.env.PROMPTXY_HOST;
  const port = parsePort(process.env.PROMPTXY_PORT);
  const debug = parseBoolean(process.env.PROMPTXY_DEBUG);

  const anthropic = process.env.PROMPTXY_UPSTREAM_ANTHROPIC;
  const openai = process.env.PROMPTXY_UPSTREAM_OPENAI;
  const gemini = process.env.PROMPTXY_UPSTREAM_GEMINI;

  return {
    ...config,
    listen: {
      host: host ?? config.listen.host,
      port: port ?? config.listen.port,
    },
    upstreams: {
      anthropic: anthropic ?? config.upstreams.anthropic,
      openai: openai ?? config.upstreams.openai,
      gemini: gemini ?? config.upstreams.gemini,
    },
    debug: debug ?? config.debug,
  };
}

async function findConfigPath(): Promise<string | undefined> {
  const fromEnv = process.env.PROMPTXY_CONFIG;
  if (fromEnv) return fromEnv;

  const cwdCandidate = path.join(process.cwd(), "promptxy.config.json");
  if (await fileExists(cwdCandidate)) return cwdCandidate;

  const homeCandidate = path.join(os.homedir(), ".promptxy", "config.json");
  if (await fileExists(homeCandidate)) return homeCandidate;

  return undefined;
}

export async function loadConfig(): Promise<PromptxyConfig> {
  const configPath = await findConfigPath();

  let config: PromptxyConfig = DEFAULT_CONFIG;

  if (configPath) {
    const parsed = (await readJsonFile(configPath)) as PartialConfig;
    config = mergeConfig(DEFAULT_CONFIG, parsed);
  }

  config = applyEnvOverrides(config);

  return assertConfig(config);
}

