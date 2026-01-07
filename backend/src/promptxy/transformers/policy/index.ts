/**
 * Policy 模块入口
 */

export {
  getInstructionsTemplate,
  getTemplateSource,
  type TemplateSource,
} from './instructions-template.js';

export {
  applyToolSchemaPolicy,
  DEFAULT_TOOL_SCHEMA_POLICY,
  type ToolSchemaPolicy,
} from './tool-schema.js';
