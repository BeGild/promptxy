import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { PromptxyConfig, PromptxyRule, Supplier, PathMapping } from './types.js';

type PartialConfig = Partial<PromptxyConfig> & {
  listen?: Partial<PromptxyConfig['listen']>;
  api?: Partial<PromptxyConfig['api']>;
  suppliers?: Supplier[];
  storage?: Partial<PromptxyConfig['storage']>;
  rules?: PromptxyRule[];
};

const DEFAULT_CONFIG: PromptxyConfig = {
  listen: {
    host: '127.0.0.1',
    port: 7070,
  },
  api: {
    host: '127.0.0.1',
    port: 7071,
  },
  suppliers: [
    {
      id: 'claude-anthropic',
      name: 'Claude (Anthropic)',
      baseUrl: 'https://api.anthropic.com',
      localPrefix: '/claude',
      pathMappings: [],
      enabled: true,
    },
    {
      id: 'openai-official',
      name: 'OpenAI Official',
      baseUrl: 'https://api.openai.com',
      localPrefix: '/openai',
      pathMappings: [],
      enabled: true,
    },
    {
      id: 'gemini-google',
      name: 'Gemini (Google)',
      baseUrl: 'https://generativelanguage.googleapis.com',
      localPrefix: '/gemini',
      pathMappings: [],
      enabled: true,
    },
  ],
  rules: [],
  storage: {
    maxHistory: 100,
    autoCleanup: true,
    cleanupInterval: 1, // hours
  },
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
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return undefined;
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function assertUrl(label: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL, got: ${value}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must be http/https URL, got: ${value}`);
  }
}

/**
 * 验证路径映射规则
 */
function assertPathMappings(label: string, mappings?: PathMapping[]): void {
  if (!mappings || mappings.length === 0) {
    return;
  }

  if (!Array.isArray(mappings)) {
    throw new Error(`${label}.pathMappings must be an array`);
  }

  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i];
    const mappingLabel = `${label}.pathMappings[${i}]`;

    if (!mapping || typeof mapping !== 'object') {
      throw new Error(`${mappingLabel} must be an object`);
    }

    if (typeof mapping.from !== 'string' || !mapping.from) {
      throw new Error(`${mappingLabel}.from must be a non-empty string`);
    }

    if (typeof mapping.to !== 'string' || !mapping.to) {
      throw new Error(`${mappingLabel}.to must be a non-empty string`);
    }

    if (mapping.type !== undefined) {
      if (!['exact', 'prefix', 'regex'].includes(mapping.type)) {
        throw new Error(`${mappingLabel}.type must be one of: exact, prefix, regex`);
      }

      // 验证正则语法
      if (mapping.type === 'regex') {
        try {
          new RegExp(mapping.from);
        } catch (e: any) {
          throw new Error(`${mappingLabel}.from is an invalid regex: ${e.message}`);
        }
      }
    }
  }
}

/**
 * 验证供应商配置
 */
export function assertSupplier(label: string, supplier: Supplier): void {
  if (!supplier || typeof supplier !== 'object') {
    throw new Error(`${label} must be an object`);
  }

  if (!supplier.id || typeof supplier.id !== 'string') {
    throw new Error(`${label}.id must be a non-empty string`);
  }

  if (!supplier.name || typeof supplier.name !== 'string') {
    throw new Error(`${label}.name must be a non-empty string`);
  }

  assertUrl(`${label}.baseUrl`, supplier.baseUrl);

  if (!supplier.localPrefix || typeof supplier.localPrefix !== 'string') {
    throw new Error(`${label}.localPrefix must be a non-empty string`);
  }

  if (!supplier.localPrefix.startsWith('/')) {
    throw new Error(`${label}.localPrefix must start with '/'`);
  }

  if (typeof supplier.enabled !== 'boolean') {
    throw new Error(`${label}.enabled must be a boolean`);
  }

  assertPathMappings(label, supplier.pathMappings);
}

/**
 * 验证供应商路径冲突
 */
export function assertSupplierPathConflicts(suppliers: Supplier[]): void {
  const enabledByPrefix = new Map<string, Supplier[]>();

  for (const supplier of suppliers) {
    if (supplier.enabled) {
      if (!enabledByPrefix.has(supplier.localPrefix)) {
        enabledByPrefix.set(supplier.localPrefix, []);
      }
      enabledByPrefix.get(supplier.localPrefix)!.push(supplier);
    }
  }

  for (const [prefix, suppliersForPrefix] of enabledByPrefix) {
    if (suppliersForPrefix.length > 1) {
      throw new Error(
        `Local prefix '${prefix}' is used by multiple enabled suppliers: ` +
        suppliersForPrefix.map(s => s.name).join(', ')
      );
    }
  }
}

function assertConfig(config: PromptxyConfig): PromptxyConfig {
  if (!config.listen || typeof config.listen !== 'object') {
    throw new Error(`config.listen must be an object`);
  }

  if (!config.listen.host || typeof config.listen.host !== 'string') {
    throw new Error(`config.listen.host must be a string`);
  }

  if (
    typeof config.listen.port !== 'number' ||
    !Number.isInteger(config.listen.port) ||
    config.listen.port < 1 ||
    config.listen.port > 65535
  ) {
    throw new Error(`config.listen.port must be an integer in [1, 65535]`);
  }

  // API 配置验证
  if (!config.api || typeof config.api !== 'object') {
    throw new Error(`config.api must be an object`);
  }

  if (!config.api.host || typeof config.api.host !== 'string') {
    throw new Error(`config.api.host must be a string`);
  }

  if (
    typeof config.api.port !== 'number' ||
    !Number.isInteger(config.api.port) ||
    config.api.port < 1 ||
    config.api.port > 65535
  ) {
    throw new Error(`config.api.port must be an integer in [1, 65535]`);
  }

  if (!config.suppliers || !Array.isArray(config.suppliers)) {
    throw new Error(`config.suppliers must be an array`);
  }

  if (config.suppliers.length === 0) {
    throw new Error(`config.suppliers must contain at least one supplier`);
  }

  for (let i = 0; i < config.suppliers.length; i++) {
    assertSupplier(`config.suppliers[${i}]`, config.suppliers[i]);
  }

  // 验证路径冲突
  assertSupplierPathConflicts(config.suppliers);

  if (!config.rules || !Array.isArray(config.rules)) {
    throw new Error(`config.rules must be an array`);
  }

  for (const rule of config.rules) {
    if (!rule || typeof rule !== 'object') {
      throw new Error(`rule must be an object`);
    }
    if (!rule.id || typeof rule.id !== 'string') {
      throw new Error(`rule.id must be a string`);
    }
    if (!rule.when || typeof rule.when !== 'object') {
      throw new Error(`rule.when must be an object (rule: ${rule.id})`);
    }
    if (!rule.when.client || typeof rule.when.client !== 'string') {
      throw new Error(`rule.when.client must be a string (rule: ${rule.id})`);
    }
    if (!rule.when.field || typeof rule.when.field !== 'string') {
      throw new Error(`rule.when.field must be a string (rule: ${rule.id})`);
    }
    if (!Array.isArray(rule.ops) || rule.ops.length === 0) {
      throw new Error(`rule.ops must be a non-empty array (rule: ${rule.id})`);
    }
    for (const op of rule.ops) {
      if (!op || typeof op !== 'object' || typeof (op as any).type !== 'string') {
        throw new Error(`rule.ops entries must be objects with type (rule: ${rule.id})`);
      }
    }
  }

  // 存储配置验证
  if (!config.storage || typeof config.storage !== 'object') {
    throw new Error(`config.storage must be an object`);
  }

  if (
    typeof config.storage.maxHistory !== 'number' ||
    !Number.isInteger(config.storage.maxHistory) ||
    config.storage.maxHistory < 1
  ) {
    throw new Error(`config.storage.maxHistory must be a positive integer`);
  }

  if (typeof config.storage.autoCleanup !== 'boolean') {
    throw new Error(`config.storage.autoCleanup must be a boolean`);
  }

  if (
    typeof config.storage.cleanupInterval !== 'number' ||
    !Number.isFinite(config.storage.cleanupInterval) ||
    config.storage.cleanupInterval <= 0
  ) {
    throw new Error(`config.storage.cleanupInterval must be a positive number`);
  }

  return config;
}

function mergeConfig(base: PromptxyConfig, incoming: PartialConfig): PromptxyConfig {
  return {
    listen: {
      host: incoming.listen?.host ?? base.listen.host,
      port: incoming.listen?.port ?? base.listen.port,
    },
    api: {
      host: incoming.api?.host ?? base.api.host,
      port: incoming.api?.port ?? base.api.port,
    },
    suppliers: incoming.suppliers ?? base.suppliers,
    rules: incoming.rules ?? base.rules,
    storage: {
      maxHistory: incoming.storage?.maxHistory ?? base.storage.maxHistory,
      autoCleanup: incoming.storage?.autoCleanup ?? base.storage.autoCleanup,
      cleanupInterval: incoming.storage?.cleanupInterval ?? base.storage.cleanupInterval,
    },
    debug: incoming.debug ?? base.debug,
  };
}

function applyEnvOverrides(config: PromptxyConfig): PromptxyConfig {
  const host = process.env.PROMPTXY_HOST;
  const port = parsePort(process.env.PROMPTXY_PORT);
  const debug = parseBoolean(process.env.PROMPTXY_DEBUG);

  const apiHost = process.env.PROMPTXY_API_HOST;
  const apiPort = parsePort(process.env.PROMPTXY_API_PORT);

  const maxHistory = parsePort(process.env.PROMPTXY_MAX_HISTORY);
  const autoCleanup = parseBoolean(process.env.PROMPTXY_AUTO_CLEANUP);
  const cleanupInterval = parsePort(process.env.PROMPTXY_CLEANUP_INTERVAL);

  return {
    ...config,
    listen: {
      host: host ?? config.listen.host,
      port: port ?? config.listen.port,
    },
    api: {
      host: apiHost ?? config.api.host,
      port: apiPort ?? config.api.port,
    },
    suppliers: config.suppliers, // 供应商不支持环境变量覆盖
    storage: {
      maxHistory: maxHistory ?? config.storage.maxHistory,
      autoCleanup: autoCleanup ?? config.storage.autoCleanup,
      cleanupInterval: cleanupInterval ?? config.storage.cleanupInterval,
    },
    debug: debug ?? config.debug,
  };
}

async function findConfigPath(): Promise<string | undefined> {
  const fromEnv = process.env.PROMPTXY_CONFIG;
  if (fromEnv && await fileExists(fromEnv)) return fromEnv;

  const cwdCandidate = path.join(process.cwd(), 'promptxy.config.json');
  if (await fileExists(cwdCandidate)) return cwdCandidate;

  const homeCandidate = path.join(os.homedir(), '.promptxy', 'config.json');
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

export async function saveConfig(config: PromptxyConfig): Promise<void> {
  // 确定保存路径
  const fromEnv = process.env.PROMPTXY_CONFIG;
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.promptxy');
  const defaultPath = path.join(configDir, 'config.json');

  const configPath = fromEnv || defaultPath;
  const saveDir = path.dirname(configPath);

  // 确保目录存在（使用实际保存路径的目录）
  await mkdir(saveDir, { recursive: true });

  // 写入配置文件
  const json = JSON.stringify(config, null, 2);
  await writeFile(configPath, json, 'utf-8');
}

export function getConfigDir(): string {
  const fromEnv = process.env.PROMPTXY_CONFIG;
  if (fromEnv) return path.dirname(fromEnv);

  const homeDir = os.homedir();
  return path.join(homeDir, '.promptxy');
}
