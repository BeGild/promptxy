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

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Divider,
} from '@heroui/react';
import { toast } from 'sonner';
import {
  COMMON_PREFIX_OPTIONS,
  getPrefixColor,
} from '@/hooks';
import type { Supplier, CommonPrefixOption } from '@/types/api';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
  defaultPrefix?: string;
  onSave: (supplier: Omit<Supplier, 'id'>) => Promise<void>;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  supplier,
  defaultPrefix = '/claude',
  onSave,
}) => {
  const isEditing = !!supplier;

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [localPrefix, setLocalPrefix] = useState(defaultPrefix);
  const [enabled, setEnabled] = useState(true);
  const [selectedPrefixOption, setSelectedPrefixOption] = useState<string>(
    defaultPrefix,
  );
  const [isSaving, setIsSaving] = useState(false);

  // URL 验证
  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // 初始化表单
  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setBaseUrl(supplier.baseUrl);
      setEnabled(supplier.enabled);
      // 新的 Supplier 类型不再有 localPrefix 属性
      // setLocalPrefix(supplier.localPrefix);
      // setSelectedPrefixOption(supplier.localPrefix);
    } else {
      setName('');
      setBaseUrl('');
      setEnabled(true);
      // setLocalPrefix(defaultPrefix);
      // setSelectedPrefixOption(defaultPrefix);
    }
  }, [supplier, isOpen, defaultPrefix]);

  // 选择常用前缀
  const handleSelectPrefix = (prefix: string) => {
    const option = COMMON_PREFIX_OPTIONS.find(opt => opt.prefix === prefix);
    if (option) {
      setLocalPrefix(prefix);
      setSelectedPrefixOption(prefix);
    }
  };

  // 保存供应商
  const handleSave = async () => {
    if (!name || !baseUrl) {
      toast.error('请填写所有必填字段');
      return;
    }

    if (!isValidUrl(baseUrl)) {
      toast.error('API 地址格式无效，请使用 http:// 或 https:// 开头的地址');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name,
        displayName: name, // 使用 name 作为 displayName
        baseUrl,
        enabled,
        protocol: 'anthropic', // 默认值，实际应该从表单获取
        supportedModels: [],
      });
      onClose();
      toast.success(isEditing ? '供应商已更新！' : '供应商已创建！');
    } catch (error: any) {
      toast.error(
        `${isEditing ? '更新' : '创建'}失败: ${error?.message || '未知错误'}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-xl font-bold">
            {isEditing ? '编辑供应商' : '添加供应商'}
          </span>
          <span className="text-sm font-normal text-secondary">
            {isEditing ? '修改供应商配置' : '配置新的上游 LLM 服务提供商'}
          </span>
        </ModalHeader>
        <ModalBody className="space-y-md">
          <Input
            label="名称"
            placeholder="例如：Claude Official"
            value={name}
            onValueChange={setName}
            isRequired
            radius="lg"
            variant="bordered"
            labelPlacement="outside"
          />

          <div className="space-y-sm">
            <label className="text-sm font-medium">本地路径前缀</label>
            <div className="flex gap-2">
              <Select
                placeholder="选择常用前缀"
                selectedKeys={[selectedPrefixOption]}
                onSelectionChange={keys => {
                  const key = Array.from(keys)[0] as string;
                  if (key !== 'custom') {
                    handleSelectPrefix(key);
                  } else {
                    setSelectedPrefixOption('custom');
                  }
                }}
                radius="lg"
                variant="bordered"
                className="w-1/3"
              >
                <>
                  {COMMON_PREFIX_OPTIONS.map(option => (
                    <SelectItem key={option.prefix} textValue={option.label}>
                      <div className="flex items-center gap-2">
                        <span>{option.color}</span>
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem key="custom" textValue="自定义">
                    🆕 自定义...
                  </SelectItem>
                </>
              </Select>

              <Input
                placeholder="/custom"
                value={localPrefix}
                onValueChange={setLocalPrefix}
                isRequired
                radius="lg"
                variant="bordered"
                className="flex-1"
                startContent={
                  <span className="text-tertiary">
                    {selectedPrefixOption !== 'custom'
                      ? getPrefixColor(localPrefix)
                      : '🔹'}
                  </span>
                }
              />
            </div>
          </div>

          <Input
            label="上游地址"
            placeholder="https://api.example.com"
            value={baseUrl}
            onValueChange={setBaseUrl}
            isRequired
            radius="lg"
            variant="bordered"
            labelPlacement="outside"
            description="目标 API 服务的根地址"
          />

          <Divider />

          <div className="flex items-center gap-2 p-3 bg-canvas dark:bg-secondary rounded-lg">
            <Switch
              isSelected={enabled}
              onValueChange={setEnabled}
              size="sm"
            >
              <span className="text-sm font-medium">
                {isEditing ? '启用此供应商' : '立即启用此供应商'}
              </span>
            </Switch>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            取消
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={isSaving}
            className="shadow-md"
          >
            {isSaving ? '保存中...' : isEditing ? '保存更改' : '创建供应商'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
