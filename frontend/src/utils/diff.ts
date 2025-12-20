/**
 * JSON 差异对比算法
 */

interface DiffLine {
  type: "same" | "added" | "removed" | "modified";
  left?: string;
  right?: string;
  path?: string;
}

/**
 * 生成 JSON 差异
 */
export function generateJSONDiff(original: any, modified: any): DiffLine[] {
  const lines: DiffLine[] = [];

  function compare(obj1: any, obj2: any, path: string = ""): void {
    // 基本类型比较
    if (obj1 === obj2) {
      lines.push({ type: "same", left: JSON.stringify(obj1), right: JSON.stringify(obj2), path });
      return;
    }

    // 一个是对象/数组，另一个不是
    if (typeof obj1 !== typeof obj2 || Array.isArray(obj1) !== Array.isArray(obj2)) {
      lines.push({ type: "modified", left: JSON.stringify(obj1), right: JSON.stringify(obj2), path });
      return;
    }

    // 都是 null 或 undefined
    if (obj1 == null && obj2 == null) {
      lines.push({ type: "same", left: String(obj1), right: String(obj2), path });
      return;
    }

    // 都是对象
    if (typeof obj1 === "object" && obj1 !== null && typeof obj2 === "object" && obj2 !== null) {
      // 数组比较
      if (Array.isArray(obj1) && Array.isArray(obj2)) {
        const maxLen = Math.max(obj1.length, obj2.length);
        for (let i = 0; i < maxLen; i++) {
          const newPath = `${path}[${i}]`;
          if (i >= obj1.length) {
            lines.push({ type: "added", right: JSON.stringify(obj2[i]), path: newPath });
          } else if (i >= obj2.length) {
            lines.push({ type: "removed", left: JSON.stringify(obj1[i]), path: newPath });
          } else {
            compare(obj1[i], obj2[i], newPath);
          }
        }
        return;
      }

      // 对象比较
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      const allKeys = new Set([...keys1, ...keys2]);

      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in obj1)) {
          lines.push({ type: "added", right: JSON.stringify(obj2[key]), path: newPath });
        } else if (!(key in obj2)) {
          lines.push({ type: "removed", left: JSON.stringify(obj1[key]), path: newPath });
        } else {
          compare(obj1[key], obj2[key], newPath);
        }
      }
      return;
    }

    // 其他情况
    lines.push({ type: "modified", left: JSON.stringify(obj1), right: JSON.stringify(obj2), path });
  }

  compare(original, modified);
  return lines;
}

/**
 * 生成行级差异（用于显示）
 */
export function generateLineDiff(original: string, modified: string): string[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const result: string[] = [];

  const maxLen = Math.max(origLines.length, modLines.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const mod = modLines[i];

    if (orig === mod) {
      result.push(`  ${orig}`);
    } else if (orig && !mod) {
      result.push(`- ${orig}`);
    } else if (!orig && mod) {
      result.push(`+ ${mod}`);
    } else {
      result.push(`- ${orig}`);
      result.push(`+ ${mod}`);
    }
  }

  return result;
}

/**
 * 高亮显示差异
 */
export function highlightDiff(diff: DiffLine[]): { left: string[]; right: string[] } {
  const left: string[] = [];
  const right: string[] = [];

  for (const line of diff) {
    switch (line.type) {
      case "same":
        left.push(`  ${line.left || ""}`);
        right.push(`  ${line.right || ""}`);
        break;
      case "removed":
        left.push(`- ${line.left || ""}`);
        right.push(`  `);
        break;
      case "added":
        left.push(`  `);
        right.push(`+ ${line.right || ""}`);
        break;
      case "modified":
        left.push(`~ ${line.left || ""}`);
        right.push(`~ ${line.right || ""}`);
        break;
    }
  }

  return { left, right };
}

/**
 * 简化的 JSON 格式化（带路径高亮）
 */
export function formatJSONWithPath(obj: any, highlightPaths: string[] = []): string {
  const indent = (level: number) => "  ".repeat(level);

  function format(value: any, level: number, path: string): string {
    const isHighlighted = highlightPaths.includes(path);

    if (value === null) return "null";
    if (value === undefined) return "undefined";

    if (typeof value !== "object") {
      const str = typeof value === "string" ? `"${value}"` : String(value);
      return isHighlighted ? `>>>${str}<<<` : str;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      const items = value.map((v, i) => `${indent(level + 1)}${format(v, level + 1, `${path}[${i}]`)}`);
      return `[\n${items.join(",\n")}\n${indent(level)}]`;
    }

    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";

    const entries = keys.map((k) => {
      const v = value[k];
      return `${indent(level + 1)}"${k}": ${format(v, level + 1, path ? `${path}.${k}` : k)}`;
    });

    return `{\n${entries.join(",\n")}\n${indent(level)}}`;
  }

  return format(obj, 0, "");
}
