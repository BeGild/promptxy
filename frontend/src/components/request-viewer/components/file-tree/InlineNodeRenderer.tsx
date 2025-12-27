/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="text-gray-900 dark:text-gray-100"
 * - className="bg-gray-100 dark:bg-gray-800"
 * - className="bg-blue-50/30 dark:bg-blue-900/10"
 *
 * ✅ REQUIRED:
 * - className="text-primary dark:text-primary"
 * - className="bg-canvas dark:bg-secondary"
 * - className="bg-brand-primary/10 dark:bg-brand-primary/20"
 */

import React, { useMemo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import { rehypeXmlHighlight } from '@/utils/rehype-xml-highlight';
import type { ViewNode } from '../../types';
import { NodeType, DiffStatus } from '../../types';
import { isNumericArray } from '../../utils/arrayHelper';

// 导入样式
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface InlineNodeRendererProps {
  /** 要渲染的节点 */
  node: ViewNode;
  /** 标题（显示在内容区顶部） */
  title?: string;
  /** 是否显示 Markdown 预览（默认 false 显示纯文本） */
  isMarkdownPreview?: boolean;
  /** 是否全屏模式 */
  isFullScreen?: boolean;
}

/**
 * 内联 Markdown 渲染器
 * 去掉外层容器和工具栏，用于内容面板
 */
const InlineMarkdownRenderer: React.FC<{ node: ViewNode; title?: string; isFullScreen?: boolean }> = ({ node, title, isFullScreen }) => {
  const markdownContent = String(node.value);
  // 全屏时固定左右边距，非全屏时较小边距
  const containerClass = isFullScreen ? 'px-8 py-4' : 'px-4 py-2';

  // 自定义渲染组件
  const components = useMemo(() => ({
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl font-bold mt-6 mb-4 text-primary" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-xl font-bold mt-5 mb-3 text-primary" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-bold mt-4 mb-2 text-primary" {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="text-base font-bold mt-3 mb-2 text-primary" {...props}>{children}</h4>
    ),
    p: ({ children, ...props }: any) => (
      <p className="text-sm text-secondary leading-relaxed mb-3" {...props}>{children}</p>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      // XML 标签高亮
      if (className?.includes('xml-tag-highlight')) {
        return (
          <code className="px-0.5 py-0 text-accent-purple dark:text-accent-purple/80 font-mono text-xs" {...props}>
            {children}
          </code>
        );
      }
      // 内联代码
      if (inline) {
        return (
          <code className="px-1 py-0.5 bg-canvas dark:bg-secondary text-status-error dark:text-status-error/80 rounded text-xs font-mono" {...props}>
            {children}
          </code>
        );
      }
      return <code className={className} {...props}>{children}</code>;
    },
    pre: ({ children, ...props }: any) => (
      <pre className="bg-secondary dark:bg-secondary/90 text-primary p-4 rounded-lg overflow-x-auto mb-4 text-xs font-mono" {...props}>
        {children}
      </pre>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside text-sm text-secondary mb-3 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside text-sm text-secondary mb-3 space-y-1" {...props}>{children}</ol>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-subtle pl-4 italic text-tertiary my-3" {...props}>
        {children}
      </blockquote>
    ),
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border border-subtle" {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-brand-primary/10 dark:bg-brand-primary/20" {...props}>{children}</thead>
    ),
    tbody: ({ children, ...props }: any) => (
      <tbody className="divide-y divide-subtle" {...props}>{children}</tbody>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-brand-primary/5 dark:hover:bg-brand-primary/10" {...props}>{children}</tr>
    ),
    strong: ({ children, ...props }: any) => (
      <strong className="font-bold text-primary" {...props}>{children}</strong>
    ),
  }), []);

  return (
    <div className={containerClass}>
      <div className="bg-brand-primary/10 dark:bg-brand-primary/20 border border-brand-primary/30 dark:border-brand-primary/20 rounded-lg p-4 prose dark:prose-invert max-w-none">
        {title && <h2 className="text-xl font-bold mb-4 text-primary">{title}</h2>}
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeXmlHighlight, rehypeHighlight, rehypeKatex]}
          skipHtml={false}
          components={components}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

/**
 * 纯文本渲染器
 * 显示为可编辑的文本框，无需存储
 */
const PlainTextRenderer: React.FC<{ node: ViewNode; title?: string; isFullScreen?: boolean }> = ({ node, title, isFullScreen }) => {
  const [content, setContent] = useState(String(node.value));
  // 全屏时固定左右边距，非全屏时较小边距
  const containerClass = isFullScreen ? 'px-8 py-4' : 'px-4 py-2';

  // 当节点变化时更新内容
  useEffect(() => {
    setContent(String(node.value));
  }, [node.value]);

  return (
    <div className={`${containerClass} h-full flex flex-col`}>
      {title && <h2 className="text-xl font-bold mb-4 text-primary">{title}</h2>}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full min-h-0 p-4 font-mono text-sm bg-brand-primary/10 dark:bg-brand-primary/20 text-primary border border-brand-primary/30 dark:border-brand-primary/20 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
        spellCheck={false}
      />
    </div>
  );
};

/**
 * 数值数组渲染器
 * 显示为逗号分隔的值
 */
const NumericArrayRenderer: React.FC<{ node: ViewNode; title?: string; isFullScreen?: boolean }> = ({ node, title, isFullScreen }) => {
  const values = node.value as number[];
  const containerClass = isFullScreen ? 'px-8 py-4' : 'px-4 py-2';

  return (
    <div className={containerClass}>
      {title && <h2 className="text-xl font-bold mb-4 text-primary">{title}</h2>}
      <div className="bg-brand-primary/10 dark:bg-brand-primary/20 border border-brand-primary/30 dark:border-brand-primary/20 rounded-lg p-4">
        <p className="text-xs text-tertiary mb-2">
          数值数组 ({values.length} 个元素)
        </p>
        <code className="font-mono text-sm break-all text-primary">
          [{values.join(', ')}]
        </code>
      </div>
    </div>
  );
};

/**
 * 格式化值为可读字符串
 */
const formatDisplayValue = (val: any): string => {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'number') return String(val);
  // 对象和数组类型：格式化为 JSON 字符串
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return '[Invalid Object]';
    }
  }
  return String(val);
};

/**
 * 对象渲染器（内联模式）
 * 显示 JSON 格式的结构
 */
const InlineJsonRenderer: React.FC<{ node: ViewNode; title?: string; isFullScreen?: boolean }> = ({ node, title, isFullScreen }) => {
  // 显示格式化的 JSON raw 数据
  const formattedJson = React.useMemo(() => {
    try {
      return JSON.stringify(node.value, null, 2);
    } catch {
      return '// 无法格式化此对象';
    }
  }, [node.value]);
  const containerClass = isFullScreen ? 'px-8 py-4' : 'px-4 py-2';

  return (
    <div className={containerClass}>
      {title && <h2 className="text-xl font-bold mb-4 text-primary">{title}</h2>}
      <div className="bg-brand-primary/10 dark:bg-brand-primary/20 border border-brand-primary/30 dark:border-brand-primary/20 rounded-lg p-4 overflow-x-auto">
        <pre className="text-xs text-primary font-mono whitespace-pre">
          {formattedJson}
        </pre>
      </div>
    </div>
  );
};

/**
 * 普通数组渲染器（内联模式）
 * 显示格式化的 JSON raw 数据
 */
const InlineArrayRenderer: React.FC<{ node: ViewNode; title?: string; isFullScreen?: boolean }> = ({ node, title, isFullScreen }) => {
  // 显示格式化的 JSON raw 数据
  const formattedJson = React.useMemo(() => {
    try {
      return JSON.stringify(node.value, null, 2);
    } catch {
      return '// 无法格式化此数组';
    }
  }, [node.value]);

  const childCount = node.children?.length ?? 0;
  const containerClass = isFullScreen ? 'px-8 py-4' : 'px-4 py-2';

  return (
    <div className={containerClass}>
      {title && <h2 className="text-xl font-bold mb-4 text-primary">{title}</h2>}
      <div className="bg-brand-primary/10 dark:bg-brand-primary/20 border border-brand-primary/30 dark:border-brand-primary/20 rounded-lg p-4 overflow-x-auto">
        <div className="text-xs text-tertiary mb-2 font-mono">
          {childCount} 个元素
        </div>
        <pre className="text-xs text-primary font-mono whitespace-pre">
          {formattedJson}
        </pre>
      </div>
    </div>
  );
};

/**
 * 简单值渲染器
 */
const InlinePrimitiveRenderer: React.FC<{ node: ViewNode; title?: string; isFullScreen?: boolean }> = ({ node, title, isFullScreen }) => {
  const formatValue = (val: any): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'string') return val;
    return String(val);
  };
  const containerClass = isFullScreen ? 'px-8 py-4' : 'px-4 py-2';

  return (
    <div className={containerClass}>
      {title && <h2 className="text-xl font-bold mb-4 text-primary">{title}</h2>}
      <div className="bg-brand-primary/10 dark:bg-brand-primary/20 border border-brand-primary/30 dark:border-brand-primary/20 rounded-lg p-4">
        <div className="flex items-baseline gap-4">
          <span className="text-sm font-semibold text-primary">{node.label}:</span>
          <span className="font-mono text-sm text-primary">
            {formatValue(node.value)}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * 内联节点渲染器
 * 根据节点类型选择合适的渲染方式
 * 去掉外层容器样式，适合在内容面板中使用
 */
const InlineNodeRendererInternal: React.FC<InlineNodeRendererProps> = ({
  node,
  title,
  isMarkdownPreview = false,
  isFullScreen = false
}) => {
  // 数值数组特殊处理
  if (node.type === NodeType.ARRAY && Array.isArray(node.value) && isNumericArray(node.value)) {
    return <NumericArrayRenderer node={node} title={title} isFullScreen={isFullScreen} />;
  }

  // MARKDOWN 和 STRING_LONG 根据 isMarkdownPreview 切换渲染方式
  if (node.type === NodeType.MARKDOWN || node.type === NodeType.STRING_LONG) {
    return isMarkdownPreview
      ? <InlineMarkdownRenderer node={node} title={title} isFullScreen={isFullScreen} />
      : <PlainTextRenderer node={node} title={title} isFullScreen={isFullScreen} />;
  }

  // 根据节点类型选择渲染器
  switch (node.type) {
    case NodeType.JSON:
      return <InlineJsonRenderer node={node} title={title} isFullScreen={isFullScreen} />;

    case NodeType.ARRAY:
      return <InlineArrayRenderer node={node} title={title} isFullScreen={isFullScreen} />;

    case NodeType.PRIMITIVE:
    default:
      return <InlinePrimitiveRenderer node={node} title={title} isFullScreen={isFullScreen} />;
  }
};

const InlineNodeRenderer = React.memo(InlineNodeRendererInternal);
InlineNodeRenderer.displayName = 'InlineNodeRenderer';

export default InlineNodeRenderer;
