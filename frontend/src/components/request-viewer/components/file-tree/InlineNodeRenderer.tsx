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
}

/**
 * 内联 Markdown 渲染器
 * 去掉外层容器和工具栏，用于内容面板
 */
const InlineMarkdownRenderer: React.FC<{ node: ViewNode; title?: string }> = ({ node, title }) => {
  const markdownContent = String(node.value);

  // 自定义渲染组件
  const components = useMemo(() => ({
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-gray-100" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100" {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="text-base font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100" {...props}>{children}</h4>
    ),
    p: ({ children, ...props }: any) => (
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3" {...props}>{children}</p>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      // XML 标签高亮
      if (className?.includes('xml-tag-highlight')) {
        return (
          <code className="px-0.5 py-0 text-emerald-600 dark:text-emerald-400 font-mono text-xs" {...props}>
            {children}
          </code>
        );
      }
      // 内联代码
      if (inline) {
        return (
          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 rounded text-xs font-mono" {...props}>
            {children}
          </code>
        );
      }
      return <code className={className} {...props}>{children}</code>;
    },
    pre: ({ children, ...props }: any) => (
      <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4 text-xs font-mono" {...props}>
        {children}
      </pre>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mb-3 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 mb-3 space-y-1" {...props}>{children}</ol>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-3" {...props}>
        {children}
      </blockquote>
    ),
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
    strong: ({ children, ...props }: any) => (
      <strong className="font-bold text-gray-900 dark:text-gray-100" {...props}>{children}</strong>
    ),
  }), []);

  return (
    <div className="prose dark:prose-invert max-w-none">
      {title && <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeXmlHighlight, rehypeHighlight, rehypeKatex]}
        skipHtml={false}
        components={components}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

/**
 * 纯文本渲染器
 * 显示为可编辑的文本框，无需存储
 */
const PlainTextRenderer: React.FC<{ node: ViewNode; title?: string }> = ({ node, title }) => {
  const [content, setContent] = useState(String(node.value));

  // 当节点变化时更新内容
  useEffect(() => {
    setContent(String(node.value));
  }, [node.value]);

  return (
    <div className="px-4 py-2 h-full flex flex-col">
      {title && <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full min-h-0 p-4 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        spellCheck={false}
      />
    </div>
  );
};

/**
 * 数值数组渲染器
 * 显示为逗号分隔的值
 */
const NumericArrayRenderer: React.FC<{ node: ViewNode; title?: string }> = ({ node, title }) => {
  const values = node.value as number[];

  return (
    <div className="p-4">
      {title && <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          数值数组 ({values.length} 个元素)
        </p>
        <code className="font-mono text-sm break-all text-gray-700 dark:text-gray-300">
          [{values.join(', ')}]
        </code>
      </div>
    </div>
  );
};

/**
 * 对象渲染器（内联模式）
 * 显示 JSON 格式的结构
 */
const InlineJsonRenderer: React.FC<{ node: ViewNode; title?: string }> = ({ node, title }) => {
  // 简化显示：只显示类型和子项数量
  const childCount = node.children?.length ?? 0;

  return (
    <div className="p-4">
      {title && <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">{node.label}</span>
          <span className="text-gray-500 dark:text-gray-400"> ({childCount} 项)</span>
        </p>
        {childCount > 0 && (
          <div className="mt-2 space-y-1">
            {node.children?.slice(0, 10).map(child => (
              <div key={child.id} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                • {child.label}: {typeof child.value === 'string' ? `"${child.value}"` : String(child.value ?? 'null')}
              </div>
            ))}
            {childCount > 10 && (
              <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                ... 还有 {childCount - 10} 项
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 普通数组渲染器（内联模式）
 */
const InlineArrayRenderer: React.FC<{ node: ViewNode; title?: string }> = ({ node, title }) => {
  const childCount = node.children?.length ?? 0;

  return (
    <div className="p-4">
      {title && <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">{node.label}</span>
          <span className="text-gray-500 dark:text-gray-400"> ({childCount} 个元素)</span>
        </p>
        {childCount > 0 && childCount <= 20 && (
          <div className="mt-2 space-y-1">
            {node.children?.map((child, index) => (
              <div key={child.id} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                [{index}]: {typeof child.value === 'string' ? `"${child.value}"` : String(child.value ?? 'null')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 简单值渲染器
 */
const InlinePrimitiveRenderer: React.FC<{ node: ViewNode; title?: string }> = ({ node, title }) => {
  const formatValue = (val: any): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'string') return val;
    return String(val);
  };

  return (
    <div className="p-4">
      {title && <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h2>}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-baseline gap-4">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{node.label}:</span>
          <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
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
  isMarkdownPreview = false
}) => {
  // 数值数组特殊处理
  if (node.type === NodeType.ARRAY && Array.isArray(node.value) && isNumericArray(node.value)) {
    return <NumericArrayRenderer node={node} title={title} />;
  }

  // MARKDOWN 和 STRING_LONG 根据 isMarkdownPreview 切换渲染方式
  if (node.type === NodeType.MARKDOWN || node.type === NodeType.STRING_LONG) {
    return isMarkdownPreview
      ? <InlineMarkdownRenderer node={node} title={title} />
      : <PlainTextRenderer node={node} title={title} />;
  }

  // 根据节点类型选择渲染器
  switch (node.type) {
    case NodeType.JSON:
      return <InlineJsonRenderer node={node} title={title} />;

    case NodeType.ARRAY:
      return <InlineArrayRenderer node={node} title={title} />;

    case NodeType.PRIMITIVE:
    default:
      return <InlinePrimitiveRenderer node={node} title={title} />;
  }
};

const InlineNodeRenderer = React.memo(InlineNodeRendererInternal);
InlineNodeRenderer.displayName = 'InlineNodeRenderer';

export default InlineNodeRenderer;
