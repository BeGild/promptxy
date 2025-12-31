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

import React, { useState, useEffect } from 'react';
import type { RequestMetadata, ViewNode, RequestAdapter } from '../types';
import { AdapterRegistry } from '../adapters/Registry';
import { ClaudeMessagesAdapter } from '../adapters/claude/ClaudeMessagesAdapter';
import { CodexAdapter } from '../adapters/codex/CodexAdapter';
import { GeminiAdapter } from '../adapters/gemini/GeminiAdapter';
import UnifiedContentView from './views/UnifiedContentView';
import { MatchMode, type RegexResult } from '@/utils/regexGenerator';

interface RequestDetailPanelProps {
  /** 修改后的请求对象 */
  request: any;
  /** 原始请求对象（用于 diff） */
  originalRequest?: any;
  /** 显式指定的适配器（可选） */
  adapter?: RequestAdapter;
  /** 响应状态 */
  responseStatus?: number;
  /** 响应耗时（毫秒） */
  responseDuration?: number;
  /** 基于选中内容创建规则的回调 */
  onSelectionBasedCreate?: (
    selectedText: string,
    mode: MatchMode,
    ignoreCase: boolean,
    multiline: boolean,
    result: RegexResult,
  ) => void;
  /** 基于当前请求创建规则的回调 */
  onBasedOnRequestCreate?: () => void;
}

/**
 * 请求详情面板主组件
 * 自动检测适配器，展示统一内容视图（支持内容详情和差异对比）
 */
const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({
  request,
  originalRequest,
  adapter: providedAdapter,
  responseStatus,
  responseDuration,
  onSelectionBasedCreate,
  onBasedOnRequestCreate,
}) => {
  const [adapter, setAdapter] = useState<RequestAdapter | undefined>(providedAdapter);
  const [viewTree, setViewTree] = useState<ViewNode | undefined>();
  const [originalTree, setOriginalTree] = useState<ViewNode | undefined>();
  const [metadata, setMetadata] = useState<RequestMetadata | undefined>();

  // 初始化适配器注册表
  useEffect(() => {
    if (providedAdapter) {
      setAdapter(providedAdapter);
      return;
    }

    // 注册默认适配器
    AdapterRegistry.register(new ClaudeMessagesAdapter());
    AdapterRegistry.register(new CodexAdapter());
    AdapterRegistry.register(new GeminiAdapter());

    // 自动检测适配器
    const detected = AdapterRegistry.findAdapter(request);
    if (detected) {
      setAdapter(detected);
    } else {
      console.warn('No adapter found for request:', request);
    }
  }, [request, providedAdapter]);

  // 构建视图树
  useEffect(() => {
    if (!adapter) return;

    try {
      const tree = adapter.buildViewTree(request, originalRequest);
      setViewTree(tree);

      if (originalRequest) {
        const origTree = adapter.buildViewTree(originalRequest);
        setOriginalTree(origTree);
      }

      // 提取元数据
      const meta = adapter.extractMetadata(request);
      setMetadata({
        ...meta,
        responseStatus,
        responseDuration,
      });
    } catch (error) {
      console.error('Failed to build view tree:', error);
    }
  }, [adapter, request, originalRequest, responseStatus, responseDuration]);

  if (!adapter || !viewTree) {
    return <div className="p-4 text-center text-secondary">正在加载请求详情...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
      {/* 元数据栏 */}
      {metadata && (
        <div className="px-4 py-3 border-b border-brand-primary/30 dark:border-brand-primary/20 bg-brand-primary/10 dark:bg-brand-primary/20">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {metadata.model && (
              <div className="flex items-center gap-1">
                <span className="text-secondary">Model:</span>
                <span className="font-medium text-primary">{metadata.model}</span>
              </div>
            )}
            {metadata.messageCount !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-secondary">Messages:</span>
                <span className="font-medium text-primary">{metadata.messageCount}</span>
              </div>
            )}
            {metadata.systemPromptLength !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-secondary">System:</span>
                <span className="font-medium text-primary">
                  {(metadata.systemPromptLength / 1000).toFixed(1)}k 字符
                </span>
              </div>
            )}
            {metadata.toolCount !== undefined && metadata.toolCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-secondary">Tools:</span>
                <span className="font-medium text-primary">{metadata.toolCount}</span>
              </div>
            )}
            {metadata.responseStatus && (
              <div className="flex items-center gap-1">
                <span className="text-secondary">Status:</span>
                <span
                  className={`font-medium ${
                    metadata.responseStatus >= 200 && metadata.responseStatus < 300
                      ? 'text-status-success'
                      : 'text-status-error'
                  }`}
                >
                  {metadata.responseStatus}
                </span>
              </div>
            )}
            {metadata.responseDuration && (
              <div className="flex items-center gap-1">
                <span className="text-secondary">耗时:</span>
                <span className="font-medium text-primary">
                  {(metadata.responseDuration / 1000).toFixed(2)}s
                </span>
              </div>
            )}
            <div className="ml-auto text-xs text-tertiary">
              {adapter.name} v{adapter.version}
            </div>
          </div>
        </div>
      )}

      {/* 统一内容视图 */}
      <UnifiedContentView
        viewTree={viewTree}
        originalTree={originalTree}
        onSelectionBasedCreate={onSelectionBasedCreate}
        onBasedOnRequestCreate={onBasedOnRequestCreate}
      />
    </div>
  );
};

export default RequestDetailPanel;
