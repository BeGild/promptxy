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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Select, SelectItem, Button, Checkbox, Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { RegexGenerator, MatchMode, type RegexResult } from '@/utils/regexGenerator';

export interface MatchModeSelectorProps {
  /** 确认回调，返回选中的匹配模式、忽略大小写、多行选项和生成的正则结果 */
  onConfirm: (mode: MatchMode, ignoreCase: boolean, multiline: boolean, result: RegexResult) => void;
  /** 选中的文本内容（可选） */
  selectedText?: string;
  /** 是否支持"基于当前请求"选项 */
  supportBasedOnRequest?: boolean;
  /** 触发按钮的文本 */
  triggerLabel?: string;
}

/**
 * 匹配模式选择器组件
 * 使用下拉菜单形式，让用户选择匹配模式并预览生成的正则表达式
 */
export const MatchModeSelector: React.FC<MatchModeSelectorProps> = ({
  onConfirm,
  selectedText = '',
  supportBasedOnRequest = false,
  triggerLabel = '创建规则',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<MatchMode>(
    selectedText ? MatchMode.EXACT : MatchMode.BASED_ON_REQUEST
  );
  const [ignoreCase, setIgnoreCase] = useState(false);

  // 自动检测是否包含换行符，自动启用多行模式
  const hasNewline = selectedText.includes('\n');
  const [multiline, setMultiline] = useState(hasNewline);

  // 当选中文本改变时，自动更新多行状态
  useEffect(() => {
    setMultiline(selectedText.includes('\n'));
  }, [selectedText]);

  // 实时预览生成的正则表达式
  const previewResult = useMemo(() => {
    if (selectedMode === MatchMode.BASED_ON_REQUEST) {
      return {
        pattern: '',
        flags: '',
        display: '（基于当前请求的元数据创建规则）',
      };
    }
    if (!selectedText) {
      return {
        pattern: '',
        flags: '',
        display: '（请先选择文本）',
      };
    }
    return RegexGenerator.generateRegex(selectedText, selectedMode, ignoreCase, multiline);
  }, [selectedText, selectedMode, ignoreCase, multiline]);

  // 可用的匹配模式选项
  const matchModeOptions = useMemo(() => {
    const options = [
      { key: MatchMode.EXACT, label: '完整匹配', description: '如 "/^text$/"' },
      { key: MatchMode.PREFIX, label: '前缀匹配（整行）', description: '如 "/^prefix.*$/"' },
      { key: MatchMode.SUFFIX, label: '后缀匹配（整行）', description: '如 "/^.*suffix$/"' },
      { key: MatchMode.HEAD_TAIL, label: '头尾匹配', description: '如 "/^pre.*suf$/"' },
      { key: MatchMode.CONTAINS, label: '包含匹配', description: '如 "/text/"' },
      { key: MatchMode.WHOLE_WORD, label: '全词语匹配', description: '如 "\\bgpt-4\\b"' },
    ];
    if (supportBasedOnRequest) {
      options.push({
        key: MatchMode.BASED_ON_REQUEST,
        label: '基于当前请求',
        description: '使用请求元数据创建规则',
      });
    }
    return options;
  }, [supportBasedOnRequest]);

  // 检查是否可以确认
  const canConfirm = useMemo(() => {
    if (selectedMode === MatchMode.BASED_ON_REQUEST) {
      return true;
    }
    return selectedText.length > 0;
  }, [selectedText, selectedMode]);

  // 处理确认
  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm(selectedMode, ignoreCase, multiline, previewResult);
    setIsOpen(false);
    // 重置状态
    setSelectedMode(selectedText ? MatchMode.EXACT : MatchMode.BASED_ON_REQUEST);
    setIgnoreCase(false);
    setMultiline(false);
  }, [canConfirm, selectedMode, ignoreCase, multiline, previewResult, onConfirm, selectedText]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        label={triggerLabel}
        placeholder="选择匹配模式"
        selectedKeys={[selectedMode]}
        onSelectionChange={keys => {
          const mode = Array.from(keys)[0] as MatchMode;
          setSelectedMode(mode);
        }}
        classNames={{
          trigger: 'bg-canvas dark:bg-secondary',
          listbox: 'bg-canvas dark:bg-secondary',
          popoverContent: 'bg-canvas dark:bg-secondary',
        }}
        variant="bordered"
        size="sm"
      >
        {matchModeOptions.map(option => (
          <SelectItem key={option.key} textValue={option.label}>
            <div className="flex flex-col">
              <span className="text-small">{option.label}</span>
              <span className="text-tiny text-tertiary">{option.description}</span>
            </div>
          </SelectItem>
        ))}
      </Select>

      <Checkbox
        isSelected={ignoreCase}
        onValueChange={setIgnoreCase}
        classNames={{
          label: 'text-primary text-small',
        }}
        size="sm"
      >
        忽略大小写
      </Checkbox>

      <Checkbox
        isSelected={multiline}
        onValueChange={setMultiline}
        classNames={{
          label: 'text-primary text-small',
        }}
        size="sm"
      >
        多行(/m)
      </Checkbox>

      {/* 预览区域 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-tertiary">预览:</span>
        <span className="font-mono text-brand-primary truncate max-w-[200px]">
          {previewResult.display || '（无）'}
        </span>
      </div>

      <Button
        color="primary"
        size="sm"
        isDisabled={!canConfirm}
        onPress={handleConfirm}
      >
        确认
      </Button>
    </div>
  );
};
