#!/usr/bin/env tsx
/**
 * 配置迁移脚本：将旧的 claudeModelMap 迁移到新的 modelMapping
 *
 * 用法：
 *   tsx scripts/migrate-config.ts <config-file-path>
 *
 * 示例：
 *   tsx scripts/migrate-config.ts ~/.config/promptxy/config.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface ClaudeModelMap {
  sonnet: string;
  haiku?: string;
  opus?: string;
}

interface ModelMappingRule {
  id: string;
  pattern: string;
  targetSupplierId: string;
  targetModel?: string;
  description?: string;
}

interface ModelMapping {
  enabled: boolean;
  rules: ModelMappingRule[];
}

type AnyRoute = Record<string, any>;

interface Config {
  routes: AnyRoute[];
  [key: string]: any;
}

function buildRuleId(routeId: string, kind: 'sonnet' | 'haiku' | 'opus'): string {
  return `migrated-${routeId}-${kind}`;
}

/**
 * 将 claudeModelMap 转换为 modelMapping
 * 迁移语义：保持旧行为：如果 haiku/opus 未配置，则回落 sonnet 目标模型
 */
function migrateClaudeModelMap(
  routeId: string,
  defaultSupplierId: string,
  claudeModelMap: ClaudeModelMap,
): ModelMapping {
  const rules: ModelMappingRule[] = [];

  const sonnetTarget = (claudeModelMap.sonnet || '').trim();
  if (!sonnetTarget) {
    return { enabled: true, rules: [] };
  }

  rules.push({
    id: buildRuleId(routeId, 'sonnet'),
    pattern: 'claude-*-sonnet-*',
    targetSupplierId: defaultSupplierId,
    targetModel: sonnetTarget,
    description: '从 claudeModelMap.sonnet 迁移',
  });

  const haikuTarget = (claudeModelMap.haiku || '').trim();
  rules.push({
    id: buildRuleId(routeId, 'haiku'),
    pattern: 'claude-*-haiku-*',
    targetSupplierId: defaultSupplierId,
    targetModel: haikuTarget || sonnetTarget,
    description: haikuTarget ? '从 claudeModelMap.haiku 迁移' : '兼容旧行为：haiku 回落 sonnet',
  });

  const opusTarget = (claudeModelMap.opus || '').trim();
  rules.push({
    id: buildRuleId(routeId, 'opus'),
    pattern: 'claude-*-opus-*',
    targetSupplierId: defaultSupplierId,
    targetModel: opusTarget || sonnetTarget,
    description: opusTarget ? '从 claudeModelMap.opus 迁移' : '兼容旧行为：opus 回落 sonnet',
  });

  return {
    enabled: true,
    rules,
  };
}

/**
 * 迁移路由配置
 * - 仅当存在 claudeModelMap 时迁移
 * - 迁移后删除 claudeModelMap 字段
 * - 保留路由上的其他字段（避免丢失未来扩展字段）
 */
function migrateRoute(route: AnyRoute): AnyRoute {
  if (!route || typeof route !== 'object') return route;

  const routeId = typeof route.id === 'string' && route.id.trim() ? route.id : 'unknown-route';

  const migrated: AnyRoute = { ...route };

  // 1) supplierId -> defaultSupplierId
  if (migrated.supplierId && !migrated.defaultSupplierId) {
    migrated.defaultSupplierId = migrated.supplierId;
    delete migrated.supplierId;
  }

  // 2) 移除 transformer（改为运行时推断）
  if ('transformer' in migrated) {
    delete migrated.transformer;
  }

  // 3) claudeModelMap -> modelMapping（补齐 targetSupplierId=defaultSupplierId）
  if ('claudeModelMap' in migrated && migrated.claudeModelMap) {
    const defaultSupplierId = String(migrated.defaultSupplierId || '').trim();
    if (!defaultSupplierId) {
      throw new Error(`路由 ${routeId} 存在 claudeModelMap，但无法推断 defaultSupplierId（缺少 supplierId/defaultSupplierId）`);
    }

    migrated.modelMapping = migrateClaudeModelMap(routeId, defaultSupplierId, migrated.claudeModelMap as ClaudeModelMap);
    delete migrated.claudeModelMap;

    console.log(`✅ 迁移路由 ${routeId} 的 claudeModelMap → modelMapping`);
  }

  // 4) legacy: modelMapping.rules[].target -> targetModel，并补齐 targetSupplierId
  if (migrated.modelMapping && typeof migrated.modelMapping === 'object') {
    const mapping = migrated.modelMapping as any;
    if (Array.isArray(mapping.rules)) {
      for (const rule of mapping.rules as any[]) {
        if (!rule || typeof rule !== 'object') continue;

        if (rule.target && !rule.targetModel) {
          rule.targetModel = rule.target;
          delete rule.target;
        }

        if (!rule.targetSupplierId) {
          const defaultSupplierId = String(migrated.defaultSupplierId || '').trim();
          if (defaultSupplierId) {
            rule.targetSupplierId = defaultSupplierId;
          }
        }
      }
    }
  }

  return migrated;
}

/**
 * 主迁移函数
 */
function migrateConfig(configPath: string): void {
  console.log(`\n🔄 开始迁移配置文件: ${configPath}\n`);

  // 读取配置文件
  const configContent = readFileSync(configPath, 'utf-8');
  const config: Config = JSON.parse(configContent);

  // 检查是否有需要迁移的路由（只要存在 legacy 字段就认为需要迁移）
  const routesToMigrate = config.routes.filter(route => {
    const r: any = route;
    return Boolean(r?.claudeModelMap || r?.supplierId || r?.transformer || (r?.modelMapping && r?.modelMapping?.rules?.some((x: any) => x?.target)));
  });

  if (routesToMigrate.length === 0) {
    console.log('✅ 没有需要迁移的路由（未发现 supplierId/transformer/claudeModelMap/legacy modelMapping.target）\n');
    return;
  }

  console.log(`📋 发现 ${routesToMigrate.length} 个需要迁移的路由\n`);

  // 创建备份
  const backupPath = `${configPath}.backup-${Date.now()}`;
  writeFileSync(backupPath, configContent, 'utf-8');
  console.log(`💾 已创建备份: ${backupPath}\n`);

  // 迁移路由
  const migratedRoutes = config.routes.map(route => migrateRoute(route));

  // 更新配置
  const newConfig = {
    ...config,
    routes: migratedRoutes,
  };

  // 写入新配置
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');

  console.log(`\n✅ 迁移完成！`);
  console.log(`   - 已迁移 ${routesToMigrate.length} 个路由`);
  console.log(`   - 原配置已备份到: ${backupPath}`);
  console.log(`   - 新配置已写入: ${configPath}\n`);

  // 显示迁移详情
  console.log('📊 迁移详情：\n');
  routesToMigrate.forEach((route, index) => {
    const oldMap = (route as any).claudeModelMap as ClaudeModelMap;
    console.log(`${index + 1}. 路由 ${route.id}:`);
    console.log(`   - sonnet: ${oldMap.sonnet} → claude-*-sonnet-*`);
    if (oldMap.haiku) {
      console.log(`   - haiku:  ${oldMap.haiku} → claude-*-haiku-*`);
    }
    if (oldMap.opus) {
      console.log(`   - opus:   ${oldMap.opus} → claude-*-opus-*`);
    }
    console.log('');
  });
}

// 主程序
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ 错误：缺少配置文件路径参数\n');
    console.log('用法：');
    console.log('  tsx scripts/migrate-config.ts <config-file-path>\n');
    console.log('示例：');
    console.log('  tsx scripts/migrate-config.ts ~/.config/promptxy/config.json');
    process.exit(1);
  }

  const configPath = resolve(args[0]);

  try {
    migrateConfig(configPath);
  } catch (error: any) {
    console.error(`\n❌ 迁移失败: ${error.message}\n`);
    process.exit(1);
  }
}

main();
