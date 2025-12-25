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
          inputWrapper: 'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
        },
      }}
      classNames={{
        listbox: 'max-h-[60vh]',
      }}
      isLoading={loading}
      endContent={externalLoading && !loading && <Spinner size="sm" color="primary" />}
      className={className}
    >
      {(item: PathItem) => (
        <AutocompleteItem key={item.key}>
          {item.value}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
};
