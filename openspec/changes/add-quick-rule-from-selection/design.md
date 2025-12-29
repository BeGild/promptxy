# Design: 基于选中内容快速创建规则

## Context

当前规则创建流程需要用户手动复制粘贴内容并编写正则表达式，对非技术用户不友好。需要提供一个简化的交互方式，让用户能够快速基于选中的文本创建匹配规则。

### 约束条件

- 仅支持"内容详情"视图中的 `PlainTextRenderer` 组件（`NodeType.STRING_LONG` 和 `NodeType.MARKDOWN` 在纯文本模式下）
- 不需要支持代码高亮组件、Markdown 预览模式
- 需要自动转义正则特殊字符
- 中文和英文的"全词语匹配"逻辑不同

### 利益相关者

- 前端用户：需要快速创建规则的开发者/测试者
- 后端系统：规则引擎需要接收正确的正则表达式

## Goals / Non-Goals

### Goals

- 用户选中任意文本后，可以一键生成基于该文本的匹配规则
- 自动处理正则表达式生成，降低用户技术门槛
- 自动填充请求的元数据（client、method、path、model）
- 保持与现有规则系统的兼容性

### Non-Goals

- 不支持 Markdown 预览模式下的选中操作
- 不支持代码高亮组件的选中操作
- 不支持多光标/多选区操作
- 不在规则匹配条件中添加新的字段类型（如 bodyRegex）

## Decisions

### Decision 1: 交互方式选择

**选择**: 在 `PlainTextRenderer` 组件的工具栏区域添加"基于选中内容创建规则"按钮

**理由**:
- 浮动菜单实现复杂度高（需要处理选区坐标计算、边界检测）
- 工具栏按钮更符合现有 UI 风格（FileBrowserView.tsx 中已有复制、全屏等按钮）
- 技术实现更简单可靠

**替代方案**:
- 浮动菜单（因实现复杂度放弃）
- 右键菜单（因移动端不支持、发现性差放弃）

### Decision 2: 匹配模式设计

**选择**: 提供 6 种匹配模式选项

| 匹配模式 | 生成的正则格式 | 示例 |
|---------|--------------|------|
| 完整匹配 | `^选中内容$` | `^gpt-4$` |
| 前缀匹配 | `^选中内容` | `^claude-` |
| 后缀匹配 | `选中内容$` | `-opuss-2024$` |
| 包含匹配 | `选中内容` | `2024` |
| 全词语匹配(英) | `\b选中内容\b` | `\bgpt-4\b` |
| 全词语匹配(中) | `选中内容` | `你好` |
| 忽略大小写 | 添加 `(?i)` 前缀 | `(?i)^GPT-4$` |

**理由**:
- 覆盖最常见的匹配场景
- 自动生成正则，用户无需学习正则语法

### Decision 3: 全词语匹配的判断逻辑

**选择**: 根据选中内容是否包含非 ASCII 字符来判断

```typescript
function isWholeWordMatch(selectedText: string): boolean {
  // 如果全是 ASCII 字符，使用 \b 单词边界
  // 如果包含非 ASCII 字符（中文、日文等），直接匹配
  const hasNonAscii = /[^\x00-\x7F]/.test(selectedText);
  return !hasNonAscii;
}
```

**理由**:
- 中文没有单词边界概念，`\b` 在中文场景下无效
- 英文混合场景（如 `gpt-4`）使用 `\b` 可以正确匹配
- 实现简单，性能良好

### Decision 4: 正则特殊字符转义

**选择**: 在生成正则前，自动转义正则特殊字符

```typescript
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**理由**:
- 用户选中的文本可能包含 `?`、`*`、`(`、`)` 等正则特殊字符
- 自动转义避免用户手动处理
- 用户期望"字面匹配"而非"正则匹配"

### Decision 5: 选中内容 → 规则字段的映射

**选择**: 仅支持将选中内容填充到 `pathRegex` 或 `modelRegex`

**理由**:
- 当前规则系统的 `when` 字段只有 `pathRegex` 和 `modelRegex`
- 不添加新的字段类型，保持规则系统简洁

**映射逻辑**:
- 如果用户选中的是 `model` 字段的值节点 → 填充到 `modelRegex`
- 其他情况 → 不支持（提示用户此节点类型不支持快捷创建）

### Decision 6: 元数据提取

**选择**: 在 `QuickRuleEditor` 中从 `request` 对象重新解析 model

**理由**:
- 当前 `RequestMetadata` 在 `RequestDetailPanel` 中，无法直接传递
- `request.originalBody` 包含完整请求数据，可以解析 model
- 避免重构数据流

**实现**:
```typescript
function extractModelFromRequest(request: RequestRecord): string | undefined {
  try {
    const body = typeof request.originalBody === 'string'
      ? JSON.parse(request.originalBody)
      : request.originalBody;
    return body?.model;
  } catch {
    return undefined;
  }
}
```

## Risks / Trade-offs

### Risk 1: 用户选中内容后不知道有快捷按钮

**缓解措施**:
- 按钮仅在选中文本后高亮显示
- 添加 Tooltip 提示
- 考虑后续添加引导动画

### Risk 2: 生成的正则表达式不符合用户预期

**缓解措施**:
- 在规则编辑器中显示生成的正则，用户可手动修改
- 提供正则测试功能
- 文档说明各匹配模式的含义

### Risk 3: 换行符处理问题

**缓解措施**:
- 保留原始换行符，正则中使用 `\n` 表示
- 测试多行选中的场景

## Migration Plan

### 步骤

1. 创建 `RegexGenerator` 工具类，实现各匹配模式的正则生成
2. 在 `PlainTextRenderer` 中添加"基于选中内容创建规则"按钮
3. 创建 `MatchModeSelector` 组件，提供匹配模式选择
4. 修改 `QuickRuleEditor` 的 `createRuleFromRequest` 函数，接收选中内容和匹配模式
5. 移除现有的"快速创建规则"按钮

### 回滚计划

- 保留原有规则创建流程
- 如果新功能有问题，可以回退到使用现有按钮

## Resolved Questions

1. **匹配模式选择器的 UI 形式**
   - ✅ **决策**: 使用下拉菜单（HeroUI Select 组件）
   - **理由**: 实现简单，符合现有 UI 风格，用户熟悉

2. **是否需要支持"不选中内容"的快捷创建**
   - ✅ **决策**: 支持
   - **实现**: 在 `MatchModeSelector` 中提供"基于当前请求创建"选项，不需要选中内容
   - **使用场景**: 用户想基于整个请求快速创建规则，而不是匹配特定文本

3. **model 字段不存在时的处理**
   - ✅ **决策**: 不填充 `modelRegex` 字段
   - **理由**: 规则系统本身就支持不填写模型，无需特殊处理
