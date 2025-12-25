import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import type { ViewNode } from '../../types';
import { DiffStatus } from '../../types';

// 导入 KaTeX 样式
import 'katex/dist/katex.min.css';
// 导入 highlight.js 样式
import 'highlight.js/styles/github-dark.css';

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
      const headingElements = headings.map(h => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
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

  const handleCopy = useCallback(async (source: boolean) => {
    try {
      const contentToCopy = source ? markdownContent : markdownContent.replace(/[#*`_\[\]]/g, '');
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [markdownContent]);

  const scrollToHeading = useCallback((headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // 自定义渲染组件
  const components = useMemo(() => ({
    // 标题
    h1: ({ children, ...props }: any) => {
      const index = headings.findIndex(h => h.text === String(children));
      return <h1 id={`heading-${index}`} className="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100" {...props}>{children}</h1>;
    },
    h2: ({ children, ...props }: any) => {
      const index = headings.findIndex(h => h.text === String(children));
      return <h2 id={`heading-${index}`} className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100" {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: any) => {
      const index = headings.findIndex(h => h.text === String(children));
      return <h3 id={`heading-${index}`} className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100" {...props}>{children}</h3>;
    },
    h4: ({ children, ...props }: any) => {
      const index = headings.findIndex(h => h.text === String(children));
      return <h4 id={`heading-${index}`} className="text-base font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100" {...props}>{children}</h4>;
    },
    h5: ({ children, ...props }: any) => {
      const index = headings.findIndex(h => h.text === String(children));
      return <h5 id={`heading-${index}`} className="text-sm font-bold mt-2 mb-1 text-gray-900 dark:text-gray-100" {...props}>{children}</h5>;
    },
    h6: ({ children, ...props }: any) => {
      const index = headings.findIndex(h => h.text === String(children));
      return <h6 id={`heading-${index}`} className="text-xs font-bold mt-2 mb-1 text-gray-700 dark:text-gray-300" {...props}>{children}</h6>;
    },
    // 段落
    p: ({ children, ...props }: any) => (
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3" {...props}>{children}</p>
    ),
    // 代码块
    code: ({ inline, className, children, ...props }: any) => {
      if (inline) {
        return (
          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 rounded text-xs font-mono" {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }: any) => (
      <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4 text-xs font-mono" {...props}>
        {children}
      </pre>
    ),
    // 列表
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mb-3 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 mb-3 space-y-1" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="ml-4" {...props}>{children}</li>
    ),
    // 引用
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-3" {...props}>
        {children}
      </blockquote>
    ),
    // 表格
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border border-gray-200 dark:border-gray-700" {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-gray-100 dark:bg-gray-800" {...props}>{children}</thead>
    ),
    tbody: ({ children, ...props }: any) => (
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700" {...props}>{children}</tbody>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800" {...props}>{children}</tr>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase" {...props}>{children}</th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300" {...props}>{children}</td>
    ),
    // 水平线
    hr: (props: any) => (
      <hr className="my-4 border-gray-300 dark:border-gray-700" {...props} />
    ),
    // 强调
    strong: ({ children, ...props }: any) => (
      <strong className="font-bold text-gray-900 dark:text-gray-100" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: any) => (
      <em className="italic text-gray-700 dark:text-gray-300" {...props}>{children}</em>
    ),
  }), [headings]);

  // 根据差异状态获取样式
  const getDiffClass = () => {
    switch (diffStatus) {
      case DiffStatus.ADDED:
        return 'border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20';
      case DiffStatus.REMOVED:
        return 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20';
      case DiffStatus.MODIFIED:
        return 'border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-l-4 border-transparent';
    }
  };

  const markdownContentEl = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeSanitize, rehypeHighlight, rehypeKatex]}
      components={components}
    >
      {markdownContent}
    </ReactMarkdown>
  );

  return (
    <>
      <div className={`rounded ${getDiffClass()}`}>
        {/* 头部：显示摘要和操作按钮 */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-t">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Markdown ({markdownContent.length} 字符)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(false)}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="复制纯文本"
            >
              {copied ? '✓ 已复制' : '📋 复制文本'}
            </button>
            <button
              onClick={() => handleCopy(true)}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="复制 Markdown 源码"
            >
              📄 复制 MD
            </button>
            <button
              onClick={() => setIsFullScreen(true)}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="全屏阅读"
            >
              ↗ 全屏
            </button>
            {node.collapsible && (
              <button
                onClick={toggleExpanded}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {isExpanded ? '▼ 折叠' : '▶ 展开'}
              </button>
            )}
          </div>
        </div>

        {/* 内容 */}
        {isExpanded && (
          <div className="p-4 overflow-auto max-h-[600px]">
            {markdownContentEl}
          </div>
        )}
      </div>

      {/* 全屏阅读模式 */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
          {/* 全屏头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{node.label}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{node.path}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCopy(false)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {copied ? '✓ 已复制' : '📋 复制'}
              </button>
              <button
                onClick={() => setIsFullScreen(false)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                × 退出全屏
              </button>
            </div>
          </div>

          {/* 内容区 + 目录 */}
          <div className="flex-1 flex overflow-hidden">
            {/* Markdown 内容 */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-4xl mx-auto">
                {markdownContentEl}
              </div>
            </div>

            {/* 目录 */}
            {headings.length > 0 && (
              <div className="w-64 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">目录</h3>
                  <nav className="space-y-2">
                    {headings.map((heading, index) => (
                      <button
                        key={index}
                        onClick={() => scrollToHeading(heading.id)}
                        className={`block text-left text-xs w-full px-2 py-1 rounded transition-colors ${
                          activeHeading === heading.id
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
