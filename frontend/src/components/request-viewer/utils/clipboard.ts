import { NodeType, type ViewNode } from '../types';

/**
 * 获取节点可复制的内容
 * - 叶子节点：复制当前值
 * - 非叶子节点（对象/数组）：复制格式化后的 JSON 数据
 */
export function getNodeCopyContent(node: ViewNode): string {
  const { value, type } = node;

  // 非叶子节点：对象和数组类型，返回格式化的 JSON
  if (type === NodeType.JSON || type === NodeType.ARRAY) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value ?? '');
    }
  }

  // 叶子节点：返回原始值的字符串形式
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案：使用传统方法
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  }
}
