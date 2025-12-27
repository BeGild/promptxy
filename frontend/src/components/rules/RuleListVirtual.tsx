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

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  CSSProperties,
  ReactElement,
} from 'react';
import { Input, Button, Spinner, Chip, Select, SelectItem } from '@heroui/react';
import { List, ListImperativeAPI } from 'react-window';
import { RuleCard } from './RuleCard';
import { EmptyState } from '@/components/common';
import { PromptxyRule } from '@/types';

interface RuleListVirtualProps {
  rules: PromptxyRule[];
  isLoading: boolean;
  onEdit: (ruleId: string) => void;
  onCopy: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
  onNewRule: () => void;
}

// Custom props for the row component
interface RuleRowCustomProps {
  rules: PromptxyRule[];
  onEdit: (ruleId: string) => void;
  onCopy: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
  isScrolling: boolean;
}

/**
 * 虚拟规则列表项渲染器
 */
const VirtualRuleRow = (props: {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: CSSProperties;
  rules: PromptxyRule[];
  onEdit: (ruleId: string) => void;
  onCopy: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
  isScrolling?: boolean;
}): React.ReactElement => {
  const { index, style, rules, onEdit, onCopy, onDelete, onToggle, isScrolling } = props;
  const rule = rules[index];

  if (!rule) {
    return <div style={style} className="px-2 py-1" />;
  }

  // 快速滚动时的简化渲染
  if (isScrolling) {
    return (
      <div style={style} className="px-2 py-1">
        <div className="h-full bg-canvas dark:bg-secondary rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div style={style} className="px-2 py-1">
      <RuleCard rule={rule} onEdit={onEdit} onCopy={onCopy} onDelete={onDelete} onToggle={onToggle} />
    </div>
  );
};

/**
 * RuleListVirtual - 虚拟滚动优化的规则列表组件
 * 支持动态高度和搜索过滤
 */
const RuleListVirtualComponent: React.FC<RuleListVirtualProps> = ({
  rules,
  isLoading,
  onEdit,
  onCopy,
  onDelete,
  onToggle,
  onNewRule,
}) => {
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<ListImperativeAPI | null>(null);

  // 过滤逻辑
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchSearch =
        rule.name.toLowerCase().includes(search.toLowerCase()) ||
        (rule.description || '').toLowerCase().includes(search.toLowerCase());
      const matchClient = filterClient === 'all' || rule.when.client === filterClient;
      return matchSearch && matchClient;
    });
  }, [rules, search, filterClient]);

  // 滚动到顶部 - 需要先定义，因为其他函数会使用它
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToRow({ index: 0, align: 'start' });
    }
    setIsScrolling(false);
  }, []);

  // 滚动处理
  const handleScroll = useCallback(
    (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _visibleRows: { startIndex: number; stopIndex: number },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _allRows: { startIndex: number; stopIndex: number },
    ) => {
      // 当可见行范围变化时，我们假设用户正在滚动
      setIsScrolling(true);

      // 清除之前的定时器
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      // 设置新的防抖定时器
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 100);
    },
    [],
  );

  // 事件处理函数
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      scrollToTop();
    },
    [scrollToTop],
  );

  const handleClientChange = useCallback(
    (value: string) => {
      setFilterClient(value);
      scrollToTop();
    },
    [scrollToTop],
  );

  const handleClearSearch = useCallback(() => {
    setSearch('');
    scrollToTop();
  }, [scrollToTop]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  // 渲染头部工具栏
  const renderHeader = () => (
    <>
      {/* 搜索和过滤工具栏 */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <Input
          placeholder="🔍 搜索规则名称或描述..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="flex-1"
          radius="lg"
          classNames={{
            inputWrapper:
              'shadow-sm bg-elevated dark:bg-elevated border border-subtle',
          }}
        />

        <Select
          selectedKeys={[filterClient]}
          onChange={e => handleClientChange(e.target.value)}
          className="w-full md:w-48"
          radius="lg"
          classNames={{
            trigger:
              'shadow-sm bg-elevated dark:bg-elevated border border-subtle',
          }}
        >
          <SelectItem key="all">所有客户端</SelectItem>
          <SelectItem key="claude">Claude</SelectItem>
          <SelectItem key="codex">Codex</SelectItem>
          <SelectItem key="gemini">Gemini</SelectItem>
        </Select>

        <Button
          color="primary"
          onPress={onNewRule}
          className="shadow-md hover:shadow-lg transition-shadow"
          radius="lg"
        >
          + 新建规则
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>搜索结果:</span>
        <Chip color="primary" variant="flat" size="sm">
          {filteredRules.length} 条
        </Chip>
        {search && (
          <Button size="sm" variant="light" onPress={handleClearSearch} className="h-6 px-2">
            清除搜索
          </Button>
        )}
        {isScrolling && <span className="text-xs text-tertiary ml-auto">滚动中...</span>}
      </div>
    </>
  );

  // 渲染虚拟列表
  const renderVirtualList = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Spinner color="primary">加载规则中...</Spinner>
        </div>
      );
    }

    if (rules.length === 0) {
      return (
        <EmptyState
          title="暂无规则"
          description="创建你的第一条规则来开始修改请求"
          actionText="新建规则"
          onAction={onNewRule}
        />
      );
    }

    if (filteredRules.length === 0) {
      return (
        <div className="text-center py-12 text-secondary">
          <p>没有找到匹配的规则</p>
          <Button size="sm" variant="light" onPress={handleClearSearch} className="mt-mt2">
            清除搜索
          </Button>
        </div>
      );
    }

    // 计算容器高度和宽度
    const containerHeight = Math.min(600, Math.max(300, window.innerHeight - 300));
    const containerWidth =
      typeof window !== 'undefined' ? Math.min(window.innerWidth - 64, 1200) : 800;

    // Row component for the List API
    const RowComponent = (
      props: {
        ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
        index: number;
        style: CSSProperties;
      } & RuleRowCustomProps,
    ): ReactElement => {
      const { index, style, rules, onEdit, onCopy, onDelete, onToggle, isScrolling, ariaAttributes } =
        props;
      return (
        <VirtualRuleRow
          ariaAttributes={ariaAttributes}
          index={index}
          style={style}
          rules={rules}
          onEdit={onEdit}
          onCopy={onCopy}
          onDelete={onDelete}
          onToggle={onToggle}
          isScrolling={isScrolling}
        />
      );
    };

    return (
      <div className="border border-subtle rounded-xl overflow-hidden shadow-md bg-elevated">
        <div style={{ height: containerHeight }}>
          <List
            listRef={listRef}
            rowCount={filteredRules.length}
            rowHeight={(index: number) => {
              // 根据规则内容估算高度
              const rule = filteredRules[index];
              if (!rule) return 180;

              let height = 180; // 基础高度
              if (rule.description) height += 30;
              if (rule.when.pathRegex || rule.when.modelRegex) height += 40;
              if (rule.ops.length > 2) height += 20;

              return Math.min(280, Math.max(140, height));
            }}
            overscanCount={3}
            onRowsRendered={handleScroll}
            rowComponent={RowComponent}
            rowProps={
              {
                rules: filteredRules,
                onEdit,
                onCopy,
                onDelete,
                onToggle,
                isScrolling: isScrolling || false,
              } as RuleRowCustomProps
            }
            style={{ height: containerHeight, width: containerWidth }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-md">
      {renderHeader()}
      {renderVirtualList()}
    </div>
  );
};

/**
 * 优化的虚拟滚动 RuleList 组件，使用 React.memo 包裹
 */
export const RuleListVirtual = React.memo(RuleListVirtualComponent);
