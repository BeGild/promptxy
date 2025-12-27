/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="text-gray-500 dark:text-gray-400"
 * - className="bg-blue-50/50 dark:bg-blue-900/20"
 *
 * ✅ REQUIRED:
 * - className="text-secondary"
 * - className="bg-brand-primary/10 dark:bg-brand-primary/20"
 */

import React, { useState, useMemo, useEffect } from 'react';
import type { RequestMetadata, ViewNode, ViewGroup, RequestAdapter } from '../types';
import { RenderMode } from '../types';
import { AdapterRegistry } from '../adapters/Registry';
import { ClaudeMessagesAdapter } from '../adapters/claude/ClaudeMessagesAdapter';
import SummaryView from './views/SummaryView';
import FileBrowserView from './views/FileBrowserView';
import DiffView from './views/DiffView';

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
}

/**
 * 请求详情面板主组件
 * 自动检测适配器，支持三种视图模式
 */
const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({
  request,
  originalRequest,
  adapter: providedAdapter,
  responseStatus,
  responseDuration,
}) => {
  const [viewMode, setViewMode] = useState<RenderMode>(RenderMode.FULL);
  const [adapter, setAdapter] = useState<RequestAdapter | undefined>(providedAdapter);
  const [viewTree, setViewTree] = useState<ViewNode | undefined>();
  const [originalTree, setOriginalTree] = useState<ViewNode | undefined>();
  const [metadata, setMetadata] = useState<RequestMetadata | undefined>();
  const [groups, setGroups] = useState<ViewGroup[]>([]);

  // 初始化适配器注册表
  useEffect(() => {
    if (providedAdapter) {
      setAdapter(providedAdapter);
      return;
    }

    // 注册默认适配器
    AdapterRegistry.register(new ClaudeMessagesAdapter());

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

      // 获取视图分组
      if (adapter.getGroups) {
        const grps = adapter.getGroups(tree);
        setGroups(grps);
      }
    } catch (error) {
      console.error('Failed to build view tree:', error);
    }
  }, [adapter, request, originalRequest, responseStatus, responseDuration]);

  if (!adapter || !viewTree) {
    return (
      <div className="p-4 text-center text-secondary">
        正在加载请求详情...
      </div>
    );
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
                <span className={`font-medium ${
                  metadata.responseStatus >= 200 && metadata.responseStatus < 300
                    ? 'text-status-success'
                    : 'text-status-error'
                }`}>
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

      {/* 视图模式切换 */}
      <div className="px-4 py-2 border-b border-brand-primary/30 dark:border-brand-primary/20 flex items-center gap-2">
        {[
          { mode: RenderMode.SUMMARY, label: '结构概览' },
          { mode: RenderMode.FULL, label: '内容详情' },
          { mode: RenderMode.DIFF, label: '差异对比' },
        ].map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              viewMode === mode
                ? 'bg-brand-primary text-white'
                : 'bg-brand-primary/10 dark:bg-brand-primary/20 text-primary hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30'
            }`}
            disabled={mode === RenderMode.DIFF && !originalRequest}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 视图内容 */}
      <div className="flex-1 overflow-hidden">
        {viewMode === RenderMode.SUMMARY && groups.length > 0 && (
          <div className="h-full overflow-auto p-4">
            <SummaryView viewTree={viewTree} groups={groups} />
          </div>
        )}
        {viewMode === RenderMode.FULL && (
          <FileBrowserView viewTree={viewTree} />
        )}
        {viewMode === RenderMode.DIFF && (
          <div className="h-full overflow-auto p-4">
            {originalTree ? (
              <DiffView originalTree={originalTree} modifiedTree={viewTree} />
            ) : (
              <div className="text-center text-secondary py-8">
                无原始请求，无法显示差异对比
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetailPanel;
