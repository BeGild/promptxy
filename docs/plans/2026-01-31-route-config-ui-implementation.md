# 路由配置界面重新设计实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重新设计路由配置页面，使用卡片式流量可视化展示入站→出站的完整路径，让协议转换关系一目了然。

**Architecture:** 将现有列表式布局改为卡片式布局，每个路由显示为独立的流量卡片，左侧入站端点、中间流向箭头、右侧出站配置。复用现有颜色和图标系统保持一致性。

**Tech Stack:** React + TypeScript + HeroUI + Tailwind CSS

---

## Task 1: 创建 InboundEndpoint 组件

**Files:**
- Create: `frontend/src/components/routes/InboundEndpoint.tsx`
- Modify: `frontend/src/components/routes/index.ts` (导出)

**Step 1: 编写组件代码**

创建入站端点显示组件，展示本地服务图标、名称和路径。

```tsx
// frontend/src/components/routes/InboundEndpoint.tsx
import React from 'react';
import { AnthropicIcon, CodexIcon, GeminiIcon } from '@/components/icons/SupplierIcons';
import type { LocalService } from '@/types/api';

interface LocalServiceConfig {
  key: LocalService;
  label: string;
  prefix: string;
  protocol: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const LOCAL_SERVICES: LocalServiceConfig[] = [
  {
    key: 'claude',
    label: 'Claude',
    prefix: '/claude',
    protocol: 'anthropic',
    color: '#D4935D',
    icon: AnthropicIcon,
  },
  {
    key: 'codex',
    label: 'Codex',
    prefix: '/codex',
    protocol: 'openai-codex',
    color: '#2D3748',
    icon: CodexIcon,
  },
  {
    key: 'gemini',
    label: 'Gemini',
    prefix: '/gemini',
    protocol: 'gemini',
    color: '#4285F4',
    icon: GeminiIcon,
  },
];

interface InboundEndpointProps {
  localService: LocalService;
}

export const InboundEndpoint: React.FC<InboundEndpointProps> = ({ localService }) => {
  const config = LOCAL_SERVICES.find(s => s.key === localService);
  if (!config) return null;

  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <IconComponent size={24} style={{ color: config.color }} />
      </div>
      <div>
        <div className="font-semibold text-primary">{config.label}</div>
        <div className="text-xs text-tertiary font-mono">{config.prefix}</div>
        <div className="text-xs text-tertiary opacity-70">{config.protocol}</div>
      </div>
    </div>
  );
};
```

**Step 2: 添加到导出**

```tsx
// frontend/src/components/routes/index.ts
export { InboundEndpoint } from './InboundEndpoint';
```

**Step 3: Commit**

```bash
git add frontend/src/components/routes/
git commit -m "feat: 创建 InboundEndpoint 组件显示入站端点信息"
```

---

## Task 2: 创建 FlowArrow 组件

**Files:**
- Create: `frontend/src/components/routes/FlowArrow.tsx`
- Modify: `frontend/src/components/routes/index.ts`

**Step 1: 编写组件代码**

创建流向箭头组件，支持协议转换时的渐变效果。

```tsx
// frontend/src/components/routes/FlowArrow.tsx
import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { LocalService } from '@/types/api';
import type { Supplier } from '@/types/api';

interface LocalServiceConfig {
  key: LocalService;
  color: string;
}

const LOCAL_SERVICE_COLORS: LocalServiceConfig[] = [
  { key: 'claude', color: '#D4935D' },
  { key: 'codex', color: '#2D3748' },
  { key: 'gemini', color: '#4285F4' },
];

interface FlowArrowProps {
  localService: LocalService;
  targetSupplier?: Supplier;
  showProtocolConversion?: boolean;
}

export const FlowArrow: React.FC<FlowArrowProps> = ({
  localService,
  targetSupplier,
  showProtocolConversion = false,
}) => {
  const localConfig = LOCAL_SERVICE_COLORS.find(s => s.key === localService);
  const inboundColor = localConfig?.color || '#888';

  // 供应商品牌色映射
  const supplierColors: Record<string, string> = {
    'anthropic': '#D4935D',
    'openai-codex': '#2D3748',
    'openai-chat': '#10A37F',
    'gemini': '#4285F4',
  };

  const outboundColor = targetSupplier
    ? supplierColors[targetSupplier.protocol] || '#888'
    : '#888';

  const hasConversion = showProtocolConversion && targetSupplier &&
    localService !== targetSupplier.protocol.replace('openai-', '').replace('-chat', '').replace('-codex', '');

  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <div
        className="flex items-center justify-center w-8 h-8 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${inboundColor}30, ${outboundColor}30)`,
        }}
      >
        <ArrowRight
          size={18}
          style={{
            color: hasConversion ? outboundColor : '#888',
          }}
        />
      </div>
      {hasConversion && (
        <span className="text-[10px] text-tertiary opacity-70">转换</span>
      )}
    </div>
  );
};
```

**Step 2: 添加到导出**

```tsx
// frontend/src/components/routes/index.ts
export { FlowArrow } from './FlowArrow';
```

**Step 3: Commit**

```bash
git add frontend/src/components/routes/
git commit -m "feat: 创建 FlowArrow 组件显示流量流向和协议转换"
```

---

## Task 3: 创建 OutboundConfig 组件

**Files:**
- Create: `frontend/src/components/routes/OutboundConfig.tsx`
- Modify: `frontend/src/components/routes/index.ts`

**Step 1: 编写组件代码**

创建出站配置组件，支持单供应商显示和模型映射规则列表。

```tsx
// frontend/src/components/routes/OutboundConfig.tsx
import React from 'react';
import { Chip } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { AnthropicIcon, OpenAIIcon, GeminiIcon, CodexIcon } from '@/components/icons/SupplierIcons';
import type { Supplier, ModelMappingRule } from '@/types/api';

const SUPPLIER_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'anthropic': AnthropicIcon,
  'openai-codex': CodexIcon,
  'openai-chat': OpenAIIcon,
  'gemini': GeminiIcon,
};

const SUPPLIER_COLORS: Record<string, string> = {
  'anthropic': '#D4935D',
  'openai-codex': '#2D3748',
  'openai-chat': '#10A37F',
  'gemini': '#4285F4',
};

interface OutboundConfigProps {
  suppliers: Supplier[];
  singleSupplierId?: string;
  modelMappings?: ModelMappingRule[];
}

interface SingleSupplierProps {
  supplier: Supplier;
}

const SingleSupplier: React.FC<SingleSupplierProps> = ({ supplier }) => {
  const IconComponent = SUPPLIER_ICONS[supplier.protocol] || OpenAIIcon;
  const color = SUPPLIER_COLORS[supplier.protocol] || '#888';

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <IconComponent size={24} style={{ color }} />
      </div>
      <div>
        <div className="font-semibold text-primary">{supplier.displayName || supplier.name}</div>
        <div className="text-xs text-tertiary">{supplier.protocol}</div>
      </div>
    </div>
  );
};

interface ModelMappingRowProps {
  rule: ModelMappingRule;
  supplier: Supplier | undefined;
}

const ModelMappingRow: React.FC<ModelMappingRowProps> = ({ rule, supplier }) => {
  const IconComponent = supplier ? SUPPLIER_ICONS[supplier.protocol] || OpenAIIcon : OpenAIIcon;
  const color = supplier ? SUPPLIER_COLORS[supplier.protocol] || '#888' : '#888';

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-default-100/50 rounded-lg">
      {/* 入站模型 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-primary">{rule.inboundModel}</div>
      </div>

      {/* 箭头 */}
      <ArrowRight size={14} className="text-tertiary shrink-0" />

      {/* 供应商图标 */}
      <div
        className="w-6 h-6 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <IconComponent size={14} style={{ color }} />
      </div>

      {/* 出站模型/供应商 */}
      <div className="flex-1 min-w-0">
        {rule.outboundModel ? (
          <div className="text-sm truncate text-primary">{rule.outboundModel}</div>
        ) : (
          <Chip size="sm" variant="flat" className="text-xs">透传</Chip>
        )}
        <div className="text-xs text-tertiary truncate">{supplier?.displayName || '未知供应商'}</div>
      </div>
    </div>
  );
};

export const OutboundConfig: React.FC<OutboundConfigProps> = ({
  suppliers,
  singleSupplierId,
  modelMappings,
}) => {
  // 单供应商模式 (Codex/Gemini)
  if (singleSupplierId) {
    const supplier = suppliers.find(s => s.id === singleSupplierId);
    if (!supplier) {
      return <div className="text-tertiary text-sm">未选择供应商</div>;
    }
    return <SingleSupplier supplier={supplier} />;
  }

  // 模型映射模式 (Claude)
  if (modelMappings && modelMappings.length > 0) {
    return (
      <div className="space-y-2">
        {modelMappings.map((rule, index) => {
          const supplier = suppliers.find(s => s.id === rule.targetSupplierId);
          return (
            <ModelMappingRow
              key={rule.id || index}
              rule={rule}
              supplier={supplier}
            />
          );
        })}
      </div>
    );
  }

  return <div className="text-tertiary text-sm">未配置</div>;
};
```

**Step 2: 添加到导出**

```tsx
// frontend/src/components/routes/index.ts
export { OutboundConfig } from './OutboundConfig';
```

**Step 3: Commit**

```bash
git add frontend/src/components/routes/
git commit -m "feat: 创建 OutboundConfig 组件显示出站配置"
```

---

## Task 4: 创建 RouteFlowCard 组件

**Files:**
- Create: `frontend/src/components/routes/RouteFlowCard.tsx`
- Modify: `frontend/src/components/routes/index.ts`

**Step 1: 编写组件代码**

创建流量卡片主组件，整合入站端点、流向箭头和出站配置。

```tsx
// frontend/src/components/routes/RouteFlowCard.tsx
import React from 'react';
import { Card, CardBody, Switch, Button } from '@heroui/react';
import { Edit2, Trash2 } from 'lucide-react';
import { InboundEndpoint } from './InboundEndpoint';
import { FlowArrow } from './FlowArrow';
import { OutboundConfig } from './OutboundConfig';
import type { Route, Supplier } from '@/types/api';

interface RouteFlowCardProps {
  route: Route;
  suppliers: Supplier[];
  onToggle: (route: Route) => void;
  onEdit: (route: Route) => void;
  onDelete: (routeId: string) => void;
}

export const RouteFlowCard: React.FC<RouteFlowCardProps> = ({
  route,
  suppliers,
  onToggle,
  onEdit,
  onDelete,
}) => {
  // 获取主要目标供应商用于流向箭头
  let targetSupplier: Supplier | undefined;
  if (route.singleSupplierId) {
    targetSupplier = suppliers.find(s => s.id === route.singleSupplierId);
  } else if (route.modelMappings && route.modelMappings.length > 0) {
    // 使用第一条规则的供应商作为主要参考
    targetSupplier = suppliers.find(s => s.id === route.modelMappings![0].targetSupplierId);
  }

  return (
    <Card
      className={`border transition-all ${
        route.enabled
          ? 'border-brand-primary/30 dark:border-brand-primary/20 bg-elevated'
          : 'border-subtle opacity-60'
      }`}
    >
      <CardBody className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 左侧：入站端点 */}
          <div className="shrink-0">
            <InboundEndpoint localService={route.localService} />
          </div>

          {/* 中间：流向箭头 */}
          <div className="flex items-start justify-center lg:pt-3">
            <FlowArrow
              localService={route.localService}
              targetSupplier={targetSupplier}
              showProtocolConversion={true}
            />
          </div>

          {/* 右侧：出站配置 */}
          <div className="flex-1 min-w-0">
            <OutboundConfig
              suppliers={suppliers}
              singleSupplierId={route.singleSupplierId}
              modelMappings={route.modelMappings}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 shrink-0 lg:pt-2">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => onEdit(route)}
              title="编辑路由"
            >
              <Edit2 size={16} />
            </Button>
            <Switch
              isSelected={route.enabled}
              onValueChange={() => onToggle(route)}
              size="sm"
              aria-label="启用路由"
            />
            <Button
              isIconOnly
              color="danger"
              variant="light"
              size="sm"
              onPress={() => onDelete(route.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
```

**Step 2: 添加到导出**

```tsx
// frontend/src/components/routes/index.ts
export { RouteFlowCard } from './RouteFlowCard';
```

**Step 3: Commit**

```bash
git add frontend/src/components/routes/
git commit -m "feat: 创建 RouteFlowCard 组件整合流量卡片"
```

---

## Task 5: 更新 RouteConfigPage 使用新组件

**Files:**
- Modify: `frontend/src/pages/RouteConfigPage.tsx`

**Step 1: 替换路由列表渲染**

将现有的路由列表渲染代码替换为新的 RouteFlowCard 组件。

找到第 487-604 行的路由列表渲染代码，替换为：

```tsx
// 路由配置列表
<div className="space-y-4">
  {routes.map(route => (
    <RouteFlowCard
      key={route.id}
      route={route}
      suppliers={suppliers}
      onToggle={handleToggleRoute}
      onEdit={handleOpenEditModal}
      onDelete={handleDeleteRoute}
    />
  ))}

  {routes.length === 0 && (
    <Card className="border border-dashed border-subtle">
      <CardBody className="py-12 text-center">
        <div className="text-4xl mb-3">🚗</div>
        <p className="text-secondary font-medium">暂无路由配置</p>
        <p className="text-sm text-tertiary mt-1">
          {suppliers.length === 0
            ? '请先在供应商管理页面添加供应商'
            : '点击上方按钮添加新的路由配置'}
        </p>
      </CardBody>
    </Card>
  )}
</div>
```

**Step 2: 添加导入**

在文件顶部添加导入：

```tsx
import { RouteFlowCard } from '@/components/routes';
```

**Step 3: 验证编译**

```bash
cd frontend && npm run build
```

Expected: 编译成功，无错误

**Step 4: Commit**

```bash
git add frontend/src/pages/RouteConfigPage.tsx
git commit -m "feat: 更新路由配置页面使用新的流量卡片组件"
```

---

## Task 6: 添加展开详情功能

**Files:**
- Create: `frontend/src/components/routes/RouteFlowDetail.tsx`
- Modify: `frontend/src/components/routes/RouteFlowCard.tsx`
- Modify: `frontend/src/components/routes/index.ts`

**Step 1: 创建详情组件**

```tsx
// frontend/src/components/routes/RouteFlowDetail.tsx
import React from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from '@heroui/react';
import { AnthropicIcon, OpenAIIcon, GeminiIcon, CodexIcon } from '@/components/icons/SupplierIcons';
import type { Route, Supplier, ModelMappingRule } from '@/types/api';

const SUPPLIER_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'anthropic': AnthropicIcon,
  'openai-codex': CodexIcon,
  'openai-chat': OpenAIIcon,
  'gemini': GeminiIcon,
};

interface RouteFlowDetailProps {
  route: Route;
  suppliers: Supplier[];
}

export const RouteFlowDetail: React.FC<RouteFlowDetailProps> = ({ route, suppliers }) => {
  // 单供应商详情
  if (route.singleSupplierId) {
    const supplier = suppliers.find(s => s.id === route.singleSupplierId);
    if (!supplier) return null;

    const IconComponent = SUPPLIER_ICONS[supplier.protocol] || OpenAIIcon;

    return (
      <div className="p-4 bg-default-50 rounded-lg">
        <div className="text-sm font-medium mb-2">供应商详情</div>
        <div className="flex items-center gap-3">
          <IconComponent size={20} />
          <div>
            <div className="font-medium">{supplier.displayName || supplier.name}</div>
            <div className="text-xs text-tertiary">{supplier.baseUrl}</div>
            <Chip size="sm" variant="flat" className="mt-1">{supplier.protocol}</Chip>
          </div>
        </div>
      </div>
    );
  }

  // 模型映射详情表格
  if (route.modelMappings && route.modelMappings.length > 0) {
    return (
      <div className="p-4 bg-default-50 rounded-lg">
        <div className="text-sm font-medium mb-3">模型映射规则</div>
        <Table aria-label="模型映射规则" size="sm">
          <TableHeader>
            <TableColumn>优先级</TableColumn>
            <TableColumn>入站模型</TableColumn>
            <TableColumn>目标供应商</TableColumn>
            <TableColumn>出站模型</TableColumn>
            <TableColumn>状态</TableColumn>
          </TableHeader>
          <TableBody>
            {route.modelMappings.map((rule: ModelMappingRule, index: number) => {
              const supplier = suppliers.find(s => s.id === rule.targetSupplierId);
              return (
                <TableRow key={rule.id || index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-default-100 px-2 py-1 rounded">{rule.inboundModel}</code>
                  </TableCell>
                  <TableCell>{supplier?.displayName || rule.targetSupplierId}</TableCell>
                  <TableCell>
                    {rule.outboundModel ? (
                      <code className="text-xs bg-default-100 px-2 py-1 rounded">{rule.outboundModel}</code>
                    ) : (
                      <Chip size="sm" variant="flat">透传</Chip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      color={rule.enabled !== false ? 'success' : 'default'}
                      variant="flat"
                    >
                      {rule.enabled !== false ? '启用' : '禁用'}
                    </Chip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return null;
};
```

**Step 2: 更新 RouteFlowCard 支持展开**

在 RouteFlowCard 中添加展开状态：

```tsx
// 在 RouteFlowCard 组件中添加
import { useState } from 'react';
import { RouteFlowDetail } from './RouteFlowDetail';
import { ChevronDown, ChevronUp } from 'lucide-react';

// 在组件内部添加状态
const [isExpanded, setIsExpanded] = useState(false);

// 在 CardBody 底部添加展开按钮和详情
<div className="mt-3 pt-3 border-t border-default-200">
  <Button
    variant="light"
    size="sm"
    onPress={() => setIsExpanded(!isExpanded)}
    endContent={isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
  >
    {isExpanded ? '收起详情' : '查看详情'}
  </Button>
</div>

{isExpanded && (
  <div className="mt-3">
    <RouteFlowDetail route={route} suppliers={suppliers} />
  </div>
)}
```

**Step 3: 添加到导出**

```tsx
// frontend/src/components/routes/index.ts
export { RouteFlowDetail } from './RouteFlowDetail';
```

**Step 4: Commit**

```bash
git add frontend/src/components/routes/
git commit -m "feat: 添加路由流量卡片展开详情功能"
```

---

## Task 7: 验证和测试

**Files:**
- Test: 浏览器验证

**Step 1: 启动开发服务器**

```bash
./scripts/dev.sh &
```

**Step 2: 验证功能**

1. 访问 http://localhost:5173/route-config
2. 检查现有路由是否正确显示为卡片
3. 验证入站端点显示（图标、名称、路径）
4. 验证流向箭头显示
5. 验证出站配置显示
6. 测试展开/收起详情功能
7. 测试启用/禁用开关
8. 测试编辑功能
9. 测试删除功能

**Step 3: 响应式测试**

调整浏览器窗口大小，验证：
- 桌面端：横向三栏布局
- 平板/移动端：垂直堆叠布局

**Step 4: Commit**

```bash
git add .
git commit -m "test: 验证路由配置界面重新设计功能正常"
```

---

## 完成总结

实施完成后，路由配置页面将具有以下改进：

1. **卡片式布局**：每个路由显示为独立的流量卡片
2. **直观流向**：左侧入站 → 中间箭头 → 右侧出站
3. **协议转换可视化**：不同协议间用渐变色和"转换"标签标识
4. **模型映射列表**：Claude 路由垂直堆叠显示所有映射规则
5. **展开详情**：点击查看完整的模型映射表格
6. **响应式设计**：适配各种屏幕尺寸
