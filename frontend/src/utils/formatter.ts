/**
 * 格式化工具函数
 */

/**
 * 格式化时间戳
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 如果是今天
  if (diff < 24 * 60 * 60 * 1000 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  // 如果是今年
  if (now.getFullYear() === date.getFullYear()) {
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleString("zh-CN");
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return "刚刚";
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

  return formatTime(timestamp);
}

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化 JSON
 */
export function formatJSON(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 格式化客户端名称
 */
export function formatClient(client: string): string {
  const map: Record<string, string> = {
    claude: "Claude",
    codex: "Codex",
    gemini: "Gemini",
  };
  return map[client] || client;
}

/**
 * 格式化状态码
 */
export function formatStatus(status?: number): string {
  if (!status) return "N/A";
  if (status >= 200 && status < 300) return `${status} ✓`;
  if (status >= 400) return `${status} ✗`;
  return `${status}`;
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status?: number): "success" | "warning" | "error" | "default" {
  if (!status) return "default";
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "warning";
  return "error";
}

/**
 * 生成 UUID
 */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
