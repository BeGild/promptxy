/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007aff, #f5f5f7）
 * - 硬编码尺寸值（如 400px, 16px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React, { useState } from 'react';
import { Card, CardBody, CardHeader, Chip, Spinner, Divider, Tabs, Tab, Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { RequestRecord } from '@/types';
import { useUIStore } from '@/store';
import {
  formatTimeWithMs,
  formatDuration,
  getStatusColor,
  formatClient,
  formatSize,
} from '@/utils';
import { RequestDetailPanel } from '@/components/request-viewer';
import { MatchMode, type RegexResult } from '@/utils/regexGenerator';
import { Server, ArrowRight, Eye, CheckCircle2 } from 'lucide-react';

interface RequestDetailInSidebarProps {
  request: RequestRecord | null;
  isLoading: boolean;
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

export const RequestDetailInSidebar: React.FC<RequestDetailInSidebarProps> = ({
  request,
  isLoading,
  onSelectionBasedCreate,
  onBasedOnRequestCreate,
}) => {
  const { setActiveTab } = useUIStore();
  const [isTransformDetailOpen, setIsTransformDetailOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner color="primary" size="sm">
          加载详情中...
        </Spinner>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-sm font-medium text-secondary">未找到请求详情</div>
      </div>
    );
  }

  // 解析转换链
  const transformerChain = request.transformerChain || [];
  const hasRouteInfo = request.supplierId || request.supplierName || transformerChain.length > 0;

  return (
    <div className="space-y-3">
      {/* 基本信息 - 极简单行布局 */}
      <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
        <CardBody className="px-3 py-2">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* ID - 完整显示 */}
            <span className="text-tertiary font-mono text-xs" title={request.id}>
              {request.id}
            </span>
            <span className="text-tertiary">·</span>
            {/* 时间 */}
            <span className="text-tertiary whitespace-nowrap">
              {formatTimeWithMs(request.timestamp)}
            </span>
            <span className="text-tertiary">·</span>
            {/* 客户端 */}
            <span className="text-secondary font-medium">{formatClient(request.client)}</span>
            <span className="text-tertiary">·</span>
            {/* 方法 */}
            <span className="text-tertiary uppercase font-medium">{request.method}</span>
            <span className="text-tertiary">·</span>
            {/* 状态 */}
            <Chip
              size="sm"
              color={getStatusColor(request.responseStatus)}
              variant="flat"
              className="h-5 min-h-5 min-w-0"
              classNames={{
                base: 'min-w-0 inline-flex items-center',
                content: 'px-2 py-0.5 min-w-0 inline-flex',
              }}
            >
              {request.responseStatus || 'N/A'}
            </Chip>
            <span className="text-tertiary">·</span>
            {/* 耗时 */}
            {request.durationMs && (
              <>
                <span className="text-tertiary">{formatDuration(request.durationMs)}</span>
                <span className="text-tertiary">·</span>
              </>
            )}
            {/* 请求体大小 */}
            {request.requestSize && (
              <>
                <span className="text-tertiary">{formatSize(request.requestSize)}</span>
                <span className="text-tertiary">·</span>
              </>
            )}
            {/* 路径 */}
            <span className="font-mono text-secondary truncate flex-1 min-w-0">{request.path}</span>
          </div>
        </CardBody>
      </Card>

      {/* 路由信息 - 新增 */}
      {hasRouteInfo && (
        <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
          <CardBody className="px-3 py-2 space-y-2">
            {/* 供应商信息 */}
            {request.supplierName && (
              <div className="flex items-center gap-2 text-xs">
                <Server size={14} className="text-brand-primary" />
                <span className="text-tertiary">供应商:</span>
                <span className="text-secondary font-medium">{request.supplierName}</span>
              </div>
            )}

            {/* 转换链信息 */}
            {transformerChain.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-tertiary">转换链:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {transformerChain.map((step, index) => (
                    <React.Fragment key={index}>
                      <Chip size="sm" variant="flat" color="primary" className="h-5 min-h-5">
                        {step}
                      </Chip>
                      {index < transformerChain.length - 1 && (
                        <ArrowRight size={12} className="text-tertiary" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => setIsTransformDetailOpen(true)}
                  startContent={<Eye size={14} />}
                  className="h-5 min-h-5 px-2 min-w-0 text-xs"
                >
                  详情
                </Button>
              </div>
            )}

            {/* 跳转到配置 */}
            {request.supplierId && (
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => setActiveTab('route-config')}
                className="text-xs h-6"
              >
                跳转到配置
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* 转换详情弹窗 */}
      <Modal
        isOpen={isTransformDetailOpen}
        onClose={() => setIsTransformDetailOpen(false)}
        size="2xl"
        backdrop="blur"
        placement="center"
        classNames={{
          base: 'border border-brand-primary/30 dark:border-brand-primary/20 bg-canvas dark:bg-secondary',
          backdrop: 'bg-overlay',
          header: 'bg-canvas dark:bg-secondary border-b border-subtle rounded-t-large',
          body: 'bg-canvas dark:bg-secondary',
          footer: 'bg-canvas dark:bg-secondary border-t border-subtle rounded-b-large',
        }}
      >
        <ModalContent>
          <ModalHeader>转换详情</ModalHeader>
          <ModalBody className="space-y-4">
            {request.supplierName && (
              <div className="p-3 rounded-lg bg-canvas dark:bg-secondary/50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-secondary">供应商:</span>
                  <span className="text-sm font-medium text-primary">
                    {request.supplierName}
                  </span>
                </div>
              </div>
            )}

            {transformerChain.length > 0 && (
              <>
                <div className="p-3 rounded-lg bg-canvas dark:bg-secondary/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-secondary">转换链:</span>
                  </div>
                  <div className="space-y-2">
                    {transformerChain.map((step, index) => (
                      <div key={index} className="p-3 rounded-lg bg-canvas dark:bg-secondary/50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-secondary">
                              步骤 {index + 1}
                            </span>
                            <Chip size="sm" color="primary" variant="flat">
                              {step}
                            </Chip>
                          </div>
                          <CheckCircle2 size={16} className="text-status-success" />
                        </div>
                        <p className="text-xs text-secondary">
                          使用 {step} 转换器
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 匹配规则 - 紧凑单行 */}
      {request.matchedRules && request.matchedRules.length > 0 && (
        <Card className="rounded-lg overflow-hidden border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/5 dark:from-elevated dark:to-brand-primary/10">
          <CardBody className="px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-tertiary font-medium">匹配:</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {request.matchedRules.map((match, i) => (
                  <React.Fragment key={i}>
                    <span className="text-xs text-secondary font-mono">{match.ruleId}</span>
                    <Chip
                      size="sm"
                      color="warning"
                      variant="flat"
                      className="h-5 min-h-5 text-xs uppercase px-2 min-w-0"
                      classNames={{
                        base: 'min-w-0 inline-flex items-center',
                        content: 'px-2 py-0.5 min-w-0 inline-flex',
                      }}
                    >
                      {match.opType}
                    </Chip>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 请求详情 */}
      <div
        className="border border-subtle rounded-lg overflow-hidden"
        style={{ height: 'calc(100vh - 260px)' }}
      >
        <RequestDetailPanel
          request={request.modifiedBody}
          originalRequest={request.originalBody}
          responseStatus={request.responseStatus}
          responseDuration={request.durationMs}
          onSelectionBasedCreate={onSelectionBasedCreate}
          onBasedOnRequestCreate={onBasedOnRequestCreate}
        />
      </div>
    </div>
  );
};
