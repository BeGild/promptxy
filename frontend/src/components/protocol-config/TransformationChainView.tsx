/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="bg-gray-50 dark:bg-gray-950"
 *
 * ✅ REQUIRED:
 * - className="bg-canvas dark:bg-secondary"
 */

import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Divider,
} from '@heroui/react';
import { ArrowRight, Info, Eye, CheckCircle2, XCircle } from 'lucide-react';
import type { Supplier } from '@/types/api';

interface TransformTrace {
  supplierId: string;
  supplierName: string;
  chainType: string;
  chain: any[];
  steps: Array<{
    name: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  totalDuration: number;
  success: boolean;
  errors: string[];
  warnings: string[];
}

interface TransformationChainViewProps {
  supplier: Supplier | null;
}

export const TransformationChainView: React.FC<
  TransformationChainViewProps
> = ({ supplier }) => {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  if (!supplier) {
    return (
      <div className="text-center py-12 bg-canvas dark:bg-secondary/30 rounded-xl border border-dashed border-subtle">
        <Info size={48} className="mx-auto text-tertiary mb-3" />
        <p className="text-secondary font-medium">请先选择供应商</p>
        <p className="text-sm text-tertiary mt-1">
          选择供应商后可查看转换链配置
        </p>
      </div>
    );
  }

  const transformerChain = supplier.transformer?.default || [];
  const hasTransformer = transformerChain.length > 0;

  return (
    <>
      <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 shadow-sm">
        <CardBody className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Info size={20} className="text-brand-primary" />
            <h3 className="text-lg font-bold text-primary">转换链配置</h3>
          </div>

          <div className="p-4 rounded-lg bg-canvas dark:bg-secondary/50 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-secondary">供应商:</span>
              <span className="font-medium text-primary">{supplier.name}</span>
            </div>

            {hasTransformer ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-secondary">转换链:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip size="sm" variant="flat" color="primary">
                      {supplier.localPrefix}
                    </Chip>
                    <ArrowRight size={16} className="text-tertiary" />
                    {transformerChain.map((step, index) => (
                      <React.Fragment key={index}>
                        <Chip size="sm" variant="flat" color="primary">
                          {typeof step === 'string' ? step : step.name}
                        </Chip>
                        {index < transformerChain.length - 1 && (
                          <ArrowRight size={16} className="text-tertiary" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-secondary">说明:</span>
                  <span className="text-primary">
                    {transformerChain.length === 1 &&
                    transformerChain[0] === supplier.localPrefix
                      ? '使用原始协议，无需转换，直接转发'
                      : '需要经过协议转换，将请求转换为上游协议格式'}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-secondary">转换链:</span>
                <span className="text-tertiary">未配置转换器，使用原始协议</span>
              </div>
            )}
          </div>

          <Button
            color="primary"
            variant="flat"
            onPress={() => setIsDetailModalOpen(true)}
            startContent={<Eye size={16} />}
            className="w-full"
          >
            查看转换详情
          </Button>
        </CardBody>
      </Card>

      {/* 转换详情弹窗 */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        size="2xl"
        backdrop="blur"
        placement="center"
        scrollBehavior="outside"
        classNames={{
          base: 'border border-brand-primary/30 dark:border-brand-primary/20 bg-canvas dark:bg-secondary',
          backdrop: 'bg-overlay',
          header: 'bg-canvas dark:bg-secondary border-b border-subtle rounded-t-large',
          body: 'bg-canvas dark:bg-secondary',
          footer: 'bg-canvas dark:bg-secondary border-t border-subtle rounded-b-large',
        }}
      >
        <ModalContent>
          <ModalHeader>转换链详情</ModalHeader>
          <ModalBody className="space-y-4">
            <div className="p-4 rounded-lg bg-canvas dark:bg-secondary/50 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">供应商:</span>
                <span className="text-sm font-medium text-primary">
                  {supplier.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">上游地址:</span>
                <span className="text-sm text-secondary">{supplier.baseUrl}</span>
              </div>
            </div>

            <Divider />

            <div>
              <h4 className="text-sm font-medium text-primary mb-3">
                转换链配置
              </h4>
              {hasTransformer ? (
                <div className="space-y-3">
                  {transformerChain.map((step, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-canvas dark:bg-secondary/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-secondary">
                            步骤 {index + 1}
                          </span>
                          <Chip size="sm" color="primary" variant="flat">
                            {typeof step === 'string' ? step : step.name}
                          </Chip>
                        </div>
                        <CheckCircle2
                          size={16}
                          className="text-status-success"
                        />
                      </div>
                      <p className="text-xs text-secondary">
                        {typeof step === 'string'
                          ? `使用 ${step} 转换器`
                          : `使用 ${step.name} 转换器${
                              step.options
                                ? `，配置: ${JSON.stringify(step.options)}`
                                : ''
                            }`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-canvas dark:bg-secondary/50 text-center">
                  <p className="text-sm text-secondary">
                    未配置转换器，请求将直接转发
                  </p>
                </div>
              )}
            </div>

            <Divider />

            <div className="p-4 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/20">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <p className="text-xs text-secondary">
                  转换链决定了请求如何从客户端协议转换到上游供应商协议。
                  配置正确的转换链可以确保请求正确转发和响应正确解析。
                </p>
              </div>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};