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
  CodexInputImageItem,
  CodexContentItem,
  CodexResponsesApiTool,
} from './types.js';
import type { FieldAuditCollector } from '../../audit/field-audit.js';
import type { JsonPointer } from '../../audit/json-pointer.js';
import type { ShortNameMap } from './tool-name.js';
import { buildShortNameMap } from './tool-name.js';
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
    /** sessionId（从 metadata.user_id 提取，用于 prompt_cache_key） */
    sessionId?: string;
    /** 缓存保留策略（从 metadata 提取） */
    promptCacheRetention?: 'in_memory' | '24h';
  },
  config: RenderConfig,
  audit: FieldAuditCollector,
): CodexResponsesApiRequest {
  const { model, system, messages, tools, stream, sessionId, promptCacheRetention } = params;

  // 1. instructions = template + system
  const instructions = renderInstructions(system.text, config.instructionsTemplate, audit);

  // 2. 构建 tool name 缩短映射
  const toolNames = tools.map(t => t.name);
  const shortNameMap = buildShortNameMap(toolNames);

  // 3. messages -> input[] (传递 shortNameMap)
  const input = renderInput(messages, shortNameMap, audit);

  // 4. tools -> tools[] (传递 shortNameMap)
  const renderedTools = renderTools(tools, shortNameMap, audit);

  // 5. reasoning（从配置，只有当有 reasoningEffort 时才设置）
  const reasoning = config.reasoningEffort
    ? { effort: config.reasoningEffort, summary: { enable: true } }
    : undefined;

  // 5. include（只有当 reasoning 存在时才包含 reasoning.encrypted_content）
  const include = reasoning ? ['reasoning.encrypted_content'] : [];

  // 6. text（可选的 verbosity 配置）
  const text: { verbosity: 'low' | 'medium' | 'high' } = { verbosity: 'high' };

  const request: CodexResponsesApiRequest = {
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
    prompt_cache_key: sessionId,  // 使用 sessionId 作为 prompt_cache_key
    text,
  };

  // 添加缓存保留策略（如果指定）
  if (promptCacheRetention) {
    request.prompt_cache_retention = promptCacheRetention;
    audit.addDefaulted({
      path: '/prompt_cache_retention',
      source: 'inferred',
      reason: `Cache retention policy from client metadata: ${promptCacheRetention}`,
    });
  }

  return request;
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
  shortNameMap: ShortNameMap,
  audit: FieldAuditCollector,
): CodexResponseItem[] {
  const input: CodexResponseItem[] = [];
  let itemIndex = 0;

  for (const msg of messages) {
    const basePath = `/input/${itemIndex}`;

    for (const block of msg.content.blocks) {
      if (block.type === 'text') {
        // text block -> message item
        // 注意：根据 Codex API 规范，user 角色使用 input_text，assistant 角色使用 output_text
        const contentType = msg.role === 'assistant' ? 'output_text' : 'input_text';
        const messageItem: CodexMessageItem = {
          type: 'message',
          role: msg.role as 'user' | 'assistant',
          content: [
            {
              type: contentType,
              text: block.text || '',
            },
          ],
        };
        input.push(messageItem);
        itemIndex++;
      } else if (block.type === 'tool_use') {
        // tool_use -> function_call
        // 应用名称缩短
        const shortName = shortNameMap[block.name] || block.name;

        const fnCallItem: CodexFunctionCallItem = {
          type: 'function_call',
          call_id: block.id || '',
          name: shortName,
          arguments: JSON.stringify(block.input || {}),
        };
        input.push(fnCallItem);
        itemIndex++;
      } else if (block.type === 'tool_result') {
        // tool_result -> function_call_output
        let output: string | CodexContentItem[];

        const content = (block as any).content;
        if (content === undefined || content === null) {
          output = JSON.stringify({
            error: 'tool_result.content missing',
            tool_use_id: block.tool_use_id || '',
            is_error: true,
          });
          audit.setMetadata('toolResultContentMissingFilled', true);
        } else if (typeof content === 'string') {
          output = content;
        } else {
          output = JSON.stringify(content);
          audit.setMetadata('outputWasStringified', true);
        }

        const fnOutputItem: CodexFunctionCallOutputItem = {
          type: 'function_call_output',
          call_id: block.tool_use_id || '',
          output,
        };
        input.push(fnOutputItem);
        itemIndex++;
      } else if (block.type === 'image') {
        // image -> message item with input_image content
        // 参考: refence/claude-relay-service/src/services/openaiToClaude.js:238-290
        const messageItem: CodexMessageItem = {
          type: 'message',
          role: msg.role as 'user' | 'assistant',
          content: [
            {
              type: 'input_image',
              source: block.source,
            },
          ],
        };
        input.push(messageItem);
        itemIndex++;
      }
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
  shortNameMap: ShortNameMap,
  audit: FieldAuditCollector,
): any[] {
  return tools.map((tool, idx) => {
    const basePath = `/tools/${idx}`;

    // 特殊处理：Claude web_search 工具转换为 Codex web_search
    // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:190-195
    if (tool.name === 'web_search_20250305') {
      audit.addDefaulted({
        path: `${basePath}/type`,
        source: 'special_handling',
        reason: 'Convert Claude web_search_20250305 to Codex web_search type',
      });
      return {
        type: 'web_search',
      };
    }

    // 应用缩短后的名称
    const shortName = shortNameMap[tool.name];

    // 修复上游对部分"输出/回填字段"的严格校验：此类字段不应出现在 function 入参 schema 中
    // 目前已知：AskUserQuestion.input_schema.properties.answers 会导致 OpenAI 上游报
    // Invalid schema ... Extra required key 'answers' supplied
    const normalizedInputSchema = normalizeToolInputSchemaForCodex(
      tool.name,
      tool.inputSchema,
      audit,
      basePath,
    );

    // 策略：强剪裁（移除 format/$schema 等，添加 additionalProperties=false）
    const prunedSchema = pruneToolSchema(normalizedInputSchema, audit);

    const codexTool: CodexResponsesApiTool = {
      type: 'function',
      name: shortName,
      description: tool.description,
      strict: true,
      parameters: prunedSchema as any,
    };

    return codexTool;
  });
}

/**
 * 将 Claude tools 的 input schema 规范化为更易被 Codex/OpenAI 上游接受的形式
 *
 * 注意：这里处理的是“工具调用入参 schema”，因此应剔除明显的输出/回填字段。
 */
function normalizeToolInputSchemaForCodex(
  toolName: string,
  inputSchema: Record<string, unknown>,
  audit: FieldAuditCollector,
  toolBasePath: string,
): Record<string, unknown> {
  // 避免就地修改上游/解析阶段对象：做一个浅拷贝即可（我们只动顶层 properties/required）
  const schema: Record<string, unknown> = { ...inputSchema };

  if (toolName !== 'AskUserQuestion') {
    return schema;
  }

  const props = schema.properties;
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return schema;
  }

  // AskUserQuestion 的 answers 是权限组件回填的“用户回答”，不是模型调用时要提供的入参
  if ('answers' in (props as Record<string, unknown>)) {
    const clonedProps = { ...(props as Record<string, unknown>) };
    delete clonedProps.answers;
    schema.properties = clonedProps;

    if (Array.isArray(schema.required)) {
      schema.required = (schema.required as unknown[]).filter(
        key => typeof key === 'string' && key !== 'answers',
      );
    }

    audit.addDiff({
      op: 'remove',
      path: `${toolBasePath}/input_schema/properties/answers` as any,
      valuePreview: undefined,
    });
    audit.setMetadata('askUserQuestionAnswersStripped', true);
  }

  return schema;
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

  // 强制设置 additionalProperties=false（严格模式，上游要求）
  pruned.additionalProperties = false;

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
 *
 * 参考 codex-rs/core/src/tools/spec.rs 的 sanitize_json_schema 逻辑
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

      // 移除可能导致上游拒绝的字段（与 pruneToolSchema 保持一致）
      const fieldsToRemove = ['$schema', 'format', 'title', 'examples', 'default'];
      for (const field of fieldsToRemove) {
        if (field in obj) {
          delete obj[field];
        }
      }

      // 首先递归处理嵌套的 schema holders
      // 1. properties
      if (obj.properties && typeof obj.properties === 'object') {
        const propertyKeys = Object.keys(obj.properties);
        // 递归处理每个属性值
        for (const key of propertyKeys) {
          const value = (obj.properties as Record<string, unknown>)[key];
          if (value && typeof value === 'object') {
            (obj.properties as Record<string, unknown>)[key] = sanitizeNestedSchema(value, audit, depth + 1);
          }
        }
      }

      // 2. items
      if (obj.items && typeof obj.items === 'object') {
        obj.items = sanitizeNestedSchema(obj.items, audit, depth + 1);
      }

      // 3. anyOf、oneOf、allOf
      for (const combiner of ['anyOf', 'oneOf', 'allOf'] as const) {
        if (combiner in obj && Array.isArray(obj[combiner])) {
          obj[combiner] = obj[combiner].map(item =>
            typeof item === 'object' && item !== null
              ? sanitizeNestedSchema(item, audit, depth + 1)
              : item
          );
        }
      }

      // 推断类型：如果包含 properties/required/additionalProperties，则是对象类型
      const isObjectType = obj.type === 'object' ||
        ('properties' in obj) ||
        ('required' in obj) ||
        ('additionalProperties' in obj);

      // 如果是对象类型，确保有 additionalProperties
      if (isObjectType) {
        // 如果 additionalProperties 是一个对象 schema，先递归清理它
        if ('additionalProperties' in obj) {
          const ap = obj.additionalProperties;
          if (typeof ap === 'object' && ap !== null && !Array.isArray(ap)) {
            sanitizeNestedSchema(ap, audit, depth + 1);  // 就地修改，不需要赋值
          }
        }

        // 强制设置 additionalProperties = false（上游要求）
        obj.additionalProperties = false;

        // 如果有 properties，确保正确设置 required
        // 上游要求：required 必须包含 properties 中的所有键，且不能包含额外的键
        if (obj.properties && typeof obj.properties === 'object') {
          const propertyKeys = Object.keys(obj.properties);

          if (propertyKeys.length > 0) {
            // 如果 required 已存在，过滤掉不在 properties 中的键
            if (obj.required && Array.isArray(obj.required)) {
              obj.required = obj.required.filter((key: unknown) =>
                typeof key === 'string' && propertyKeys.includes(key)
              );
            } else {
              // 如果 required 不存在，设置为所有 property keys
              obj.required = propertyKeys;
            }
          } else {
            // 如果 properties 为空，移除 required 字段（让上游使用默认行为）
            delete obj.required;
          }
        } else if (obj.required) {
          // 如果没有 properties 但有 required，移除 required
          delete obj.required;
        }
      }

      return obj;
    } else {
      // 是数组，递归处理每个元素
      return (schema as unknown[]).map(item =>
        typeof item === 'object' && item !== null
          ? sanitizeNestedSchema(item, audit, depth + 1)
          : item
      );
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
