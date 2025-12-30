/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007acc, #ff0000）
 * - 硬编码尺寸值（如 16px, 8px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import { Clipboard, FileText, Expand, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { rehypeXmlHighlight } from '@/utils/rehype-xml-highlight';
import { DiffStatus, type ViewNode } from '../../types';

// 导入 KaTeX 样式
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  node: ViewNode;
}

interface Heading {
  id: string;
  level: number;
  text: string;
}

/**
 * Markdown 渲染器
 * 支持代码高亮、数学公式、目录导航、全屏阅读
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ node }) => {
  const { value, diffStatus, id } = node;
  const [isExpanded, setIsExpanded] = useState(!node.defaultCollapsed);
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>('');

  const markdownContent = String(value);

  // 提取标题生成目录
  useEffect(() => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const foundHeadings: Heading[] = [];
    let match;

    while ((match = headingRegex.exec(markdownContent)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const headingId = `heading-${foundHeadings.length}`;
      foundHeadings.push({ id: headingId, level, text });
    }

    setHeadings(foundHeadings);
  }, [markdownContent]);

  // 监听滚动更新活跃标题
  useEffect(() => {
    if (!isFullScreen) return;

    const handleScroll = () => {
      const headingElements = headings
        .map(h => document.getElementById(h.id))
        .filter(Boolean) as HTMLElement[];
      const scrollTop = window.scrollY + 100;

      for (let i = headingElements.length - 1; i >= 0; i--) {
        if (headingElements[i].offsetTop <= scrollTop) {
          setActiveHeading(`heading-${i}`);
          return;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFullScreen, headings]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleCopy = useCallback(
    async (source: boolean) => {
      try {
        const contentToCopy = source ? markdownContent : markdownContent.replace(/[#*`_[\]]/g, '');
        await navigator.clipboard.writeText(contentToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },
    [markdownContent],
  );

  const scrollToHeading = useCallback((headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // 自定义渲染组件
  const components = useMemo(
    () => ({
      // 标题
      h1: ({ children, ...props }: any) => {
        const index = headings.findIndex(h => h.text === String(children));
        return (
          <h1
            id={`heading-${index}`}
            className="text-2xl font-bold mt-6 mb-4 text-primary dark:text-primary"
            {...props}
          >
            {children}
          </h1>
        );
      },
      h2: ({ children, ...props }: any) => {
        const index = headings.findIndex(h => h.text === String(children));
        return (
          <h2
            id={`heading-${index}`}
            className="text-xl font-bold mt-5 mb-3 text-primary dark:text-primary"
            {...props}
          >
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: any) => {
        const index = headings.findIndex(h => h.text === String(children));
        return (
          <h3
            id={`heading-${index}`}
            className="text-lg font-bold mt-4 mb-2 text-primary dark:text-primary"
            {...props}
          >
            {children}
          </h3>
        );
      },
      h4: ({ children, ...props }: any) => {
        const index = headings.findIndex(h => h.text === String(children));
        return (
          <h4
            id={`heading-${index}`}
            className="text-base font-bold mt-3 mb-2 text-primary dark:text-primary"
            {...props}
          >
            {children}
          </h4>
        );
      },
      h5: ({ children, ...props }: any) => {
        const index = headings.findIndex(h => h.text === String(children));
        return (
          <h5
            id={`heading-${index}`}
            className="text-sm font-bold mt-2 mb-1 text-primary dark:text-primary"
            {...props}
          >
            {children}
          </h5>
        );
      },
      h6: ({ children, ...props }: any) => {
        const index = headings.findIndex(h => h.text === String(children));
        return (
          <h6
            id={`heading-${index}`}
            className="text-xs font-bold mt-2 mb-1 text-secondary dark:text-secondary"
            {...props}
          >
            {children}
          </h6>
        );
      },
      // 段落
      p: ({ children, ...props }: any) => (
        <p className="text-sm text-secondary leading-relaxed mb-3" {...props}>
          {children}
        </p>
      ),
      // 代码块
      code: ({ inline, className, children, ...props }: any) => {
        // XML 标签高亮
        if (className?.includes('xml-tag-highlight')) {
          return (
            <code
              className="px-0.5 py-0 text-brand-primary dark:text-brand-primary/80 font-mono text-xs"
              {...props}
            >
              {children}
            </code>
          );
        }
        // 内联代码
        if (inline) {
          return (
            <code
              className="px-1 py-0.5 bg-secondary text-accent dark:text-accent/90 rounded text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          );
        }
        // 代码块中的代码
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      pre: ({ children, ...props }: any) => (
        <pre
          className="bg-canvas text-primary p-4 rounded-lg overflow-x-auto mb-4 text-xs font-mono"
          {...props}
        >
          {children}
        </pre>
      ),
      // 列表
      ul: ({ children, ...props }: any) => (
        <ul className="list-disc list-inside text-sm text-secondary mb-3 space-y-1" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }: any) => (
        <ol className="list-decimal list-inside text-sm text-secondary mb-3 space-y-1" {...props}>
          {children}
        </ol>
      ),
      li: ({ children, ...props }: any) => (
        <li className="ml-4" {...props}>
          {children}
        </li>
      ),
      // 引用
      blockquote: ({ children, ...props }: any) => (
        <blockquote className="border-l-4 border-subtle pl-4 italic text-tertiary my-3" {...props}>
          {children}
        </blockquote>
      ),
      // 表格
      table: ({ children, ...props }: any) => (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full border border-subtle" {...props}>
            {children}
          </table>
        </div>
      ),
      thead: ({ children, ...props }: any) => (
        <thead className="bg-secondary" {...props}>
          {children}
        </thead>
      ),
      tbody: ({ children, ...props }: any) => (
        <tbody className="divide-y divide-subtle" {...props}>
          {children}
        </tbody>
      ),
      tr: ({ children, ...props }: any) => (
        <tr className="hover:bg-secondary" {...props}>
          {children}
        </tr>
      ),
      th: ({ children, ...props }: any) => (
        <th
          className="px-4 py-2 text-left text-xs font-semibold text-secondary uppercase"
          {...props}
        >
          {children}
        </th>
      ),
      td: ({ children, ...props }: any) => (
        <td className="px-4 py-2 text-sm text-secondary" {...props}>
          {children}
        </td>
      ),
      // 水平线
      hr: (props: any) => <hr className="my-4 border-subtle" {...props} />,
      // 强调
      strong: ({ children, ...props }: any) => (
        <strong className="font-bold text-primary" {...props}>
          {children}
        </strong>
      ),
      em: ({ children, ...props }: any) => (
        <em className="italic text-secondary" {...props}>
          {children}
        </em>
      ),
    }),
    [headings],
  );

  // 根据差异状态获取样式
  const getDiffClass = () => {
    switch (diffStatus) {
      case DiffStatus.ADDED:
        return 'border-l-4 border-status-success bg-status-success/10';
      case DiffStatus.REMOVED:
        return 'border-l-4 border-status-error bg-status-error/10';
      case DiffStatus.MODIFIED:
        return 'border-l-4 border-status-warning bg-status-warning/10';
      default:
        return 'border-l-4 border-transparent';
    }
  };

  const markdownContentEl = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeXmlHighlight, rehypeHighlight, rehypeKatex]}
      skipHtml={false}
      components={components}
    >
      {markdownContent}
    </ReactMarkdown>
  );

  return (
    <>
      <div className={`rounded ${getDiffClass()}`}>
        {/* 头部：显示摘要和操作按钮 */}
        <div className="flex items-center justify-between px-3 py-2 bg-secondary rounded-t">
          <span className="text-xs text-tertiary">Markdown ({markdownContent.length} 字符)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(false)}
              className="inline-flex items-center gap-1 text-xs text-tertiary hover:text-primary px-2 py-1 rounded hover:bg-secondary transition-colors"
              title="复制纯文本"
            >
              {copied ? <><Check size={14} /> 已复制</> : <><Clipboard size={14} /> 复制文本</>}
            </button>
            <button
              onClick={() => handleCopy(true)}
              className="inline-flex items-center gap-1 text-xs text-tertiary hover:text-primary px-2 py-1 rounded hover:bg-secondary transition-colors"
              title="复制 Markdown 源码"
            >
              <FileText size={14} /> 复制 MD
            </button>
            <button
              onClick={() => setIsFullScreen(true)}
              className="inline-flex items-center gap-1 text-xs text-tertiary hover:text-primary px-2 py-1 rounded hover:bg-secondary transition-colors"
              title="全屏阅读"
            >
              <Expand size={14} /> 全屏
            </button>
            {node.collapsible && (
              <button
                onClick={toggleExpanded}
                className="inline-flex items-center gap-1 text-xs text-tertiary hover:text-primary px-2 py-1 rounded hover:bg-secondary transition-colors"
              >
                {isExpanded ? <><ChevronDown size={14} /> 折叠</> : <><ChevronRight size={14} /> 展开</>}
              </button>
            )}
          </div>
        </div>

        {/* 内容 */}
        {isExpanded && <div className="p-4 overflow-auto max-h-[600px]">{markdownContentEl}</div>}
      </div>

      {/* 全屏阅读模式 */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-elevated flex flex-col">
          {/* 全屏头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
            <div>
              <h2 className="text-lg font-bold text-primary">{node.label}</h2>
              <p className="text-xs text-tertiary">{node.path}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCopy(false)}
                className="inline-flex items-center gap-1 text-sm text-tertiary hover:text-primary px-3 py-1.5 rounded hover:bg-secondary transition-colors"
              >
                {copied ? <><Check size={16} /> 已复制</> : <><Clipboard size={16} /> 复制</>}
              </button>
              <button
                onClick={() => setIsFullScreen(false)}
                className="text-sm text-tertiary hover:text-primary px-3 py-1.5 rounded hover:bg-secondary transition-colors"
              >
                × 退出全屏
              </button>
            </div>
          </div>

          {/* 内容区 + 目录 */}
          <div className="flex-1 flex overflow-hidden">
            {/* Markdown 内容 */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-4xl mx-auto">{markdownContentEl}</div>
            </div>

            {/* 目录 */}
            {headings.length > 0 && (
              <div className="w-64 border-l border-subtle bg-secondary overflow-y-auto">
                <div className="p-p4">
                  <h3 className="text-sm font-bold text-secondary mb-3">目录</h3>
                  <nav className="space-y-sm">
                    {headings.map((heading, index) => (
                      <button
                        key={index}
                        onClick={() => scrollToHeading(heading.id)}
                        className={`block text-left text-xs w-full px-2 py-1 rounded transition-colors ${
                          activeHeading === heading.id
                            ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                            : 'text-tertiary hover:bg-secondary'
                        }`}
                        style={{ paddingLeft: `${(heading.level - 1) * 0.5 + 0.5}rem` }}
                      >
                        {heading.text}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MarkdownRenderer;
