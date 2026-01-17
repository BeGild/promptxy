/**
 * Claude → OpenAI Chat Completions 请求转换
 *
 * 将 Claude Messages API 请求转换为 OpenAI Chat Completions 格式
 */

import type {
  ChatCompletionRequest,
  ChatMessage,
  ChatTool,
} from './types.js';

/**
 * 转换 Claude 请求为 OpenAI Chat Completions 请求
 *
 * @param body - Claude 请求体
 * @returns OpenAI Chat Completions 请求
 */
export function transformClaudeToOpenAIChatRequest(body: any): ChatCompletionRequest {
  const messages: ChatMessage[] = [];
  const tools: ChatTool[] = [];

  // 1. 处理 system（作为第一个消息）
  if (body.system) {
    const systemText = typeof body.system === 'string' ? body.system : JSON.stringify(body.system);
    messages.push({
      role: 'system',
      content: systemText,
    });
  }

  // 2. 转换 messages
  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (!msg || typeof msg !== 'object') continue;

      const role = msg.role;
      const content = msg.content;

      // 处理用户/助手消息
      if (role === 'user' || role === 'assistant') {
        const chatMsg: ChatMessage = { role, content: '' };

        // 处理 content（可能是字符串或数组）
        if (typeof content === 'string') {
          chatMsg.content = content;
        } else if (Array.isArray(content)) {
          const textParts: string[] = [];
          const imageParts: Array<{ type: 'image_url'; image_url: { url: string } }> = [];
          const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

          for (const block of content) {
            if (!block || typeof block !== 'object') continue;

            if (block.type === 'text' && block.text) {
              textParts.push(block.text);
            } else if (block.type === 'tool_use' && role === 'assistant') {
              // assistant 的 tool_use → tool_calls
              toolCalls.push({
                id: block.id || '',
                type: 'function',
                function: {
                  name: block.name || '',
                  arguments: JSON.stringify(block.input || {}),
                },
              });
            } else if (block.type === 'image' && block.source) {
              // image block → image_url
              const source = block.source;
              if (source.type === 'url' && source.url) {
                imageParts.push({
                  type: 'image_url',
                  image_url: { url: source.url },
                });
              }
            }
          }

          // 构建内容：如果有 text 或 image，使用数组格式
          if (textParts.length > 0 || imageParts.length > 0) {
            const contentParts: any[] = [];
            if (textParts.length > 0) {
              contentParts.push({ type: 'text', text: textParts.join('\n') });
            }
            contentParts.push(...imageParts);
            chatMsg.content = contentParts.length === 1 && contentParts[0].type === 'text'
              ? contentParts[0].text
              : contentParts;
          } else {
            chatMsg.content = '';
          }

          // 设置 tool_calls（如果有）
          if (toolCalls.length > 0) {
            (chatMsg as any).tool_calls = toolCalls;
          }
        } else {
          chatMsg.content = String(content ?? '');
        }

        messages.push(chatMsg);
      } else if (role === 'tool') {
        // Claude tool_result → OpenAI tool message
        const toolMsg: ChatMessage = {
          role: 'tool',
          content: '',
          tool_call_id: msg.tool_use_id || '',
        };

        // 处理 content
        if (typeof content === 'string') {
          toolMsg.content = content;
        } else if (content === null || content === undefined) {
          toolMsg.content = JSON.stringify({ error: 'tool_result.content missing' });
        } else {
          toolMsg.content = JSON.stringify(content);
        }

        if (msg.name) {
          toolMsg.name = msg.name;
        }

        messages.push(toolMsg);
      }
    }
  }

  // 3. 转换 tools
  if (Array.isArray(body.tools)) {
    for (const tool of body.tools) {
      if (!tool || typeof tool !== 'object') continue;

      tools.push({
        type: 'function',
        function: {
          name: tool.name || '',
          description: tool.description,
          parameters: tool.input_schema,
        },
      });
    }
  }

  // 4. 转换 tool_choice：Claude any → OpenAI auto
  let toolChoice: ChatCompletionRequest['tool_choice'] = undefined;
  if (body.tool_choice) {
    if (typeof body.tool_choice === 'string' && body.tool_choice === 'any') {
      toolChoice = 'auto';
    } else if (typeof body.tool_choice === 'object' && body.tool_choice.type === 'any') {
      toolChoice = 'auto';
    } else if (typeof body.tool_choice === 'object' && body.tool_choice.type === 'tool') {
      // TODO: 处理 tool 指定
      toolChoice = 'auto';
    }
  }

  // 5. 构建请求
  const request: ChatCompletionRequest = {
    model: body.model || '',
    messages,
    stream: Boolean(body.stream),
  };

  if (tools.length > 0) {
    request.tools = tools;
  }

  if (toolChoice) {
    request.tool_choice = toolChoice;
  }

  // 可选参数
  if (body.temperature !== undefined) {
    request.temperature = body.temperature;
  }
  if (body.top_p !== undefined) {
    request.top_p = body.top_p;
  }
  if (body.max_tokens !== undefined) {
    request.max_tokens = body.max_tokens;
  }
  if (body.stop_sequences) {
    request.stop = body.stop_sequences;
  }

  return request;
}
