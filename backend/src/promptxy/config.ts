import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  PromptxyConfig,
  PromptxyRule,
  Supplier,
  PathMapping,
  LegacyPromptxyRule,
} from './types.js';
import { randomUUID } from 'node:crypto';
import { calculateDefaultPort, findAvailablePort } from './port-utils.js';
import {
  validateTransformerConfig,
  validateSupplierAuth,
  validateGatewayAuth,
} from './transformers/index.js';

type PartialConfig = Partial<PromptxyConfig> & {
  listen?: Partial<PromptxyConfig['listen']>;
  suppliers?: Supplier[];
  storage?: {
    maxHistory?: number;
    // autoCleanup 和 cleanupInterval 已废弃，清理现在在 insertRequestRecord 中自动触发
  };
  rules?: PromptxyRule[];
};

const DEFAULT_CONFIG: PromptxyConfig = {
  listen: {
    host: '127.0.0.1',
    port: 0,
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
    maxHistory: 1000,
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

  // 验证 auth 配置
  if (supplier.auth) {
    const authResult = validateSupplierAuth(supplier.auth);
    if (!authResult.valid) {
      throw new Error(
        `${label}.auth: ${authResult.errors.join(', ')}`,
      );
    }
  }

  // 验证 transformer 配置
  if (supplier.transformer) {
    const transformerResult = validateTransformerConfig(supplier.transformer);
    if (!transformerResult.valid) {
      throw new Error(
        `${label}.transformer: ${transformerResult.errors.join(', ')}`,
      );
    }
    // 输出警告
    for (const warning of transformerResult.warnings) {
      console.warn(`[Config] ${label}.transformer: ${warning}`);
    }
  }
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
          suppliersForPrefix.map(s => s.name).join(', '),
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
    if (!rule.uuid || typeof rule.uuid !== 'string') {
      throw new Error(`rule.uuid must be a string`);
    }
    if (!rule.name || typeof rule.name !== 'string') {
      throw new Error(`rule.name must be a string`);
    }
    if (!rule.when || typeof rule.when !== 'object') {
      throw new Error(`rule.when must be an object (rule: ${rule.name})`);
    }
    if (!rule.when.client || typeof rule.when.client !== 'string') {
      throw new Error(`rule.when.client must be a string (rule: ${rule.name})`);
    }
    if (!rule.when.field || typeof rule.when.field !== 'string') {
      throw new Error(`rule.when.field must be a string (rule: ${rule.name})`);
    }
    if (!Array.isArray(rule.ops) || rule.ops.length === 0) {
      throw new Error(`rule.ops must be a non-empty array (rule: ${rule.name})`);
    }
    for (const op of rule.ops) {
      if (!op || typeof op !== 'object' || typeof (op as any).type !== 'string') {
        throw new Error(`rule.ops entries must be objects with type (rule: ${rule.name})`);
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

  // 验证 gatewayAuth 配置（如果存在）
  if (config.gatewayAuth) {
    const gatewayAuthResult = validateGatewayAuth(config.gatewayAuth);
    if (!gatewayAuthResult.valid) {
      throw new Error(
        `config.gatewayAuth: ${gatewayAuthResult.errors.join(', ')}`,
      );
    }
    // 输出警告
    for (const warning of gatewayAuthResult.warnings) {
      console.warn(`[Config] config.gatewayAuth: ${warning}`);
    }
  }

  return config;
}

function mergeConfig(base: PromptxyConfig, incoming: PartialConfig): PromptxyConfig {
  return {
    listen: {
      host: incoming.listen?.host ?? base.listen.host,
      // port: 0 表示使用自动计算，不应该覆盖已设置的端口
      port:
        incoming.listen?.port !== undefined && incoming.listen.port !== 0
          ? incoming.listen.port
          : base.listen.port,
    },
    suppliers: incoming.suppliers ?? base.suppliers,
    rules: incoming.rules ?? base.rules,
    storage: {
      maxHistory: incoming.storage?.maxHistory ?? base.storage.maxHistory,
    },
    debug: incoming.debug ?? base.debug,
  };
}

function applyEnvOverrides(config: PromptxyConfig): PromptxyConfig {
  const host = process.env.PROMPTXY_HOST;
  const port = parsePort(process.env.PROMPTXY_PORT);
  const debug = parseBoolean(process.env.PROMPTXY_DEBUG);

  const maxHistory = parsePort(process.env.PROMPTXY_MAX_HISTORY);
  // PROMPTXY_AUTO_CLEANUP 和 PROMPTXY_CLEANUP_INTERVAL 已废弃

  return {
    ...config,
    listen: {
      host: host ?? config.listen.host,
      port: port ?? config.listen.port,
    },
    suppliers: config.suppliers, // 供应商不支持环境变量覆盖
    storage: {
      maxHistory: maxHistory ?? config.storage.maxHistory,
    },
    debug: debug ?? config.debug,
  };
}

type ConfigPaths = {
  project: string | undefined;
  global: string | undefined;
};

async function findConfigPaths(): Promise<ConfigPaths> {
  // 环境变量优先（仅用于全局配置路径）
  const fromEnv = process.env.PROMPTXY_CONFIG;

  // 项目配置：向上查找项目根目录的 promptxy.config.json
  let projectPath: string | undefined;
  let currentDir = process.cwd();

  // 最多向上查找 3 级目录
  for (let i = 0; i < 3; i++) {
    const candidate = path.join(currentDir, 'promptxy.config.json');
    if (await fileExists(candidate)) {
      projectPath = candidate;
      break;
    }
    // 向上一级目录
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // 已到达根目录
    currentDir = parentDir;
  }

  // 全局配置：~/.config/promptxy/config.json
  const globalPath = fromEnv || path.join(os.homedir(), '.config', 'promptxy', 'config.json');

  return {
    project: projectPath,
    global: (await fileExists(globalPath)) ? globalPath : undefined,
  };
}

export async function loadConfig(cliOptions?: { port?: number }): Promise<PromptxyConfig> {
  const configPaths = await findConfigPaths();

  let config: PromptxyConfig = DEFAULT_CONFIG;

  // 1. 先加载项目配置（如果存在）
  if (configPaths.project) {
    const parsed = (await readJsonFile(configPaths.project)) as PartialConfig;
    config = mergeConfig(DEFAULT_CONFIG, parsed);
    console.log(`[Config] 加载项目配置: ${configPaths.project}`);
  }

  // 2. 再合并全局配置（补充缺失字段）
  if (configPaths.global) {
    const parsed = (await readJsonFile(configPaths.global)) as PartialConfig;
    config = mergeConfig(config, parsed); // 用全局配置补充
    console.log(`[Config] 合并全局配置: ${configPaths.global}`);
  }

  // 检测并迁移旧格式的规则
  const migratedRules = migrateRules(config.rules);
  const needsMigration = migratedRules !== config.rules;

  if (needsMigration) {
    config = { ...config, rules: migratedRules };
    // 自动保存迁移后的配置（保存到全局配置）
    await saveGlobalConfig(config);
    console.log('[Config] 规则数据已自动迁移到新格式 (uuid + name)');
  }

  config = applyEnvOverrides(config);

  // 应用命令行参数（最高优先级）
  if (cliOptions?.port !== undefined) {
    config.listen.port = cliOptions.port;
  }

  // 端口强制校验：如果未显式指定，使用hash计算的端口
  if (config.listen.port <= 0 || config.listen.port > 65535) {
    const hashedPort = await findAvailablePort(calculateDefaultPort());
    config.listen.port = hashedPort;
    console.log(`[Config] 未指定端口，使用计算端口: ${hashedPort}`);
  }

  return assertConfig(config);
}

/**
 * 检测并迁移旧格式的规则数据
 * 如果规则使用旧格式（id 字段），则自动转换为新格式（uuid + name）
 */
function migrateRules(rules: PromptxyRule[]): PromptxyRule[] {
  if (!rules || rules.length === 0) {
    return rules;
  }

  let hasMigration = false;
  const migratedRules: PromptxyRule[] = [];

  for (const rule of rules) {
    // 检查是否为新格式（有 uuid 和 name）
    if ('uuid' in rule && 'name' in rule) {
      migratedRules.push(rule);
    } else {
      // 旧格式，需要迁移
      const legacyRule = rule as unknown as LegacyPromptxyRule;
      const { id, ...restOfRule } = legacyRule;
      const migratedRule: PromptxyRule = {
        ...restOfRule,
        uuid: `rule-${randomUUID()}`,
        name: id,
      };
      migratedRules.push(migratedRule);
      hasMigration = true;
    }
  }

  // 如果有迁移，还需要更新 assertConfig 中的验证逻辑
  // 但由于我们在返回前已经将数据转换为新格式，所以验证逻辑应该可以正常工作
  return hasMigration ? migratedRules : rules;
}

/**
 * 保存全局配置到 ~/.config/promptxy/config.json
 */
export async function saveGlobalConfig(config: PromptxyConfig): Promise<void> {
  // 确定保存路径
  const fromEnv = process.env.PROMPTXY_CONFIG;
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'promptxy');
  const defaultPath = path.join(configDir, 'config.json');

  const configPath = fromEnv || defaultPath;
  const saveDir = path.dirname(configPath);

  // 确保目录存在
  await mkdir(saveDir, { recursive: true });

  // 写入配置文件
  const json = JSON.stringify(config, null, 2);
  await writeFile(configPath, json, 'utf-8');
}

/**
 * 保存配置（别名，保持向后兼容）
 */
export async function saveConfig(config: PromptxyConfig): Promise<void> {
  return saveGlobalConfig(config);
}

export function getConfigDir(): string {
  const fromEnv = process.env.PROMPTXY_CONFIG;
  if (fromEnv) return path.dirname(fromEnv);

  const homeDir = os.homedir();
  return path.join(homeDir, '.config', 'promptxy');
}
