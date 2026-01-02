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

import React from 'react';
import {
  Card,
  CardBody,
  Button,
  Switch,
  Badge,
  Spinner,
} from '@heroui/react';
import { Plus, Edit2, Trash2, Server, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier } from '@/types/api';

interface SupplierListProps {
  suppliers: Supplier[];
  isLoading: boolean;
  selectedToolPrefix: string;
  onAddSupplier: () => void;
  onEditSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplier: Supplier) => void;
  onToggleSupplier: (supplier: Supplier) => void;
}

export const SupplierList: React.FC<SupplierListProps> = ({
  suppliers,
  isLoading,
  selectedToolPrefix,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
  onToggleSupplier,
}) => {
  // 过滤出当前工具前缀对应的供应商
  const filteredSuppliers = suppliers.filter(
    s => s.localPrefix === selectedToolPrefix,
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner color="primary">加载供应商列表中...</Spinner>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Server size={20} className="text-brand-primary" />
          <h3 className="text-lg font-bold text-primary">供应商列表</h3>
          <Badge color="primary" variant="flat" size="sm">
            {filteredSuppliers.length}
          </Badge>
        </div>
        <Button
          color="primary"
          variant="flat"
          onPress={onAddSupplier}
          radius="lg"
          className="shadow-sm"
          startContent={<Plus size={18} />}
          size="sm"
        >
          添加供应商
        </Button>
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-canvas dark:bg-secondary/30 rounded-xl border border-dashed border-subtle">
          <Server size={48} className="mx-auto text-tertiary mb-3" />
          <p className="text-secondary font-medium">暂无 {selectedToolPrefix} 前缀的供应商配置</p>
          <Button
            color="primary"
            onPress={onAddSupplier}
            startContent={<Plus size={18} />}
            className="mt-3"
          >
            添加第一个供应商
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map(supplier => (
            <Card
              key={supplier.id}
              className={`relative overflow-hidden transition-all hover:shadow-md ${
                supplier.enabled
                  ? 'border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5'
                  : 'border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5 opacity-80 hover:opacity-100'
              }`}
              shadow="none"
            >
              <div
                aria-hidden="true"
                className={`absolute left-0 top-0 h-full w-1.5 ${
                  supplier.enabled ? 'bg-status-success' : 'bg-border-strong'
                }`}
              />
              <CardBody className="p-p4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{supplier.name}</span>
                      {supplier.enabled && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-secondary">
                        <span className="font-mono bg-canvas dark:bg-secondary/50 px-1.5 py-0.5 rounded text-primary">
                          {supplier.localPrefix}
                        </span>
                        <span className="text-tertiary">→</span>
                        <span
                          className="truncate max-w-[180px] text-secondary"
                          title={supplier.baseUrl}
                        >
                          {supplier.baseUrl}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-end">
                      <Switch
                        size="sm"
                        isSelected={supplier.enabled}
                        onValueChange={() => onToggleSupplier(supplier)}
                        classNames={{
                          wrapper: 'group-data-[selected=true]:bg-success',
                        }}
                      />
                    </div>
                    <div className="flex gap-1 justify-end">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => onEditSupplier(supplier)}
                        className="text-secondary hover:text-brand-primary"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        color="danger"
                        variant="light"
                        onPress={() => onDeleteSupplier(supplier)}
                        className="text-tertiary hover:text-status-error"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};