/**
 * SSE (Server-Sent Events) 解析工具
 *
 * 用于解析 SSE 格式的文本响应，将其转换为结构化事件数组
 */

/**
 * SSE 事件结构
 */
export interface ParsedSSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * 检测内容是否为 SSE 格式
 *
 * @param content 响应内容
 * @returns 是否为 SSE 格式
 */
export function isSSEContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // SSE 通常以 "data:" 或 "event:" 开头
  const trimmed = content.trim();
  return trimmed.startsWith('data:') || trimmed.startsWith('event:');
}

/**
 * 解析 SSE 文本为事件数组
 *
 * @param content SSE 格式的文本
 * @returns 解析后的事件数组
 */
export function parseSSEToEvents(content: string): ParsedSSEEvent[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const events: ParsedSSEEvent[] = [];
  const lines = content.split('\n');

  let currentEvent: Partial<ParsedSSEEvent> & { dataParts?: string[] } = {
    dataParts: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    // 空行表示事件结束
    if (line === '') {
      if (currentEvent.dataParts && currentEvent.dataParts.length > 0) {
        currentEvent.data = currentEvent.dataParts.join('\n');
        delete currentEvent.dataParts;
        events.push(currentEvent as ParsedSSEEvent);
      }
      currentEvent = { dataParts: [] };
      continue;
    }

    // 注释行（以 : 开头）忽略
    if (line.startsWith(':')) {
      continue;
    }

    // 解析字段
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      // 没有冒号的行，视为只有字段名，值为空
      continue;
    }

    const field = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1);

    // SSE 规范：如果冒号后第一个字符是空格，移除它
    if (value.length > 0 && value[0] === ' ') {
      value = value.slice(1);
    }

    switch (field) {
      case 'id':
        currentEvent.id = value;
        break;
      case 'event':
        currentEvent.event = value;
        break;
      case 'data':
        if (!currentEvent.dataParts) {
          currentEvent.dataParts = [];
        }
        currentEvent.dataParts.push(value);
        break;
      case 'retry':
        const retryValue = parseInt(value, 10);
        if (!isNaN(retryValue)) {
          currentEvent.retry = retryValue;
        }
        break;
      default:
        // 忽略未知字段
        break;
    }
  }

  // 处理最后一个事件（如果没有以空行结尾）
  if (currentEvent.dataParts && currentEvent.dataParts.length > 0) {
    currentEvent.data = currentEvent.dataParts.join('\n');
    delete currentEvent.dataParts;
    events.push(currentEvent as ParsedSSEEvent);
  }

  return events;
}

/**
 * 将事件数组转换回 SSE 文本
 *
 * @param events 事件数组
 * @returns SSE 格式的文本
 */
export function eventsToSSE(events: ParsedSSEEvent[]): string {
  const lines: string[] = [];

  for (const event of events) {
    if (event.id) {
      lines.push(`id: ${event.id}`);
    }
    if (event.event) {
      lines.push(`event: ${event.event}`);
    }
    if (event.retry !== undefined) {
      lines.push(`retry: ${event.retry}`);
    }
    // data 可能包含换行符，需要拆分为多行
    const dataLines = event.data.split('\n');
    for (const dataLine of dataLines) {
      lines.push(`data: ${dataLine}`);
    }
    lines.push(''); // 空行表示事件结束
  }

  // 如果有事件，添加最后的空行
  if (lines.length > 0) {
    lines.push('');
  }

  return lines.join('\n');
}
