/**
 * Codex Responses API 渲染
 *
 * 将规范化的数据渲染为 Codex /v1/responses 请求
 */

import type {
  CodexResponsesApiRequest,
  CodexResponseItem,
  CodexMessageItem,
  CodexFunctionCallItem,
  CodexFunctionCallOutputItem,
  CodexInputTextItem,
  CodexContentItem,
  CodexResponsesApiTool,
} from './types.js';
import type { FieldAuditCollector } from '../../audit/field-audit.js';
import type { JsonPointer } from '../../audit/json-pointer.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// Codex 默认提示词模板（使用 gpt_5_2_prompt.md）
const DEFAULT_CODEX_INSTRUCTIONS = readFileSync(
  join(__dirname, './templates/gpt_5_2.md'),
  'utf-8'
);

/**
 * 渲染配置
 */
export type RenderConfig = {
  /** instructions 模板（在前） */
  instructionsTemplate?: string;
  /** reasoning effort（从 modelSpec 解析） */
  reasoningEffort?: string;
};

/**
 * 渲染 Codex /v1/responses 请求
 */
export function renderCodexRequest(
  params: {
    /** model */
    model: string;
    /** system（已规范化） */
    system: { text: string };
    /** messages（已规范化） */
    messages: Array<{
      role: string;
      content: { blocks: Array<{ type: string; [key: string]: any }> };
    }>;
    /** tools */
    tools: Array<{
      name: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }>;
    /** stream */
    stream: boolean;
  },
  config: RenderConfig,
  audit: FieldAuditCollector,
): CodexResponsesApiRequest {
  const { model, system, messages, tools, stream } = params;

  // 1. instructions = template + system
  const instructions = renderInstructions(system.text, config.instructionsTemplate, audit);

  // 2. messages -> input[]
  const input = renderInput(messages, audit);

  // 3. tools -> tools[]
  const renderedTools = renderTools(tools, audit);

  // 4. reasoning（从配置，只有当有 reasoningEffort 时才设置）
  const reasoning = config.reasoningEffort
    ? { effort: config.reasoningEffort, summary: { enable: true } }
    : undefined;

  // 5. include（只有当 reasoning 存在时才包含 reasoning.encrypted_content）
  const include = reasoning ? ['reasoning.encrypted_content'] : [];

  // 6. text（可选的 verbosity 配置）
  const text: { verbosity: 'low' | 'medium' | 'high' } = { verbosity: 'high' };

  return {
    model,
    instructions,
    input,
    tools: renderedTools,
    tool_choice: 'auto',
    parallel_tool_calls: true,
    reasoning,
    store: false,  // 上游要求必须是 false
    stream: true,  // Codex API 强制要求 stream=true
    include,
    // prompt_cache_key: 暂不设置，需要 conversation_id
    text,
  };
}

/**
 * 渲染 instructions
 *
 * 规则：使用 Codex 模板（替换 Claude system，因为上游会验证身份）
 *
 * 上游验证逻辑：检查 instructions 是否包含 Codex 身份标识
 * - "You are Codex, based on GPT-5. You are running as a coding agent..."
 */
function renderInstructions(
  systemText: string,
  template: string | undefined,
  audit: FieldAuditCollector,
): string {
  // 使用配置的 template 或默认 Codex 模板
  const codexTemplate = template || DEFAULT_CODEX_INSTRUCTIONS;

  // 记录 Codex 模板来源（用于上游验证）
  audit.addDefaulted({
    path: '/instructions',
    source: 'template',
    reason: 'Codex identity template (replaces Claude system for upstream validation)',
  });

  // 返回 Codex 模板，不附加 Claude system（Claude 的 system 已经被规范化处理，
  // 包含了必要的配置信息，但上游需要 Codex 身份验证）
  return codexTemplate;
}

/**
 * 渲染 input[]
 *
 * 将 Claude messages 转换为 Codex input[]:
 * - text block -> {type: "message", role, content: [{type: "input_text", text}]}
 * - tool_use -> {type: "function_call", call_id, name, arguments}
 * - tool_result -> {type: "function_call_output", call_id, output}
 */
function renderInput(
  messages: Array<{
    role: string;
    content: { blocks: Array<{ type: string; [key: string]: any }> };
  }>,
  audit: FieldAuditCollector,
): CodexResponseItem[] {
  const input: CodexResponseItem[] = [];
  let itemIndex = 0;

  for (const msg of messages) {
    const basePath = `/input/${itemIndex}`;

    for (const block of msg.content.blocks) {
      if (block.type === 'text') {
        // text block -> message item
        const messageItem: CodexMessageItem = {
          type: 'message',
          role: msg.role as 'user' | 'assistant',
          content: [
            {
              type: 'input_text',
              text: block.text || '',
            } as CodexInputTextItem,
          ],
        };
        input.push(messageItem);
        itemIndex++;
      } else if (block.type === 'tool_use') {
        // tool_use -> function_call
        const fnCallItem: CodexFunctionCallItem = {
          type: 'function_call',
          call_id: block.id || '',
          name: block.name || '',
          arguments: JSON.stringify(block.input || {}),
        };
        input.push(fnCallItem);
        itemIndex++;
      } else if (block.type === 'tool_result') {
        // tool_result -> function_call_output
        let output: string | CodexContentItem[];

        // v1 保守策略：非 string 统一 stringify
        if (typeof block.content === 'string') {
          output = block.content;
        } else {
          output = JSON.stringify(block.content);
          audit.setMetadata('outputWasStringified', true);
        }

        const fnOutputItem: CodexFunctionCallOutputItem = {
          type: 'function_call_output',
          call_id: block.tool_use_id || '',
          output,
        };
        input.push(fnOutputItem);
        itemIndex++;
      }
      // 其他类型（image）暂不映射
    }
  }

  return input;
}

/**
 * 渲染 tools[]
 *
 * 将 Claude tools 转换为 Codex tools[]
 */
function renderTools(
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>,
  audit: FieldAuditCollector,
): any[] {
  return tools.map((tool, idx) => {
    const basePath = `/tools/${idx}`;

    // 策略：强剪裁（移除 format/$schema 等，添加 additionalProperties=false）
    const prunedSchema = pruneToolSchema(tool.inputSchema, audit);

    const codexTool: CodexResponsesApiTool = {
      type: 'function',
      name: tool.name,
      description: tool.description,
      strict: true,
      parameters: prunedSchema as any,
    };

    return codexTool;
  });
}

/**
 * 剪裁 tool schema
 *
 * 移除可能导致上游拒绝的字段，添加 strict 策略
 * 递归处理嵌套的 schema（anyOf、oneOf 等中的对象）
 */
function pruneToolSchema(
  schema: Record<string, unknown>,
  audit: FieldAuditCollector,
  depth = 0,
): Record<string, unknown> {
  const pruned: Record<string, unknown> = {
    type: 'object',
    ...schema,
  };

  // 移除可能导致问题的字段
  const fieldsToRemove = ['$schema', 'format', 'title', 'examples', 'default'];
  for (const field of fieldsToRemove) {
    if (field in pruned) {
      delete pruned[field];
    }
  }

  // 添加 additionalProperties=false（严格模式）
  if (!('additionalProperties' in pruned)) {
    pruned.additionalProperties = false;
  }

  // 对于 strict 模式，确保 required 包含所有 properties 中的 key
  // 上游要求：required 必须存在且包含所有 properties 的 key
  if (pruned.properties && typeof pruned.properties === 'object') {
    const propertyKeys = Object.keys(pruned.properties);
    if (propertyKeys.length > 0) {
      // 当 strict=true 且有 properties 时，required 必须包含所有 properties 的 key
      pruned.required = propertyKeys;

      // 递归处理嵌套的属性值（如 anyOf、oneOf 等中的对象）
      for (const key of propertyKeys) {
        const value = (pruned.properties as Record<string, unknown>)[key];
        if (value && typeof value === 'object') {
          const sanitized = sanitizeNestedSchema(value, audit, depth);
          (pruned.properties as Record<string, unknown>)[key] = sanitized;
        }
      }
    }
    // 如果 properties 为空，不设置 required 字段（让上游使用默认行为）
  }
  // 如果没有 properties，不设置 required 字段

  // 递归处理 anyOf、oneOf、allOf 等组合类型
  for (const combiner of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (combiner in pruned && Array.isArray(pruned[combiner])) {
      pruned[combiner] = (pruned[combiner] as unknown[]).map(item =>
        typeof item === 'object' && item !== null
          ? pruneToolSchema(item as Record<string, unknown>, audit, depth + 1)
          : item
      );
    }
  }

  return pruned;
}

/**
 * 清理嵌套的 schema
 * 确保嵌套对象也有 additionalProperties: false 和 required 字段
 */
function sanitizeNestedSchema(
  schema: unknown,
  audit: FieldAuditCollector,
  depth: number,
): unknown {
  // 防止无限递归
  if (depth > 10) return schema;

  if (schema && typeof schema === 'object') {
    if (!Array.isArray(schema)) {
      const obj = schema as Record<string, unknown>;

      // 如果是对象类型，确保有 additionalProperties
      if (obj.type === 'object') {
        if (!('additionalProperties' in obj)) {
          obj.additionalProperties = false;
        }

        // 如果有 properties，处理 required（只有当 properties 非空时）
        if (obj.properties && typeof obj.properties === 'object') {
          const propertyKeys = Object.keys(obj.properties);
          if (!obj.required && propertyKeys.length > 0) {
            obj.required = propertyKeys;
          }

          // 递归处理嵌套的属性
          for (const key of propertyKeys) {
            const value = (obj.properties as Record<string, unknown>)[key];
            if (value && typeof value === 'object') {
              (obj.properties as Record<string, unknown>)[key] = sanitizeNestedSchema(value, audit, depth + 1);
            }
          }
        }
      }

      // 递归处理 anyOf、oneOf、allOf
      for (const combiner of ['anyOf', 'oneOf', 'allOf'] as const) {
        if (combiner in obj && Array.isArray(obj[combiner])) {
          obj[combiner] = obj[combiner].map(item =>
            typeof item === 'object' && item !== null
              ? sanitizeNestedSchema(item, audit, depth + 1)
              : item
          );
        }
      }

      return obj;
    }
  }

  return schema;
}

/**
 * 渲染单个 path 的 JSON Pointer
 */
function jp(...segments: (string | number)[]): JsonPointer {
  return '/' + segments.join('/');
}
