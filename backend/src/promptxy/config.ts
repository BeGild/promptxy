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
import { parseOpenAIModelSpec } from './model-mapping.js';

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
      supportedModels: [],
    },
    {
      id: 'openai-codex-official',
      name: 'openai-codex-official',
      displayName: 'OpenaiCodex',
      baseUrl: 'https://api.openai.com/v1',
      protocol: 'openai-codex',
      enabled: true,
      auth: { type: 'none' },
      supportedModels: [],
    },
    {
      id: 'openai-chat-official',
      name: 'openai-chat-official',
      displayName: 'Openai',
      baseUrl: 'https://api.openai.com/v1',
      protocol: 'openai-chat',
      enabled: true,
      auth: { type: 'none' },
      supportedModels: [],
    },
    {
      id: 'gemini-google',
      name: 'gemini-google',
      displayName: 'Gemini (Google)',
      baseUrl: 'https://generativelanguage.googleapis.com',
      protocol: 'gemini',
      enabled: true,
      auth: { type: 'none' },
      supportedModels: [],
    },
  ],
  routes: [
    {
      id: 'route-claude-default',
      localService: 'claude',
      modelMappings: [
        {
          id: 'claude-default-mapping',
          inboundModel: '*',
          targetSupplierId: 'claude-anthropic',
          outboundModel: undefined,
          enabled: true,
        },
      ],
      enabled: true,
    },
    {
      id: 'route-codex-default',
      localService: 'codex',
      singleSupplierId: 'openai-codex-official',
      enabled: true,
    },
    {
      id: 'route-gemini-default',
      localService: 'gemini',
      singleSupplierId: 'gemini-google',
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

  const validProtocols = ['anthropic', 'openai-codex', 'openai-chat', 'gemini'];
  if (!validProtocols.includes(supplier.protocol)) {
    throw new Error(`${label}.protocol must be one of: ${validProtocols.join(', ')}`);
  }

  if (typeof supplier.enabled !== 'boolean') {
    throw new Error(`${label}.enabled must be a boolean`);
  }

  // 供应商支持模型列表（用于路由映射/校验）
  if ((supplier as any).supportedModels !== undefined) {
    if (!Array.isArray((supplier as any).supportedModels)) {
      throw new Error(`${label}.supportedModels must be an array`);
    }
    for (let i = 0; i < (supplier as any).supportedModels.length; i++) {
      const m = (supplier as any).supportedModels[i];
      if (typeof m !== 'string' || !m.trim()) {
        throw new Error(`${label}.supportedModels[${i}] must be a non-empty string`);
      }
    }
  }

  // reasoningEfforts（UI 不暴露；未知 effort 允许，故仅做结构校验）
  if ((supplier as any).reasoningEfforts !== undefined) {
    if (!Array.isArray((supplier as any).reasoningEfforts)) {
      throw new Error(`${label}.reasoningEfforts must be an array`);
    }
    for (let i = 0; i < (supplier as any).reasoningEfforts.length; i++) {
      const e = (supplier as any).reasoningEfforts[i];
      if (typeof e !== 'string' || !e.trim()) {
        throw new Error(`${label}.reasoningEfforts[${i}] must be a non-empty string`);
      }
    }
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

function normalizeStringList(list: unknown): string[] | undefined {
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function migrateSuppliers(suppliers: Supplier[]): Supplier[] {
  if (!Array.isArray(suppliers) || suppliers.length === 0) return suppliers;

  let changed = false;
  const next = suppliers.map(s => ({ ...s })) as any[];

  for (const supplier of next) {
    const originalSupportedModels = supplier.supportedModels;
    const normalizedSupportedModels = normalizeStringList(originalSupportedModels);
    if (normalizedSupportedModels === undefined) {
      supplier.supportedModels = [];
      changed = true;
    } else if (JSON.stringify(normalizedSupportedModels) !== JSON.stringify(originalSupportedModels)) {
      supplier.supportedModels = normalizedSupportedModels;
      changed = true;
    }

    if (supplier.reasoningEfforts !== undefined) {
      const originalEfforts = supplier.reasoningEfforts;
      const normalizedEfforts = normalizeStringList(originalEfforts) ?? [];
      if (JSON.stringify(normalizedEfforts) !== JSON.stringify(originalEfforts)) {
        supplier.reasoningEfforts = normalizedEfforts;
        changed = true;
      }
    }
  }

  return changed ? (next as Supplier[]) : suppliers;
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

  const supplierById = new Map<string, Supplier>();
  for (const supplier of config.suppliers) {
    supplierById.set(supplier.id, supplier);
  }

  const requireSupplierProtocol = (
    localService: string,
  ): 'openai-codex' | 'gemini' | null => {
    if (localService === 'codex') return 'openai-codex';
    if (localService === 'gemini') return 'gemini';
    return null;
  };

  const assertSupplierProtocolForRoute = (
    label: string,
    localService: string,
    supplier: Supplier,
  ): void => {
    const required = requireSupplierProtocol(localService);
    if (!required) return;
    if (supplier.protocol !== required) {
      throw new Error(`${label} 不允许选择协议 ${supplier.protocol} 的供应商（必须为 ${required}）`);
    }
  };

  const assertTargetModelForSupplier = (
    label: string,
    supplier: Supplier,
    targetModel: string | undefined,
  ): void => {
    if (targetModel === undefined) return;
    if (typeof targetModel !== 'string' || !targetModel.trim()) {
      throw new Error(`${label}.targetModel must be a non-empty string when provided`);
    }

    const supported = Array.isArray((supplier as any).supportedModels)
      ? ((supplier as any).supportedModels as string[])
      : [];

    // 若 supplier.supportedModels 为空：不做强校验（允许自由输入/透传语义）
    if (supported.length === 0) return;

    // 允许直接命中 supportedModels
    if (supported.includes(targetModel)) return;

    // OpenAI: 允许使用 modelSpec（例如 gpt-5.2-codex-high）
    // - 若 supportedModels 仅保存 base model（例如 gpt-5.2-codex），也视为合法
    if (supplier.protocol === 'openai-codex' || supplier.protocol === 'openai-chat') {
      const parsed = parseOpenAIModelSpec(targetModel, (supplier as any).reasoningEfforts);
      if (parsed && supported.includes(parsed.model)) {
        return;
      }
    }

    throw new Error(`${label}.targetModel 必须从该供应商的 supportedModels 中选择`);
  };

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
    if (typeof route.enabled !== 'boolean') {
      throw new Error(`${label}.enabled must be a boolean`);
    }

    // Claude: 验证 modelMappings
    if (route.localService === 'claude') {
      if (route.modelMappings !== undefined) {
        if (!Array.isArray(route.modelMappings)) {
          throw new Error(`${label}.modelMappings must be an array`);
        }

        for (let j = 0; j < route.modelMappings.length; j++) {
          const rule = route.modelMappings[j];
          const ruleLabel = `${label}.modelMappings[${j}]`;

          if (!rule || typeof rule !== 'object') {
            throw new Error(`${ruleLabel} must be an object`);
          }
          if (!rule.id || typeof rule.id !== 'string') {
            throw new Error(`${ruleLabel}.id must be a non-empty string`);
          }
          if (!rule.inboundModel || typeof rule.inboundModel !== 'string') {
            throw new Error(`${ruleLabel}.inboundModel must be a non-empty string`);
          }
          if (!rule.targetSupplierId || typeof rule.targetSupplierId !== 'string') {
            throw new Error(`${ruleLabel}.targetSupplierId must be a non-empty string`);
          }
          if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
            throw new Error(`${ruleLabel}.enabled must be a boolean when provided`);
          }
          if (rule.description !== undefined && typeof rule.description !== 'string') {
            throw new Error(`${ruleLabel}.description must be a string when provided`);
          }

          const targetSupplier = supplierById.get(rule.targetSupplierId);
          if (!targetSupplier) {
            throw new Error(`${ruleLabel}.targetSupplierId 引用的供应商不存在：${rule.targetSupplierId}`);
          }
          // Claude 支持所有协议的供应商转换
          assertTargetModelForSupplier(ruleLabel, targetSupplier, rule.outboundModel);
        }
      }
    }
    // Codex/Gemini: 验证 singleSupplierId
    else {
      if (!route.singleSupplierId || typeof route.singleSupplierId !== 'string') {
        throw new Error(`${label}.singleSupplierId must be a non-empty string`);
      }

      const targetSupplier = supplierById.get(route.singleSupplierId);
      if (!targetSupplier) {
        throw new Error(`${label}.singleSupplierId 引用的供应商不存在：${route.singleSupplierId}`);
      }
      assertSupplierProtocolForRoute(`${label}.singleSupplierId`, route.localService, targetSupplier);
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
  const migratedSuppliers = migrateSuppliers(config.suppliers);
  const migratedRules = migrateRules(config.rules);
  const migratedRoutes = migrateRoutes(config.routes, migratedSuppliers);
  const migratedSuppliersChanged = migratedSuppliers !== config.suppliers;
  const migratedRulesChanged = migratedRules !== config.rules;
  const migratedRoutesChanged = migratedRoutes !== config.routes;
  const needsMigration = migratedSuppliersChanged || migratedRulesChanged || migratedRoutesChanged;

  if (needsMigration) {
    config = {
      ...config,
      suppliers: migratedSuppliers,
      rules: migratedRules,
      routes: migratedRoutes ?? config.routes,
    };
    // 自动保存迁移后的配置（保存到全局配置）
    await saveGlobalConfig(config);
    if (migratedSuppliersChanged) {
      console.log('[Config] suppliers 配置已自动迁移/补全（supportedModels 等字段）');
    }
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

  // 0) 破坏性检查：拒绝 legacy 字段（不再自动迁移）
  for (let i = 0; i < next.length; i++) {
    const route = next[i] as any;
    const label = `config.routes[${i}]`;

    const legacyErrors: string[] = [];

    // 检查 legacy 字段
    if ('modelMapping' in route && typeof route.modelMapping === 'object' && !Array.isArray(route.modelMappings)) {
      legacyErrors.push('modelMapping（旧格式，请使用 modelMappings 数组）');
    }
    if ('supplierId' in route && route.supplierId !== undefined) {
      legacyErrors.push('supplierId（已废弃）');
    }
    if ('defaultSupplierId' in route && route.defaultSupplierId !== undefined) {
      legacyErrors.push('defaultSupplierId（已废弃）');
    }
    if ('transformer' in route && route.transformer !== undefined) {
      legacyErrors.push('transformer（已废弃，现在由运行时自动推断）');
    }

    if (legacyErrors.length > 0) {
      throw new Error(`${label} 包含已废弃的字段：${legacyErrors.join('、')}。请更新配置格式。`);
    }
  }

  // 1) legacy: supplierId -> defaultSupplierId；移除 transformer（改为运行时推断）
  // 注意：由于上面的破坏性检查，这里实际上不会再执行到，但保留逻辑以防需要回退
  for (const route of next as any[]) {
    if (route.supplierId && !route.defaultSupplierId) {
      route.defaultSupplierId = route.supplierId;
      delete route.supplierId;
      changed = true;
    }

    if ('transformer' in route) {
      delete route.transformer;
      changed = true;
    }

    // legacy: modelMapping.rules[].target -> outboundModel（目标供应商补齐为 defaultSupplierId）
    if (route.modelMapping && typeof route.modelMapping === 'object') {
      const mapping: any = route.modelMapping;
      if (Array.isArray(mapping.rules)) {
        for (const rule of mapping.rules as any[]) {
          if (!rule || typeof rule !== 'object') continue;

          if (rule.target && !rule.outboundModel) {
            rule.outboundModel = rule.target;
            delete rule.target;
            changed = true;
          }

          if (!rule.targetSupplierId && route.defaultSupplierId) {
            rule.targetSupplierId = route.defaultSupplierId;
            changed = true;
          }
        }
      }
    }
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
        return suppliers.find(s => s.enabled && s.protocol === 'openai-codex') ?? suppliers.find(s => s.protocol === 'openai-codex');
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

    // 根据本地服务类型创建不同的路由结构
    if (localService === 'claude') {
      next.push({
        id,
        localService,
        modelMappings: [
          {
            id: `${id}-mapping`,
            inboundModel: '*',
            targetSupplierId: supplier.id,
            outboundModel: undefined,
            enabled: true,
          },
        ],
        enabled: !enabledSeen.has(localService),
      });
    } else {
      next.push({
        id,
        localService,
        singleSupplierId: supplier.id,
        enabled: !enabledSeen.has(localService),
      });
    }
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
