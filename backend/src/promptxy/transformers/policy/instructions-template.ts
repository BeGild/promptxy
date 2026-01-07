/**
 * Instructions Template 策略
 *
 * 管理 template 来源（环境变量/配置/内置）
 */

/**
 * 获取 instructions template
 *
 * 优先级：
 * 1. 环境变量 PROMPTXY_INSTRUCTIONS_TEMPLATE
 * 2. 配置传入的 template
 * 3. 内置默认值（空）
 */
export function getInstructionsTemplate(
  configTemplate?: string,
): string | undefined {
  // 优先检查环境变量
  const envTemplate = process.env.PROMPTXY_INSTRUCTIONS_TEMPLATE;
  if (envTemplate) {
    return envTemplate;
  }

  // 其次使用配置传入的 template
  if (configTemplate) {
    return configTemplate;
  }

  // 默认返回 undefined（表示不使用 template）
  return undefined;
}

/**
 * Template 来源类型
 */
export type TemplateSource = 'env' | 'config' | 'none';

/**
 * 获取 template 来源说明
 */
export function getTemplateSource(
  configTemplate?: string,
): TemplateSource {
  if (process.env.PROMPTXY_INSTRUCTIONS_TEMPLATE) {
    return 'env';
  }

  if (configTemplate) {
    return 'config';
  }

  return 'none';
}
