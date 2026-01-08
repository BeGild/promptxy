/**
 * Gemini → Claude 响应转换（非流式）
 */

import type {
  GeminiGenerateContentResponse,
  GeminiCandidate,
  GeminiPart,
  GeminiTextPart,
  GeminiFunctionCallPart,
  GeminiUsageMetadata,
  GeminiFinishReason,
} from './types.js';
import type {
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeTextBlock,
  ClaudeToolUseBlock,
} from '../claude/types.js';

/**
 * 转换结果
 */
export interface ClaudeMessageResponse {
  role: 'assistant';
  content: ClaudeContentBlock[];
  model?: string;
  stop_reason: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 转换 Gemini 响应到 Claude 响应
 */
export function transformGeminiResponseToClaude(
  geminiResponse: GeminiGenerateContentResponse,
  model?: string
): ClaudeMessageResponse {
  // 获取第一个 candidate
  const candidate = geminiResponse.candidates?.[0];
  if (!candidate) {
    throw new Error('No candidates in Gemini response');
  }

  // 转换 content
  const content = transformParts(candidate.content?.parts ?? []);

  // 转换 usage
  const usage = transformUsage(geminiResponse.usageMetadata);

  // 转换 stop_reason
  const stopReason = transformFinishReason(candidate.finishReason);

  return {
    role: 'assistant',
    content,
    model,
    stop_reason: stopReason,
    usage,
  };
}

/**
 * 转换 Parts 到 Claude Content Blocks
 */
function transformParts(parts: GeminiPart[]): ClaudeContentBlock[] {
  // 合并和过滤 parts
  const consolidated = consolidateParts(parts);

  const blocks: ClaudeContentBlock[] = [];

  // 累积文本用于合并
  let pendingText = '';

  for (const part of consolidated) {
    if ('text' in part && part.text) {
      pendingText += part.text;
    } else if ('functionCall' in part) {
      // 先输出累积的文本
      if (pendingText) {
        blocks.push({ type: 'text', text: pendingText });
        pendingText = '';
      }

      // 转换 tool_use
      const toolUseBlock = transformFunctionCall(part.functionCall);
      blocks.push(toolUseBlock);
    } else {
      // 其他类型（thought, inlineData 等）暂时跳过
      // TODO: 添加 trace warning
    }
  }

  // 输出剩余文本
  if (pendingText) {
    blocks.push({ type: 'text', text: pendingText });
  }

  return blocks;
}

/**
 * 合并和过滤 Parts
 */
function consolidateParts(parts: GeminiPart[]): GeminiPart[] {
  const consolidated: GeminiPart[] = [];

  for (const part of parts) {
    // 过滤 thought part
    if ('thought' in part && part.thought === true) {
      continue;
    }

    consolidated.push(part);
  }

  return consolidated;
}

/**
 * 转换 FunctionCall 到 ToolUse Block
 */
function transformFunctionCall(
  functionCall: GeminiFunctionCallPart['functionCall']
): ClaudeToolUseBlock {
  // 生成 tool_use_id（Claude Code 兼容格式）
  const toolUseId = generateToolUseId(functionCall.name);

  return {
    type: 'tool_use',
    id: toolUseId,
    name: functionCall.name,
    input: functionCall.args ?? {},
  };
}

/**
 * 生成 tool_use_id（Claude Code 兼容）
 */
function generateToolUseId(toolName: string): string {
  const timestamp = Date.now();
  const index = Math.floor(Math.random() * 1000);
  return `toolu_${timestamp}_${index}`;
}

/**
 * 转换 Usage Metadata
 */
function transformUsage(metadata?: GeminiUsageMetadata): {
  input_tokens: number;
  output_tokens: number;
} | undefined {
  if (!metadata) {
    return undefined;
  }

  return {
    input_tokens: metadata.promptTokenCount ?? 0,
    output_tokens: metadata.candidatesTokenCount ?? 0,
  };
}

/**
 * 转换 Finish Reason
 */
function transformFinishReason(
  finishReason?: GeminiFinishReason
): string | null {
  if (!finishReason || finishReason === 'FINISH_REASON_UNSPECIFIED') {
    return 'end_turn';
  }

  // 映射表
  const finishReasonMap: Record<GeminiFinishReason, string> = {
    'STOP': 'end_turn',
    'MAX_TOKENS': 'max_tokens',
    'SAFETY': 'stop_sequence',
    'RECITATION': 'stop_sequence',
    'OTHER': 'end_turn',
    'BLOCKLIST': 'stop_sequence',
    'PROHIBITED_CONTENT': 'stop_sequence',
    'SPII': 'stop_sequence',
    'MALFORMED_FUNCTION_CALL': 'error',
    'LANGUAGE': 'stop_sequence',
    'IMAGE_PROHIBITED_CONTENT': 'stop_sequence',
    'NO_IMAGE': 'error',
    'UNEXPECTED_TOOL_CALL': 'error',
    'FINISH_REASON_UNSPECIFIED': 'end_turn',
  };

  const mapped = finishReasonMap[finishReason];
  if (mapped === 'error') {
    // TODO: 记录 trace error
    return 'end_turn'; // 降级为 end_turn
  }

  return mapped;
}
