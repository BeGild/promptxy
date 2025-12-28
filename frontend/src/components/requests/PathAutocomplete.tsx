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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Autocomplete, AutocompleteItem, Spinner } from '@heroui/react';
import { getPaths } from '@/api/requests';

interface PathAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  className?: string;
}

interface PathItem {
  key: string;
  value: string;
}

/**
 * 路径搜索自动补全组件
 * - 组件挂载时加载所有历史路径
 * - 用户输入时进行本地过滤
 * - 支持自定义值输入
 */
export const PathAutocomplete: React.FC<PathAutocompleteProps> = ({
  value,
  onChange,
  isLoading: externalLoading = false,
  className,
}) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 加载路径列表
  const loadPaths = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const data = await getPaths();
      setPaths(data);
      setLoaded(true);
    } catch (error) {
      console.error('加载路径列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  // 组件挂载时加载路径
  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  // 本地过滤逻辑
  const filteredPaths = useMemo((): PathItem[] => {
    if (!value) return paths.slice(0, 100).map(p => ({ key: p, value: p }));
    const lowerValue = value.toLowerCase();
    return paths
      .filter(path => path.toLowerCase().includes(lowerValue))
      .slice(0, 100)
      .map(p => ({ key: p, value: p }));
  }, [paths, value]);

  return (
    <Autocomplete
      labelPlacement="outside"
      placeholder="🔍 搜索路径或 ID..."
      value={value}
      onInputChange={(value: string) => onChange(value)}
      allowsCustomValue
      items={filteredPaths}
      inputProps={{
        classNames: {
          inputWrapper: 'shadow-sm bg-elevated dark:bg-elevated border border-subtle',
        },
      }}
      classNames={{
        listbox: 'max-h-[60vh]',
      }}
      isLoading={loading}
      endContent={externalLoading && !loading && <Spinner size="sm" color="primary" />}
      className={className}
    >
      {(item: PathItem) => <AutocompleteItem key={item.key}>{item.value}</AutocompleteItem>}
    </Autocomplete>
  );
};
