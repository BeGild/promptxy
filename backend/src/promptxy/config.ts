import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  PromptxyConfig,
  PromptxyRule,
  Supplier,
  PathMapping,
  LegacyPromptxyRule,
  Route,
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
  routes?: Route[];
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
      name: 'claude-anthropic',
      displayName: 'Claude (Anthropic)',
      baseUrl: 'https://api.anthropic.com',
      protocol: 'anthropic',
      enabled: true,
      auth: { type: 'none' },
    },
    {
      id: 'openai-official',
      name: 'openai-official',
      displayName: 'OpenAI Official',
      baseUrl: 'https://api.openai.com',
      protocol: 'openai',
      enabled: true,
      auth: { type: 'none' },
    },
    {
      id: 'gemini-google',
      name: 'gemini-google',
      displayName: 'Gemini (Google)',
      baseUrl: 'https://generativelanguage.googleapis.com',
      protocol: 'gemini',
      enabled: true,
      auth: { type: 'none' },
    },
  ],
  routes: [
    {
      id: 'route-claude-default',
      localService: 'claude',
      supplierId: 'claude-anthropic',
      transformer: 'none',
      enabled: true,
    },
    {
      id: 'route-codex-default',
      localService: 'codex',
      supplierId: 'openai-official',
      transformer: 'none',
      enabled: true,
    },
    {
      id: 'route-gemini-default',
      localService: 'gemini',
      supplierId: 'gemini-google',
      transformer: 'none',
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

  if (!supplier.displayName || typeof supplier.displayName !== 'string') {
    throw new Error(`${label}.displayName must be a non-empty string`);
  }

  assertUrl(`${label}.baseUrl`, supplier.baseUrl);

  if (!supplier.protocol || typeof supplier.protocol !== 'string') {
    throw new Error(`${label}.protocol must be a non-empty string`);
  }

  const validProtocols = ['anthropic', 'openai', 'gemini'];
  if (!validProtocols.includes(supplier.protocol)) {
    throw new Error(`${label}.protocol must be one of: ${validProtocols.join(', ')}`);
  }

  if (typeof supplier.enabled !== 'boolean') {
    throw new Error(`${label}.enabled must be a boolean`);
  }

  // 验证 auth 配置
  if (supplier.auth) {
    const authTypes = ['none', 'bearer', 'header'];
    if (!supplier.auth.type || !authTypes.includes(supplier.auth.type)) {
      throw new Error(`${label}.auth.type must be one of: ${authTypes.join(', ')}`);
    }

    if (supplier.auth.type === 'bearer' && !supplier.auth.token) {
      throw new Error(`${label}.auth.token is required when auth.type is 'bearer'`);
    }

    if (supplier.auth.type === 'header') {
      if (!supplier.auth.headerName) {
        throw new Error(`${label}.auth.headerName is required when auth.type is 'header'`);
      }
      if (!supplier.auth.headerValue) {
        throw new Error(`${label}.auth.headerValue is required when auth.type is 'header'`);
      }
    }
  }
}

/**
 * 验证供应商配置冲突
 * 新架构中，供应商不再绑定到本地路径，只检查 name 唯一性
 */
export function assertSupplierPathConflicts(suppliers: Supplier[]): void {
  // 新架构中供应商不再需要路径冲突检查
  // name 字段由前端保证唯一性，后端不做强制限制
  return;
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

  // 路由配置验证
  if (!config.routes || !Array.isArray(config.routes)) {
    throw new Error(`config.routes must be an array`);
  }

  for (let i = 0; i < config.routes.length; i++) {
    const route = config.routes[i] as any;
    const label = `config.routes[${i}]`;

    if (!route || typeof route !== 'object') {
      throw new Error(`${label} must be an object`);
    }
    if (!route.id || typeof route.id !== 'string') {
      throw new Error(`${label}.id must be a non-empty string`);
    }
    if (!route.localService || typeof route.localService !== 'string') {
      throw new Error(`${label}.localService must be a non-empty string`);
    }
    if (!route.supplierId || typeof route.supplierId !== 'string') {
      throw new Error(`${label}.supplierId must be a non-empty string`);
    }
    if (!route.transformer || typeof route.transformer !== 'string') {
      throw new Error(`${label}.transformer must be a non-empty string`);
    }
    if (typeof route.enabled !== 'boolean') {
      throw new Error(`${label}.enabled must be a boolean`);
    }
  }

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
    routes: incoming.routes ?? base.routes,
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
  const migratedRoutes = migrateRoutes(config.routes, config.suppliers);
  const migratedRulesChanged = migratedRules !== config.rules;
  const migratedRoutesChanged = migratedRoutes !== config.routes;
  const needsMigration = migratedRulesChanged || migratedRoutesChanged;

  if (needsMigration) {
    config = { ...config, rules: migratedRules, routes: migratedRoutes ?? config.routes };
    // 自动保存迁移后的配置（保存到全局配置）
    await saveGlobalConfig(config);
    if (migratedRulesChanged) {
      console.log('[Config] 规则数据已自动迁移到新格式 (uuid + name)');
    }
    if (migratedRoutesChanged) {
      console.log('[Config] routes 配置已自动迁移/补全（按 localService 唯一启用 + /codex /responses）');
    }
  }

  config = applyEnvOverrides(config);

  // 应用命令行参数（最高优先级）
  if (cliOptions?.port !== undefined) {
    config.listen.port = cliOptions.port;
  }

  // 端口处理策略：
  // - port=0：表示“自动选择端口”（计算默认端口并寻找可用端口）
  // - 非法值（非整数、<0、>65535、null 等）：直接报错（避免静默修复掩盖配置问题）
  if (config.listen.port === 0) {
    const hashedPort = await findAvailablePort(calculateDefaultPort());
    config.listen.port = hashedPort;
    console.log(`[Config] 未指定端口，使用计算端口: ${hashedPort}`);
  } else if (
    typeof (config.listen as any).port !== 'number' ||
    !Number.isInteger(config.listen.port) ||
    config.listen.port < 1 ||
    config.listen.port > 65535
  ) {
    throw new Error(`config.listen.port must be an integer in [1, 65535]`);
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

function migrateRoutes(routes: unknown, suppliers: Supplier[]): Route[] | undefined {
  if (!Array.isArray(routes) || routes.length === 0) return routes as Route[] | undefined;

  let changed = false;
  const next = (routes as Route[]).map(r => ({ ...r }));

  // 1) legacy: claude→openai 的 transformer=openai 迁移为 transformer=codex（对应 /responses）
  for (const route of next) {
    if (route.localService !== 'claude') continue;
    if (route.transformer !== 'openai') continue;
    route.transformer = 'codex';
    changed = true;
  }

  // 2) 同一 localService 只允许一个 enabled
  const enabledSeen = new Set<Route['localService']>();
  for (const route of next) {
    if (!route.enabled) continue;
    if (enabledSeen.has(route.localService)) {
      route.enabled = false;
      changed = true;
      continue;
    }
    enabledSeen.add(route.localService);
  }

  // 3) 补齐缺失的本地入口路由（claude/codex/gemini）
  const ensureRoute = (localService: Route['localService']) => {
    if (next.some(r => r.localService === localService)) return;

    const pickSupplier = () => {
      if (localService === 'codex') {
        return suppliers.find(s => s.enabled && s.protocol === 'openai') ?? suppliers.find(s => s.protocol === 'openai');
      }
      if (localService === 'gemini') {
        return suppliers.find(s => s.enabled && s.protocol === 'gemini') ?? suppliers.find(s => s.protocol === 'gemini');
      }
      // claude：优先 anthropic，否则允许跨协议
      return (
        suppliers.find(s => s.enabled && s.protocol === 'anthropic') ??
        suppliers.find(s => s.protocol === 'anthropic') ??
        suppliers.find(s => s.enabled) ??
        suppliers[0]
      );
    };

    const supplier = pickSupplier();
    if (!supplier) return;

    const id = `route-${localService}-default`;
    const transformer =
      localService === 'codex' ? 'none' : localService === 'gemini' ? 'none'
      : supplier.protocol === 'anthropic' ? 'none'
      : supplier.protocol === 'openai' ? 'codex'
      : supplier.protocol === 'gemini' ? 'gemini'
      : 'none';

    next.push({
      id,
      localService,
      supplierId: supplier.id,
      transformer,
      enabled: !enabledSeen.has(localService),
    });
    enabledSeen.add(localService);
    changed = true;
  };

  ensureRoute('claude');
  ensureRoute('codex');
  ensureRoute('gemini');

  return changed ? next : routes;
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
