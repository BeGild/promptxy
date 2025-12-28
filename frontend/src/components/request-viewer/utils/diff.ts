import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { toString } from 'mdast-util-to-string';
import type { Root, Parent, Content, PhrasingContent } from 'mdast';

/**
 * 段落节点接口
 */
export interface ParagraphNode {
  id: string;
  type: string;
  content: string;
  html: string;
  index: number;
  originalIndex?: number; // 用于追踪移动
}

/**
 * 段落差异结果
 */
export interface ParagraphDiff {
  id: string;
  type: 'same' | 'added' | 'removed' | 'modified' | 'moved';
  content: string;
  html: string;
  index: number;
  originalIndex?: number;
  movedFrom?: number;
}

/**
 * Markdown 段落级对比结果
 */
export interface MarkdownDiffResult {
  paragraphs: ParagraphDiff[];
  totalOriginal: number;
  totalModified: number;
  changedCount: number;
}

/**
 * 计算字符串相似度（使用简单编辑距离）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len2][len1] / maxLen;
}

/**
 * 将 Markdown 解析为段落节点数组
 */
async function parseMarkdownToParagraphs(markdown: string): Promise<ParagraphNode[]> {
  if (!markdown || markdown.trim() === '') {
    return [];
  }

  try {
    const processor = unified().use(remarkParse).use(remarkRehype, { allowDangerousHtml: true });

    const result = await processor.process(markdown);
    // 使用 unknown 作为中间类型来避免类型错误
    const ast = result.data as unknown as Root; // 获取 MDAST

    const paragraphs: ParagraphNode[] = [];

    // 遍历 AST 提取段落级内容
    const visit = (node: Content, index: number = 0) => {
      // 处理段落
      if (node.type === 'paragraph') {
        const content = toString(node);
        paragraphs.push({
          id: `paragraph-${paragraphs.length}`,
          type: 'paragraph',
          content,
          html: content, // 简化处理，实际应渲染 HTML
          index: paragraphs.length,
        });
        return;
      }

      // 处理标题
      if (node.type === 'heading') {
        const content = toString(node);
        const depth = (node as any).depth || 1;
        paragraphs.push({
          id: `heading-${paragraphs.length}`,
          type: `h${depth}`,
          content,
          html: content,
          index: paragraphs.length,
        });
        return;
      }

      // 处理代码块
      if (node.type === 'code') {
        const content = (node as any).value || '';
        const lang = (node as any).lang || '';
        paragraphs.push({
          id: `code-${paragraphs.length}`,
          type: 'code',
          content: `Code block (${lang || 'text'})`,
          html: `Code block (${lang || 'text'})`,
          index: paragraphs.length,
        });
        return;
      }

      // 处理列表
      if (node.type === 'list' || node.type === 'listItem') {
        const content = toString(node);
        paragraphs.push({
          id: `list-${paragraphs.length}`,
          type: node.type,
          content: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          html: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          index: paragraphs.length,
        });
        return;
      }

      // 处理引用块
      if (node.type === 'blockquote') {
        const content = toString(node);
        paragraphs.push({
          id: `blockquote-${paragraphs.length}`,
          type: 'blockquote',
          content,
          html: content,
          index: paragraphs.length,
        });
        return;
      }

      // 处理分隔线
      if (node.type === 'thematicBreak') {
        paragraphs.push({
          id: `hr-${paragraphs.length}`,
          type: 'hr',
          content: '---',
          html: '---',
          index: paragraphs.length,
        });
        return;
      }

      // 递归处理子节点
      if ('children' in node && Array.isArray(node.children)) {
        for (const child of (node as Parent).children) {
          visit(child, paragraphs.length);
        }
      }
    };

    // 开始遍历
    if (ast.children) {
      for (const child of ast.children) {
        visit(child);
      }
    }

    return paragraphs;
  } catch (error) {
    console.error('Failed to parse Markdown:', error);
    // 降级处理：按空行分割
    return markdown
      .split(/\n\n+/)
      .filter(p => p.trim())
      .map((content, index) => ({
        id: `fallback-${index}`,
        type: 'paragraph',
        content: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        html: content,
        index,
      }));
  }
}

/**
 * 使用 LCS 算法匹配相似段落
 */
function matchParagraphs(
  original: ParagraphNode[],
  modified: ParagraphNode[],
  similarityThreshold: number = 0.7,
): Map<number, number> {
  const matches = new Map<number, number>();
  const usedModified = new Set<number>();

  for (const orig of original) {
    let bestMatch = -1;
    let bestSimilarity = similarityThreshold;

    for (const mod of modified) {
      if (usedModified.has(mod.index)) continue;

      const similarity = calculateSimilarity(orig.content, mod.content);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = mod.index;
      }
    }

    if (bestMatch >= 0) {
      matches.set(orig.index, bestMatch);
      usedModified.add(bestMatch);
    }
  }

  return matches;
}

/**
 * 检测段落移动
 */
function detectMoves(
  original: ParagraphNode[],
  modified: ParagraphNode[],
  matches: Map<number, number>,
): Map<number, number> {
  const moves = new Map<number, number>();

  for (const [origIndex, modIndex] of matches.entries()) {
    if (origIndex !== modIndex) {
      // 检查是否有其他匹配影响位置
      let isMove = true;
      for (const [otherOrig, otherMod] of matches.entries()) {
        if (origIndex < otherOrig && modIndex > otherMod) {
          isMove = false;
          break;
        }
      }
      if (isMove) {
        moves.set(origIndex, modIndex);
      }
    }
  }

  return moves;
}

/**
 * 执行 Markdown 段落级对比
 */
export async function diffMarkdown(
  original: string,
  modified: string,
  options: { showChangesOnly?: boolean; similarityThreshold?: number } = {},
): Promise<MarkdownDiffResult> {
  const { showChangesOnly = false, similarityThreshold = 0.7 } = options;

  const originalParagraphs = await parseMarkdownToParagraphs(original);
  const modifiedParagraphs = await parseMarkdownToParagraphs(modified);

  const matches = matchParagraphs(originalParagraphs, modifiedParagraphs, similarityThreshold);
  const moves = detectMoves(originalParagraphs, modifiedParagraphs, matches);

  const diffs: ParagraphDiff[] = [];
  const usedOriginal = new Set<number>();

  // 处理修改后的段落
  for (const mod of modifiedParagraphs) {
    const origIndex = Array.from(matches.entries()).find(([, v]) => v === mod.index)?.[0];

    if (origIndex !== undefined) {
      // 段落存在匹配
      usedOriginal.add(origIndex);
      const orig = originalParagraphs[origIndex];
      const similarity = calculateSimilarity(orig.content, mod.content);

      if (similarity < 1) {
        // 段落被修改
        diffs.push({
          id: mod.id,
          type: 'modified',
          content: mod.content,
          html: mod.html,
          index: mod.index,
          originalIndex: origIndex,
        });
      } else if (moves.has(origIndex)) {
        // 段落被移动
        diffs.push({
          id: mod.id,
          type: 'moved',
          content: mod.content,
          html: mod.html,
          index: mod.index,
          originalIndex: origIndex,
          movedFrom: origIndex,
        });
      } else if (!showChangesOnly) {
        // 段落无变化
        diffs.push({
          id: mod.id,
          type: 'same',
          content: mod.content,
          html: mod.html,
          index: mod.index,
          originalIndex: origIndex,
        });
      }
    } else {
      // 新增段落
      diffs.push({
        id: mod.id,
        type: 'added',
        content: mod.content,
        html: mod.html,
        index: mod.index,
      });
    }
  }

  // 处理删除的段落
  for (const orig of originalParagraphs) {
    if (!usedOriginal.has(orig.index)) {
      diffs.push({
        id: orig.id,
        type: 'removed',
        content: orig.content,
        html: orig.html,
        index: -1,
        originalIndex: orig.index,
      });
    }
  }

  // 按索引排序
  diffs.sort((a, b) => a.index - b.index);

  const changedCount = diffs.filter(d => d.type !== 'same').length;

  return {
    paragraphs: diffs,
    totalOriginal: originalParagraphs.length,
    totalModified: modifiedParagraphs.length,
    changedCount,
  };
}

/**
 * 将段落 diff 转换为可渲染的内容
 */
export function renderParagraphDiff(
  diff: MarkdownDiffResult,
  showChangesOnly: boolean,
): { original: string; modified: string } {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  for (const para of diff.paragraphs) {
    const prefix = getDiffPrefix(para.type);

    if (para.type === 'added') {
      modifiedLines.push(`${prefix} ${para.content}`);
    } else if (para.type === 'removed') {
      originalLines.push(`${prefix} ${para.content}`);
    } else if (para.type === 'modified') {
      originalLines.push(`${prefix} ${para.content}`);
      modifiedLines.push(`${prefix} ${para.content}`);
    } else if (para.type === 'moved') {
      originalLines.push(`${prefix} [moved from ${para.movedFrom}] ${para.content}`);
      modifiedLines.push(`${prefix} ${para.content}`);
    } else if (!showChangesOnly) {
      originalLines.push(`  ${para.content}`);
      modifiedLines.push(`  ${para.content}`);
    }
  }

  return {
    original: originalLines.join('\n\n'),
    modified: modifiedLines.join('\n\n'),
  };
}

/**
 * 获取差异前缀符号
 */
function getDiffPrefix(type: string): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'modified':
      return '~';
    case 'moved':
      return '→';
    default:
      return ' ';
  }
}
