# Tasks: 基于选中内容快速创建规则

## 1. 基础工具实现

- [x] 1.1 创建 `RegexGenerator` 工具类 (`frontend/src/utils/regexGenerator.ts`)
  - [x] 1.1.1 实现 `escapeRegex(text: string): string` 函数，转义正则特殊字符
  - [x] 1.1.2 实现 `generateExactMatch(text: string): RegexResult` 函数，生成完整匹配正则 (`^text$`)
  - [x] 1.1.3 实现 `generatePrefixMatch(text: string): RegexResult` 函数，生成前缀匹配正则 (`^text`)
  - [x] 1.1.4 实现 `generateSuffixMatch(text: string): RegexResult` 函数，生成后缀匹配正则 (`text$`)
  - [x] 1.1.5 实现 `generateContainsMatch(text: string): RegexResult` 函数，生成包含匹配正则 (`text`)
  - [x] 1.1.6 实现 `generateWholeWordMatch(text: string): RegexResult` 函数，生成全词语匹配正则
  - [x] 1.1.7 实现 `generateRegex(text: string, mode: MatchMode, ignoreCase: boolean): RegexResult` 主函数

- [x] 1.2 添加单元测试 (`frontend/tests/unit/regexGenerator.test.ts`)
  - [x] 1.2.1 测试特殊字符转义 (`?`, `*`, `(`, `)`, `[`, `]`, `{`, `}`, `^`, `$`, `|`, `\\`, `.`)
  - [x] 1.2.2 测试完整匹配模式
  - [x] 1.2.3 测试前缀/后缀匹配模式
  - [x] 1.2.4 测试全词语匹配（英文使用 `\b`，中文不使用）
  - [x] 1.2.5 测试忽略大小写选项（使用 flags 而非 `(?i)` 前缀）
  - [x] 1.2.6 测试包含换行符的文本

## 2. 匹配模式选择器组件

- [x] 2.1 创建 `MatchModeSelector` 组件 (`frontend/src/components/rules/MatchModeSelector.tsx`)
  - [x] 2.1.1 定义 `MatchMode` 类型枚举（包含"基于当前请求"选项）
  - [x] 2.1.2 使用 HeroUI Select 组件实现下拉菜单
  - [x] 2.1.3 添加"忽略大小写"复选框
  - [x] 2.1.4 实时预览生成的正则表达式
  - [x] 2.1.5 添加确认和取消按钮

- [x] 2.2 添加组件样式和测试
  - [x] 2.2.1 确保样式符合 HeroUI 设计规范
  - [x] 2.2.2 测试键盘导航（Tab、Enter、Escape）
  - [x] 2.2.3 测试不同选中内容的预览效果
  - [x] 2.2.4 测试"基于当前请求"选项（无需选中内容）

## 3. PlainTextRenderer 增强

- [x] 3.1 在 `PlainTextRenderer` 中添加选中内容检测
  - [x] 3.1.1 添加 `useRef` 获取 textarea DOM 元素
  - [x] 3.1.2 监听 `select` 和 `keyup` 事件，检测选中状态
  - [x] 3.1.3 保存选中的文本内容
  - [x] 3.1.4 支持无选中状态（用于"基于当前请求创建"场景）

- [x] 3.2 在工具栏添加快捷按钮
  - [x] 3.2.1 在 `FileBrowserView.tsx` 工具栏区域添加"快速创建规则"按钮
  - [x] 3.2.2 按钮始终可用（无需选中内容）
  - [x] 3.2.3 添加 Tooltip 提示："快速创建规则（可选基于选中内容）"

- [x] 3.3 实现按钮点击逻辑
  - [x] 3.3.1 点击后打开 `MatchModeSelector` 弹窗
  - [x] 3.3.2 传递当前选中的文本内容（如果有的话）
  - [x] 3.3.3 如果有选中内容，默认选中"完整匹配"模式
  - [x] 3.3.4 如果无选中内容，默认选中"基于当前请求"选项
  - [x] 3.3.5 接收用户选择的匹配模式和选项
  - [x] 3.3.6 调用回调函数，传递生成的正则表达式或请求上下文

## 4. 规则编辑器增强

- [x] 4.1 扩展 `QuickRuleEditor` 的 props 接口
  - [x] 4.1.1 添加 `initialRegex?: { field: 'pathRegex' | 'modelRegex'; value: string; selectedText?: string }` 可选属性

- [x] 4.2 实现元数据提取函数
  - [x] 4.2.1 创建 `extractModelFromRequest(request: RequestRecord): string | undefined` 函数
  - [x] 4.2.2 从 `request.originalBody` 解析 `model` 字段
  - [x] 4.2.3 处理解析失败的情况（返回 undefined）

- [x] 4.3 修改规则创建逻辑
  - [x] 4.3.1 修改 `createRuleFromRequest` 函数，支持接收选中内容和匹配模式
  - [x] 4.3.2 根据 `initialRegex` 预填充对应的字段（`pathRegex` 或 `modelRegex`）
  - [x] 4.3.3 自动填充 `client`、`method`、`path`、`modelRegex`（如果存在）
  - [x] 4.3.4 生成有意义的规则名称（如 `基于选中内容 "xxx" 的规则`）

## 5. 侧边栏集成

- [x] 5.1 修改 `RequestDetailSidebar` 组件
  - [x] 5.1.1 添加处理选中内容创建规则的回调函数
  - [x] 5.1.2 回调函数接收选中内容、匹配模式、忽略大小写选项
  - [x] 5.1.3 调用 `RegexGenerator` 生成正则
  - [x] 5.1.4 切换到 `rule` 模式并传递预填充数据

- [x] 5.2 传递请求上下文
  - [x] 5.2.1 确保 `RequestRecord` 正确传递到 `QuickRuleEditor`
  - [x] 5.2.2 验证 `originalBody` 可访问且包含 model 字段

## 6. 移除旧功能

- [x] 6.1 移除现有的"快速创建规则"按钮
  - [x] 6.1.1 在 `RequestDetailInSidebar.tsx` 中移除按钮
  - [x] 6.1.2 移除相关的 `onSwitchToRuleMode` 回调处理

- [x] 6.2 清理未使用的代码
  - [x] 6.2.1 检查并移除不再需要的导入（Button, Plus 图标）
  - [x] 6.2.2 检查并移除不再使用的函数（handleSwitchToRuleMode）

## 7. 验证和测试

- [ ] 7.1 端到端测试（需要手动测试）
  - [ ] 7.1.1 测试选中 model 字段值并创建规则的完整流程
  - [ ] 7.1.2 测试选中普通文本并创建规则的完整流程
  - [ ] 7.1.3 测试包含特殊字符的选中内容
  - [ ] 7.1.4 测试包含换行符的选中内容
  - [ ] 7.1.5 测试各匹配模式生成的正则是否正确
  - [ ] 7.1.6 测试忽略大小写选项

- [ ] 7.2 边界情况测试（需要手动测试）
  - [ ] 7.2.1 测试未选中任何内容时按钮状态（应为始终可用）
  - [ ] 7.2.2 测试选中空字符串的情况
  - [ ] 7.2.3 测试 model 字段不存在时的行为
  - [ ] 7.2.4 测试超长文本选中的性能

- [ ] 7.3 UI/UX 测试（需要手动测试）
  - [ ] 7.3.1 测试不同屏幕尺寸下的布局
  - [ ] 7.3.2 测试暗色模式下的显示效果
  - [ ] 7.3.3 测试键盘导航和可访问性
  - [ ] 7.3.4 测试 Tooltip 显示和隐藏

## 8. 文档

- [ ] 8.1 更新用户文档
  - [ ] 8.1.1 添加"基于选中内容快速创建规则"功能说明
  - [ ] 8.1.2 说明各匹配模式的含义和使用场景
  - [ ] 8.1.3 提供示例截图

- [ ] 8.2 更新开发者文档
  - [ ] 8.2.1 添加 `RegexGenerator` 工具类的使用说明
  - [ ] 8.2.2 添加 `MatchModeSelector` 组件的 Props 说明
  - [ ] 8.2.3 说明如何扩展新的匹配模式

## 依赖关系

- 任务 1 必须最先完成（其他任务依赖 `RegexGenerator`）
- 任务 2 和任务 3 可以并行开发
- 任务 4、5、6 必须在任务 1、2、3 完成后进行
- 任务 7 必须在所有开发任务完成后进行
- 任务 8 可以在开发过程中同步进行

## 实现说明

**已完成的核心功能：**

1. **RegexGenerator 工具类** (`frontend/src/utils/regexGenerator.ts`)
   - 支持完整匹配、前缀匹配、后缀匹配、包含匹配、全词语匹配
   - 自动转义正则特殊字符
   - 英文使用 `\b` 单词边界，中文不使用
   - 使用 flags 而非 `(?i)` 前缀实现忽略大小写
   - 提供后端格式转换函数

2. **MatchModeSelector 组件** (`frontend/src/components/rules/MatchModeSelector.tsx`)
   - 使用 HeroUI Select 组件实现
   - 支持忽略大小写选项
   - 实时预览生成的正则表达式
   - 支持"基于当前请求"选项

3. **PlainTextRenderer 增强** (`frontend/src/components/request-viewer/components/file-tree/InlineNodeRenderer.tsx`)
   - 添加选中内容检测（通过 textarea selectionStart/End）
   - 通过 props 向上传递选中状态

4. **FileBrowserView 工具栏按钮** (`frontend/src/components/request-viewer/components/views/FileBrowserView.tsx`)
   - 添加"创建规则"按钮（Sparkles 图标）
   - 始终可用，支持基于选中内容或基于当前请求

5. **QuickRuleEditor 增强** (`frontend/src/components/rules/QuickRuleEditor.tsx`)
   - 支持 `initialRegex` 预填充选项
   - 实现 `extractModelFromRequest` 函数
   - 更新 `createRuleFromRequest` 支持选中内容和匹配模式

6. **侧边栏集成** (`frontend/src/components/requests/RequestDetailSidebar.tsx`)
   - 添加处理选中内容创建规则的回调函数
   - 传递回调到整个组件链

7. **移除旧功能** (`frontend/src/components/requests/RequestDetailInSidebar.tsx`)
   - 移除旧的"快速创建规则"按钮
   - 清理不再使用的导入和函数

**待完成（需要手动测试/文档）：**
- 任务 7：端到端测试、边界情况测试、UI/UX 测试
- 任务 8：用户文档和开发者文档
