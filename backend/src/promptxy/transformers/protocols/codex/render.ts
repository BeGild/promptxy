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
  CodexInputImageItem,
  CodexResponsesApiTool,
} from './types.js';
import type { FieldAuditCollector } from '../../audit/field-audit.js';
import type { ShortNameMap } from './tool-name.js';
import { buildShortNameMap, shortenNameIfNeeded } from './tool-name.js';
import { extractReasoningEffort } from './reasoning.js';
import { selectCodexInstructions } from './instructions.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// Codex 默认提示词模板（使用 gpt_5_2_prompt.md）
const DEFAULT_CODEX_INSTRUCTIONS_FALLBACK = readFileSync(
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
  /** thinking 配置 */
  thinkingConfig?: { type: string; budget_tokens?: number };
  /** optional UA hint (used for Codex instructions selection) */
  userAgent?: string;
  /** optional switch to disable official codex instructions injection (CLIProxyAPI compat) */
  codexInstructionsEnabled?: boolean;
};

/**
 * renderCodexRequest 返回值类型
 */
export type RenderResult = {
  /** 渲染后的请求 */
  request: CodexResponsesApiRequest;
  /** tool name 缩短映射（original -> short），用于响应转换器反向查找 */
  shortNameMap: ShortNameMap;
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
      /** Claude builtin tool discriminator (e.g. web_search_20250305) */
      type?: string;
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
): RenderResult {
  const { model, system, messages, tools, stream, sessionId, promptCacheRetention } = params;

  // 1. instructions = template + system
  const instructions = renderInstructions(
    params.model,
    system.text,
    config,
    audit,
  );

  // 2. 构建 tool name 缩短映射
  const toolNames = tools
    .map(t => t.name)
    .filter(Boolean);
  const shortNameMap = buildShortNameMap(toolNames);

  // 3. messages -> input[] (传递 shortNameMap)
  let input = renderInput(messages, shortNameMap, audit);

  // 3.2. 注入 Claude system（developer message），对齐 CLIProxyAPI：
  // refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go
  if (system.text && system.text.trim()) {
    const systemMsg: CodexMessageItem = {
      type: 'message',
      role: 'developer',
      content: [{ type: 'input_text', text: system.text }],
    };
    input = [systemMsg, ...input];
    audit.addDefaulted({
      path: '/input/0',
      source: 'inferred',
      reason: 'Inject Claude system as developer message (Claude -> Codex compatibility)',
    });
  }

  // 3.5. 添加特殊前置指令消息
  // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:244-260
  const codexInstructionsEnabled = config.codexInstructionsEnabled ?? (process.env.PROMPTXY_CODEX_INSTRUCTIONS_ENABLED !== '0');
  const finalInput = codexInstructionsEnabled ? addSpecialInstructionMessage(input, audit) : input;

  // 4. tools -> tools[] (传递 shortNameMap)
  const renderedTools = renderTools(tools, shortNameMap, audit);

  // 5. reasoning（对齐 CLIProxyAPI：默认始终带上 effort + summary="auto"）
  // - effort 默认 medium（可由 thinkingConfig 推导）
  // - summary 使用 "auto"（让上游输出 reasoning_summary_* SSE 事件）
  let reasoningEffort = config.reasoningEffort || 'medium';
  if (config.thinkingConfig) {
    reasoningEffort = extractReasoningEffort(params.model, config.thinkingConfig) || reasoningEffort;
  }
  const reasoning = {
    effort: reasoningEffort,
    summary: 'auto' as const,
  };

  // 5. include（对齐参考：始终包含 reasoning.encrypted_content）
  const include = ['reasoning.encrypted_content'];

  // 6. text（可选的 verbosity 配置）
  const text: { verbosity: 'low' | 'medium' | 'high' } = { verbosity: 'high' };

  const request: CodexResponsesApiRequest = {
    model,
    instructions,
    input: finalInput,
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

  return { request, shortNameMap };
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
  modelName: string,
  systemText: string,
  config: RenderConfig,
  audit: FieldAuditCollector,
): string {
  // Prefer explicit override (legacy), otherwise select Codex CLI-compatible instructions.
  if (config.instructionsTemplate && config.instructionsTemplate.trim()) {
    audit.addDefaulted({
      path: '/instructions',
      source: 'template',
      reason: 'Explicit instructionsTemplate override',
    });
    return config.instructionsTemplate;
  }

  const enabled = config.codexInstructionsEnabled ?? (process.env.PROMPTXY_CODEX_INSTRUCTIONS_ENABLED !== '0');
  const ua = config.userAgent;
  const { instructions } = selectCodexInstructions({
    modelName,
    systemInstructions: '',
    userAgent: ua,
    enabled,
  });

  const codexTemplate = instructions || DEFAULT_CODEX_INSTRUCTIONS_FALLBACK;

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

  function buildInputImageItem(source: any): CodexInputImageItem {
    const imageItem: CodexInputImageItem = { type: 'input_image' };

    // url: keep both `source` and `image_url` for maximal compatibility
    if (source && typeof source === 'object' && source.type === 'url' && typeof source.url === 'string') {
      imageItem.source = { type: 'url', url: source.url };
      imageItem.image_url = source.url;
      return imageItem;
    }

    // base64 -> data URL (CLIProxyAPI compatible)
    if (source && typeof source === 'object' && source.type === 'base64') {
      const data = (source.data || source.base64) as string | undefined;
      const mediaType = (source.media_type || source.mime_type || 'application/octet-stream') as string;
      if (typeof data === 'string' && data) {
        imageItem.image_url = `data:${mediaType};base64,${data}`;
      }
      return imageItem;
    }

    // fallback: no-op
    return imageItem;
  }

  function newMessage(role: 'user' | 'assistant'): CodexMessageItem {
    return { type: 'message', role, content: [] };
  }

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    let current = newMessage(role);

    const flush = () => {
      if (current.content.length === 0) return;
      input.push(current);
      itemIndex++;
      current = newMessage(role);
    };

    for (const block of msg.content.blocks) {
      if (block.type === 'text') {
        // Pack multiple blocks into a single message item (CLIProxyAPI behavior).
        const contentType = role === 'assistant' ? 'output_text' : 'input_text';
        current.content.push({
          type: contentType,
          text: block.text || '',
        } as any);
        continue;
      }

      if (block.type === 'image') {
        current.content.push(buildInputImageItem((block as any).source) as any);
        continue;
      }

      if (block.type === 'tool_use') {
        // tool_use -> function_call (flush message before tool call)
        flush();

        const shortName = shortNameMap[block.name] || shortenNameIfNeeded(block.name);
        const fnCallItem: CodexFunctionCallItem = {
          type: 'function_call',
          call_id: block.id || '',
          name: shortName,
          arguments: JSON.stringify(block.input || {}),
        };
        input.push(fnCallItem);
        itemIndex++;
        continue;
      }

      if (block.type === 'tool_result') {
        // tool_result -> function_call_output (flush message before output)
        flush();

        const content = (block as any).content;
        let output: string = '';
        if (typeof content === 'string') {
          output = content;
        } else if (content !== undefined && content !== null) {
          output = JSON.stringify(content);
        }

        const fnOutputItem: CodexFunctionCallOutputItem = {
          type: 'function_call_output',
          call_id: block.tool_use_id || '',
          output,
        };
        input.push(fnOutputItem);
        itemIndex++;
        continue;
      }
    }

    flush();
  }

  return input;
}

/**
 * 添加特殊前置指令消息
 *
 * 在 input 开头添加特殊消息，确保上游忽略系统指令并按照我们的指令执行
 *
 * 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:244-260
 */
function addSpecialInstructionMessage(
  input: CodexResponseItem[],
  audit: FieldAuditCollector,
): CodexResponseItem[] {
  if (input.length === 0) {
    // 空 input，添加特殊指令作为第一条消息
    audit.addDefaulted({
      path: '/input/0',
      source: 'special_instruction',
      reason: 'Add special instruction message as first input',
    });

    return [{
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!',
      }],
    }];
  }

  // 检查第一条消息是否已经是我们的特殊指令
  const firstItem = input[0];
  if (
    firstItem.type === 'message' &&
    firstItem.role === 'user' &&
    firstItem.content[0]?.type === 'input_text' &&
    firstItem.content[0].text === 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!'
  ) {
    // 已经存在，不重复添加
    return input;
  }

  // 在开头添加特殊指令
  audit.addDefaulted({
    path: '/input/0',
    source: 'special_instruction',
    reason: 'Prepend special instruction message to input',
  });

  return [
    {
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!',
      }],
    },
    ...input,
  ];
}

/**
 * 渲染 tools[]
 *
 * 将 Claude tools 转换为 Codex tools[]
 */
function renderTools(
  tools: Array<{
    type?: string;
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
    if (tool.type === 'web_search_20250305' || tool.name === 'web_search_20250305') {
      audit.addDefaulted({
        path: `${basePath}/type`,
        source: 'special_handling',
        reason: 'Convert Claude web_search_20250305 to Codex web_search type',
      });
      return {
        type: 'web_search',
      };
    }

    // 防守：function tool 必须有 name
    if (!tool.name || typeof tool.name !== 'string') {
      audit.setMetadata('skippedToolWithMissingName', true);
      return null;
    }

    // 应用缩短后的名称
    const shortName = shortNameMap[tool.name];
    // 对齐 CLIProxyAPI：只做最小 schema 规范化，避免 strict schema 引发上游拒绝
    const prunedSchema = normalizeToolParametersForCodex(tool.inputSchema);

    const codexTool: CodexResponsesApiTool = {
      type: 'function',
      name: shortName,
      description: tool.description,
      strict: false,
      parameters: prunedSchema as any,
    };

    return codexTool;
  }).filter(Boolean);
}

/**
 * 对齐 CLIProxyAPI：最小化 tool parameters 规范化
 * - 缺省/无效 -> {"type":"object","properties":{}}
 * - type 缺省 -> object
 * - object 但没有 properties -> properties={}
 * - 删除 $schema（上游可能拒绝）
 */
function normalizeToolParametersForCodex(inputSchema: Record<string, unknown>): Record<string, unknown> {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return { type: 'object', properties: {} };
  }

  const schema: Record<string, unknown> = { ...inputSchema };

  if ('$schema' in schema) {
    delete (schema as any)['$schema'];
  }

  if (typeof schema.type !== 'string' || !schema.type) {
    schema.type = 'object';
  }

  if (schema.type === 'object') {
    const props = schema.properties;
    if (!props || typeof props !== 'object' || Array.isArray(props)) {
      schema.properties = {};
    }
  }

  return schema;
}
