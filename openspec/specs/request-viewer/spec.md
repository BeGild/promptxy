# request-viewer Specification

## Purpose
TBD - created by archiving change add-request-viewer. Update Purpose after archive.
## Requirements
### Requirement: Multiple View Modes

The request viewer SHALL provide three distinct view modes for inspecting requests: Structure Overview, Content Detail, and Diff Comparison.

#### Scenario: Default to Structure Overview

- **WHEN** a user opens a request detail panel
- **THEN** the Structure Overview view is displayed by default
- **AND** key sections (System Prompt, Messages, Tools) are shown as expandable groups

#### Scenario: Switch to Content Detail view

- **WHEN** a user clicks the "Content Detail" tab
- **THEN** a file browser style layout is displayed with a tree sidebar on the left and content panel on the right
- **AND** the tree displays nodes in a file-system style (objects/arrays as folders, leaf nodes as files)
- **AND** clicking a leaf node selects it and displays its content in the right panel
- **AND** the right panel shows the full rendered content of the selected node
- **AND** the divider between panels can be dragged to adjust the width ratio

#### Scenario: Switch to Diff Comparison view

- **WHEN** a user clicks the "Diff Comparison" tab
- **AND** both original and modified requests are available
- **THEN** a side-by-side comparison of the two requests is displayed
- **AND** only differences are highlighted when "Show Changes Only" is enabled

### Requirement: Markdown Rendering

The request viewer SHALL render text fields containing Markdown content with proper formatting, including headers, lists, code blocks with syntax highlighting, tables, blockquotes, and mathematical formulas.

#### Scenario: System Prompt rendered as Markdown

- **WHEN** a request contains a system prompt field with Markdown formatting
- **THEN** the Markdown is rendered with proper styling (headings, lists, code blocks)
- **AND** code blocks are syntax-highlighted based on language detection

#### Scenario: Inline math formulas rendered

- **WHEN** a Markdown field contains inline math using `$...$` syntax
- **THEN** the formula is rendered with proper mathematical notation
- **AND** the formula is visually distinct from surrounding text

#### Scenario: Block math formulas rendered

- **WHEN** a Markdown field contains block math using `$$...$$` syntax
- **THEN** the formula is rendered as a centered block with proper notation
- **AND** complex formulas (integrals, summations, matrices) are displayed correctly

#### Scenario: Full-screen Markdown reading

- **WHEN** a user clicks the expand button on a Markdown content block
- **THEN** the content opens in a full-screen modal
- **AND** a table of contents is displayed for navigation
- **AND** clicking a TOC item scrolls to the corresponding heading

#### Scenario: Copy Markdown source

- **WHEN** a user clicks the copy button on a Markdown content block
- **THEN** the user can choose to copy as rendered text or as Markdown source
- **AND** the content is copied to the clipboard

### Requirement: Configurable Node Rendering

The request viewer SHALL support configuration-driven rendering behavior for each field, including node type specification, default collapse state, and custom renderers.

#### Scenario: System Prompt defaults to expanded

- **WHEN** the System Prompt field is configured with `defaultCollapsed: false`
- **THEN** the System Prompt is displayed in expanded state by default
- **AND** the content is rendered using the Markdown renderer

#### Scenario: Tools array defaults to collapsed

- **WHEN** the Tools array field is configured with `defaultCollapsed: true`
- **AND** the array contains more than 10 items
- **THEN** the Tools array is displayed in collapsed state by default
- **AND** a summary shows the item count

#### Scenario: Custom renderer for specific field

- **WHEN** a field is configured with a custom renderer component
- **THEN** the custom renderer is used instead of the default renderer for that field type

### Requirement: Smart Collapsible Tree

The request viewer SHALL automatically determine which nodes should be collapsible and their default state based on content size, nesting depth, and field configuration.

#### Scenario: Long string auto-collapses

- **WHEN** a string field exceeds 500 characters
- **AND** the field is configured as collapsible
- **THEN** the field is displayed in collapsed state with a summary
- **AND** a "Show More" button expands the full content

#### Scenario: Deep nesting auto-collapses

- **WHEN** a node is nested at depth 4 or deeper
- **THEN** the node is displayed in collapsed state by default
- **AND** parent nodes show a child count indicator

#### Scenario: User toggle persists

- **WHEN** a user manually expands or collapses a node
- **THEN** the toggle state is remembered during the session
- **AND** the state is reset when viewing a different request

### Requirement: Request Adapter Interface

The request viewer SHALL support pluggable adapters for different API request formats, allowing the core viewer to remain format-agnostic.

#### Scenario: Auto-detect Claude API format

- **WHEN** a request with `model` and `messages` fields is passed to the viewer
- **THEN** the ClaudeMessagesAdapter is automatically selected
- **AND** the request is parsed according to Claude API structure

#### Scenario: Use explicit adapter

- **WHEN** a user provides a specific adapter instance to RequestDetailPanel
- **THEN** the provided adapter is used instead of auto-detection
- **AND** the request is parsed according to that adapter's rules

#### Scenario: Adapter defines field groups

- **WHEN** an adapter implements the `getGroups()` method
- **THEN** the Structure Overview view displays the grouped sections
- **AND** each group shows its label and icon

### Requirement: Paragraph-Level Diff for Markdown

The diff viewer SHALL perform paragraph-level comparison for Markdown content, rather than line-level comparison, to better identify structural changes.

#### Scenario: Paragraph move detected

- **WHEN** a paragraph is moved to a different position in the document
- **THEN** the diff shows the paragraph in its new location with a "moved" indicator
- **AND** unchanged paragraphs between moves are collapsed

#### Scenario: Only changed paragraphs shown

- **WHEN** "Show Changes Only" is enabled
- **AND** a Markdown document has 20 paragraphs with 2 modified
- **THEN** only the 2 modified paragraphs are displayed
- **AND** a summary indicates "2 of 20 paragraphs changed"

### Requirement: Safe Markdown Rendering

The request viewer SHALL sanitize all Markdown content to prevent XSS attacks while preserving legitimate formatting.

#### Scenario: Script tags removed

- **WHEN** a Markdown field contains `<script>alert('xss')</script>`
- **THEN** the script tags are removed during rendering
- **AND** no JavaScript is executed

#### Scenario: Dangerous attributes filtered

- **WHEN** a Markdown field contains HTML with `onload` or `onclick` attributes
- **THEN** these attributes are stripped from the rendered output
- **AND** the HTML is rendered safely

### Requirement: Request Metadata Display

The request viewer SHALL extract and display key metadata from the request, including model name, message count, tool count, and response status.

#### Scenario: Metadata bar shown

- **WHEN** a request detail panel is opened
- **THEN** a metadata bar displays key information (model, message count, etc.)
- **AND** the metadata is adapter-specific

#### Scenario: Response status shown

- **WHEN** response data is available
- **THEN** the response status code and duration are displayed in the metadata bar

### Requirement: Search and Navigation

The request viewer SHALL provide search functionality to quickly locate specific fields or content within the request.

#### Scenario: Search by field name

- **WHEN** a user types a field name in the search box
- **THEN** matching fields are highlighted
- **AND** the tree is automatically expanded to show the matching fields

#### Scenario: Navigate to next difference

- **WHEN** a user clicks "Next Difference" in the Diff view
- **THEN** the view scrolls to the next changed section
- **AND** the changed section is highlighted

### Requirement: Accessibility

The request viewer SHALL be keyboard navigable and support screen readers for all interactive elements.

#### Scenario: Keyboard navigation

- **WHEN** a user uses Tab key
- **THEN** focus moves through expandable nodes, buttons, and tabs in logical order
- **AND** Enter/Space toggles expand/collapse

#### Scenario: Screen reader support

- **WHEN** a screen reader is used
- **THEN** each node is announced with its label, type, and state (expanded/collapsed)
- **AND** diff changes are announced as "added", "removed", or "modified"

### Requirement: Path Autocomplete Search

The request viewer SHALL provide an autocomplete input for searching requests by path, displaying all unique historical paths as dropdown suggestions.

#### Scenario: Load unique paths on focus

- **WHEN** a user focuses on the search input
- **THEN** a list of all unique request paths is loaded from `GET /_promptxy/paths`
- **AND** the paths are displayed in a dropdown suggestions list
- **AND** the input remains visible and editable during loading

#### Scenario: Local filtering of path suggestions

- **WHEN** a user types in the search input
- **THEN** the dropdown suggestions are filtered locally based on the input value
- **AND** filtering is case-insensitive
- **AND** no network request is made for filtering

#### Scenario: Select path from suggestions

- **WHEN** a user selects a path from the dropdown suggestions
- **THEN** the search is triggered with the selected path value
- **AND** requests are filtered using path prefix matching
- **AND** the dropdown closes

#### Scenario: Path prefix matching

- **WHEN** a user searches with a value starting with `/`
- **THEN** requests are filtered using `path LIKE 'value%'`
- **AND** all requests with paths matching the prefix are returned
- **EXAMPLE**: searching `/api/users` returns `/api/users/123`, `/api/users/profile`, etc.

#### Scenario: ID fuzzy matching

- **WHEN** a user searches with a value not starting with `/`
- **THEN** requests are filtered using `LIKE '%value%'` on `id`, `path`, and `original_body` fields
- **AND** requests matching any of the three fields are returned

#### Scenario: Custom value allowed

- **WHEN** a user types a value not in the suggestions list
- **THEN** the input accepts the custom value
- **AND** the search is triggered based on the input pattern (starts with `/` or not)

#### Scenario: Clear search

- **WHEN** a user clicks the "Clear Search" button
- **THEN** the search input is cleared
- **AND** all requests are displayed without filtering

#### Scenario: Virtual scroll compatibility

- **WHEN** the virtual scroll mode is enabled
- **THEN** the PathAutocomplete component is used instead of the standard Input
- **AND** behavior is consistent with the standard list view

#### Scenario: Loading state indication

- **WHEN** path suggestions are being loaded
- **THEN** a loading indicator is displayed in the input
- **AND** the input remains interactive
- **WHEN** search results are being loaded after selection
- **THEN** a loading indicator is displayed in the input
- **AND** the dropdown is hidden

#### Scenario: Error handling

- **WHEN** loading path suggestions fails
- **THEN** the component falls back to a standard input allowing custom values
- **AND** an error message is logged to the console
- **AND** the user can still search by typing manually

### Requirement: File Tree Navigation

The Content Detail view SHALL provide a file-system style tree in the left sidebar for navigating the request structure.

#### Scenario: Folder nodes expand and collapse

- **WHEN** a user clicks on an object node or array node
- **THEN** the node expands to show its children if collapsed
- **AND** the node collapses to hide its children if expanded
- **AND** the expanded/collapsed state is persisted during the session

#### Scenario: Leaf nodes are selectable

- **WHEN** a user clicks on a leaf node (primitive value, string, or text)
- **THEN** the node is highlighted as selected
- **AND** the node's content is displayed in the right content panel

#### Scenario: Numeric arrays displayed as leaf nodes

- **WHEN** an array contains only numeric values (e.g., embedding vectors)
- **THEN** the array is displayed as a leaf node, not as a folder
- **AND** the content panel displays the numeric values comma-separated

#### Scenario: Deep nesting supports horizontal scroll

- **WHEN** the tree structure is deeply nested (more than 5 levels)
- **AND** the expanded width exceeds the sidebar width
- **THEN** a horizontal scrollbar appears on the tree sidebar
- **AND** users can scroll horizontally to see all nested nodes

#### Scenario: Tree state persistence

- **WHEN** a user expands or collapses nodes in the tree
- **THEN** the expanded state is saved to localStorage
- **AND** the state is restored when the same request is viewed again

### Requirement: Resizable Split Panel

The Content Detail view SHALL allow users to adjust the width ratio between the tree sidebar and content panel by dragging the divider.

#### Scenario: Drag divider to resize panels

- **WHEN** a user drags the divider between the tree and content panel
- **THEN** the tree panel expands or contracts accordingly
- **AND** the content panel adjusts its width to fill the remaining space
- **AND** the minimum width of the tree panel is 15% of the container
- **AND** the maximum width of the tree panel is 50% of the container

#### Scenario: Panel size persistence

- **WHEN** a user adjusts the panel width ratio
- **THEN** the ratio is saved to localStorage
- **AND** the ratio is restored when the Content Detail view is opened again

### Requirement: Content Panel Display

The Content Detail view SHALL display the selected node's content in a dedicated right panel with path navigation.

#### Scenario: Breadcrumb navigation

- **WHEN** a node is selected in the tree
- **THEN** a breadcrumb at the top of the content panel shows the node's path (e.g., `messages.0.content.0.text`)
- **AND** clicking a segment in the breadcrumb navigates to that node

#### Scenario: Default to root node selection

- **WHEN** the Content Detail view is first opened
- **THEN** the root node is selected by default
- **AND** the content panel displays the root node's structure

#### Scenario: Inline markdown rendering

- **WHEN** a text node containing Markdown is selected
- **THEN** the Markdown is rendered with proper styling (headings, code highlighting, math formulas)
- **AND** the rendering is inline without extra container borders or toolbars
- **AND** code blocks maintain syntax highlighting

#### Scenario: Numeric array rendering

- **WHEN** a numeric array node is selected (e.g., `[0.12, 0.34, 0.56, ...]`)
- **THEN** the values are displayed comma-separated in a monospace font
- **AND** long arrays wrap to multiple lines
- **AND** the full array content is viewable with horizontal scroll if needed

### Requirement: Full Screen Content View

The Content Detail view SHALL support full-screen mode for focused content reading.

#### Scenario: Enter full screen mode

- **WHEN** a user clicks the full screen button in the content panel
- **THEN** the Content Detail view expands to fill the entire viewport
- **AND** the tree sidebar and content panel maintain their width ratio
- **AND** a button is provided to exit full screen mode

#### Scenario: Exit full screen mode

- **WHEN** a user clicks the exit button or presses the Escape key
- **THEN** the view returns to the normal embedded size
- **AND** the selected node and scroll position are preserved

### Requirement: Tree Visual Icons

The file tree SHALL display appropriate icons for different node types using a consistent icon system.

#### Scenario: Folder icons

- **WHEN** a node is an object or array (folder-type node)
- **THEN** a folder icon is displayed
- **AND** the icon shows as `Folder` when collapsed
- **AND** the icon shows as `FolderOpen` when expanded

#### Scenario: File icons by content type

- **WHEN** a leaf node is displayed
- **THEN** an appropriate icon is shown based on the node type
- **AND** `FileText` icon for text/Markdown content
- **AND** `Code` icon for code blocks
- **AND** `File` icon for primitive values
- **AND** `Hash` icon for numeric values

### Requirement: 请求记录文件系统持久化

系统 SHALL 使用文件系统存储请求记录，每个请求存储为独立的 YAML 格式文件，并使用人类可读的时间戳作为文件标识。

#### Scenario: 请求文件格式

- **WHEN** 一个请求被持久化到文件系统
- **THEN** 文件存储在 `~/.local/promptxy/requests/` 目录下
- **AND THEN** 文件名为 `{id}.yaml`，其中 ID 格式为 `YYYY-MM-DD_HH-mm-ss-SSS_random`
- **AND THEN** 文件内容为 YAML 格式，包含所有请求字段
- **AND THEN** 大字段（originalBody, modifiedBody, responseBody）使用 YAML 多行字符串语法（`|`）避免转义

#### Scenario: 请求 ID 生成

- **WHEN** 生成新的请求 ID
- **THEN** ID 格式为 `YYYY-MM-DD_HH-mm-ss-SSS_random`
- **EXAMPLE**: `2025-01-15_14-30-25-123_a1b2c3`
- **AND THEN** 日期部分使用本地时区
- **AND THEN** 时间部分使用 `-` 分隔（避免 Windows 文件系统问题）
- **AND THEN** 毫秒部分精确到 3 位
- **AND THEN** 随机部分为 6 位字符

#### Scenario: 请求 ID 解析为时间戳

- **WHEN** 需要从请求 ID 解析时间戳
- **THEN** 系统能够解析 ID 中的日期时间部分
- **AND THEN** 返回对应的 Unix 时间戳（毫秒）

### Requirement: 索引与按需加载

系统 SHALL 在内存中维护轻量级索引，详情文件按需加载，以平衡内存占用和查询性能。

#### Scenario: 启动时只加载索引

- **WHEN** 系统启动
- **THEN** 只加载索引文件到内存（约 60KB，1000 条记录）
- **AND THEN** 不加载请求详情文件
- **AND THEN** 启动时间应 < 1 秒

#### Scenario: 索引结构

- **WHEN** 内存中的索引被构建
- **THEN** 每条索引包含：id, timestamp, client, path, method, requestSize, responseSize, responseStatus, durationMs, error, matchedRulesBrief
- **AND THEN** 索引按时间戳倒序排列
- **AND THEN** 索引只占用约 60 字节/条

#### Scenario: 详情文件按需加载

- **WHEN** 请求详情被查询
- **THEN** 系统首先检查 LRU 缓存
- **AND THEN** 如果缓存命中，直接返回（< 1ms）
- **AND THEN** 如果缓存未命中，从文件系统加载 YAML 文件
- **AND THEN** 加载后更新 LRU 缓存

#### Scenario: LRU 缓存管理

- **WHEN** 详情文件被加载
- **THEN** 文件内容被缓存到 LRU 缓存
- **AND THEN** 缓存大小默认为 50 个文件
- **AND THEN** 缓存满时自动淘汰最久未使用的条目
- **AND THEN** 内存占用约 15MB（50 × 300KB）

### Requirement: 文件格式和目录结构

系统 SHALL 使用标准化的文件格式和目录结构存储请求记录和索引。

#### Scenario: 目录结构

- **WHEN** 文件系统存储被初始化
- **THEN** 创建以下目录结构：
  ```
  ~/.local/promptxy/
  ├── requests/              # 请求详情文件
  │   └── {id}.yaml
  ├── indexes/               # 索引文件
  │   ├── timestamp.idx
  │   ├── paths.idx
  │   └── stats.json
  └── settings.json          # 设置文件
  ```

#### Scenario: 时间索引文件格式

- **WHEN** 时间索引文件被写入
- **THEN** 文件路径为 `indexes/timestamp.idx`
- **AND THEN** 每行格式为：`timestamp|id|client|path|method|reqSize|respSize|status|duration|error|rules`
- **AND THEN** 行按时间戳倒序排列
- **EXAMPLE**: `1736898625123|2025-01-15_14-30-25-123_a1b2c3|claude|/v1/messages|POST|1024|2048|200|1234||["rule-001"]`

#### Scenario: 路径索引文件格式

- **WHEN** 路径索引文件被写入
- **THEN** 文件路径为 `indexes/paths.idx`
- **AND THEN** 每行一个唯一的路径
- **AND THEN** 路径按字母顺序排列

#### Scenario: 统计缓存文件格式

- **WHEN** 统计缓存文件被写入
- **THEN** 文件路径为 `indexes/stats.json`
- **AND THEN** 内容为 JSON 格式，包含 byClient, lastCleanup 等字段

### Requirement: 原子写入和数据完整性

系统 SHALL 使用原子写入操作确保数据完整性，单个文件损坏不应影响其他数据。

#### Scenario: 请求文件原子写入

- **WHEN** 写入请求文件
- **THEN** 首先写入临时文件 `{id}.yaml.tmp`
- **AND THEN** 然后使用 `rename()` 原子性地替换目标文件
- **AND THEN** 如果写入失败，临时文件被清理

#### Scenario: 索引文件更新

- **WHEN** 新请求被插入
- **THEN** 请求文件首先被写入
- **AND THEN** 然后更新内存索引
- **AND THEN** 最后异步持久化索引文件
- **AND THEN** 如果索引损坏，可以从 requests/ 目录重建

#### Scenario: 单点故障隔离

- **WHEN** 单个请求文件损坏
- **THEN** 其他请求文件不受影响
- **AND THEN** 系统可以继续正常工作
- **AND THEN** 损坏的文件被记录到日志

### Requirement: 查询性能和内存效率

系统 SHALL 在有限的内存占用下提供快速的查询响应。

#### Scenario: 列表查询纯内存操作

- **WHEN** 请求列表被查询
- **THEN** 查询完全在内存中进行（索引过滤）
- **AND THEN** 响应时间应 < 100ms
- **AND THEN** 不需要读取任何详情文件

#### Scenario: 过滤和排序

- **WHEN** 列表查询包含过滤条件（client, 时间范围, 搜索）
- **THEN** 过滤在内存索引上进行
- **AND THEN** 结果保持按时间戳倒序
- **AND THEN** 支持分页（limit/offset）

#### Scenario: 内存占用限制

- **WHEN** 系统运行时
- **THEN** 总内存占用应 < 100MB
- **AND THEN** 包含索引（60KB）+ LRU 缓存（约 15MB）+ 其他开销

#### Scenario: 路径查询缓存

- **WHEN** 唯一路径列表被查询
- **THEN** 从内存中的 Set 直接返回
- **AND THEN** 响应时间 < 10ms
- **AND THEN** 支持前缀过滤

### Requirement: 自动清理和容量管理

系统 SHALL 自动清理旧记录，保持存储在配置的限制范围内。

#### Scenario: 插入时自动清理

- **WHEN** 新请求被插入
- **AND THEN** 总记录数超过 maxHistory（默认 1000）
- **THEN** 自动删除最旧的记录
- **AND THEN** 同时删除请求文件、从索引移除、从缓存移除

#### Scenario: 手动清理

- **WHEN** 用户触发手动清理
- **THEN** 保留最新的 N 条记录（参数指定）
- **AND THEN** 删除多余的请求文件
- **AND THEN** 更新索引和缓存

### Requirement: 兼容性保证

系统 SHALL 保持 API 接口兼容，现有的 API 调用者无需修改代码。

#### Scenario: 导出函数签名不变

- **WHEN** 现有代码调用数据库函数
- **THEN** 所有导出函数的签名保持不变
- **AND THEN** 包括：`initializeDatabase()`, `insertRequestRecord()`, `getRequestList()`, `getRequestDetail()`, `getUniquePaths()`, `cleanupOldRequests()`, `deleteRequest()`, `getRequestStats()`, `getSetting()`, `updateSetting()`, 等

#### Scenario: 返回值格式兼容

- **WHEN** API 函数被调用
- **THEN** 返回值格式与之前完全一致
- **AND THEN** 包括 `RequestListResponse`, `PathsResponse`, `RequestRecord` 等

