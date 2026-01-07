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

  // 4. reasoning（从配置）
  const reasoning = config.reasoningEffort
    ? { effort: config.reasoningEffort }
    : undefined;

  return {
    model,
    instructions,
    input,
    tools: renderedTools,
    tool_choice: 'auto',
    parallel_tool_calls: false,
    reasoning,
    store: true,
    stream,
    include: [],
  };
}

/**
 * 渲染 instructions
 *
 * 规则：template + "\n\n" + system
 */
function renderInstructions(
  systemText: string,
  template: string | undefined,
  audit: FieldAuditCollector,
): string {
  if (!template) {
    // 没有 template，记录默认值来源
    if (systemText) {
      audit.addDefaulted({
        path: '/instructions',
        source: 'inferred',
        reason: 'No template configured, using system text only',
      });
    }
    return systemText;
  }

  // 记录 template 作为默认值来源
  audit.addDefaulted({
    path: '/instructions',
    source: 'template',
    reason: 'Template configured (prefix of instructions)',
  });

  if (!systemText) {
    return template;
  }

  return `${template}\n\n${systemText}`;
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
 */
function pruneToolSchema(
  schema: Record<string, unknown>,
  audit: FieldAuditCollector,
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
      // 可选：记录到审计
    }
  }

  // 添加 additionalProperties=false（严格模式）
  if (!('additionalProperties' in pruned)) {
    pruned.additionalProperties = false;
  }

  return pruned;
}

/**
 * 渲染单个 path 的 JSON Pointer
 */
function jp(...segments: (string | number)[]): JsonPointer {
  return '/' + segments.join('/');
}
