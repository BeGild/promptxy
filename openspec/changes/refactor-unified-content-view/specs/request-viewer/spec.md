# request-viewer Specification Delta

## REMOVED Requirements

### Requirement: Multiple View Modes

**Reason**: 界面架构重构，移除三视图标签切换，改为统一内容视图通过工具栏按钮切换模式。

**Migration**:
- "Structure Overview" 视图被移除，用户可通过文件树导航达到类似效果
- "Content Detail" 和 "Diff Comparison" 合并为统一视图 `UnifiedContentView`
- 使用工具栏的"差异对比"按钮在两种模式间切换

### Requirement: Paragraph-Level Diff for Markdown

**Reason**: 差异对比功能整合到 `UnifiedContentView` 中，该需求将被新的 "Unified Content View with Diff Mode" 需求替代。

**Migration**: 差异计算逻辑保持不变，整合到 `UnifiedContentView` 组件内部。

## ADDED Requirements

### Requirement: Unified Content View

The request viewer SHALL provide a unified content view that combines content detail and diff comparison modes into a single interface, with mode switching controlled via toolbar buttons.

#### Scenario: Default to Content Detail mode

- **WHEN** a user opens a request detail panel
- **THEN** the Content Detail mode is displayed by default
- **AND** a file browser style layout is displayed with a tree sidebar on the left and content panel on the right
- **AND** the toolbar shows "Diff Comparison" button (if original request is available)

#### Scenario: Switch to Diff Comparison mode via toolbar

- **WHEN** a user clicks the "Diff Comparison" button in the toolbar
- **AND** an original request is available for comparison
- **THEN** the view switches to Diff Comparison mode
- **AND** the "Diff Comparison" button shows as active
- **AND** diff navigation buttons ("Previous", "Next") appear in the toolbar
- **AND** the right content panel displays side-by-side diff comparison

#### Scenario: Switch back to Content Detail mode

- **WHEN** a user clicks the active "Diff Comparison" button again
- **THEN** the view switches back to Content Detail mode
- **AND** the "Diff Comparison" button shows as inactive
- **AND** diff navigation buttons are hidden
- **AND** the right content panel displays the selected node's content

#### Scenario: Diff Comparison button hidden when no original request

- **WHEN** a request detail panel is opened without an original request
- **THEN** the "Diff Comparison" button is not displayed in the toolbar
- **AND** only Content Detail mode is available

#### Scenario: Navigate between diff hunks

- **WHEN** a user is in Diff Comparison mode
- **AND** multiple diff hunks exist
- **THEN** "Previous" and "Next" buttons are displayed in the toolbar
- **AND** clicking "Next" scrolls to and highlights the next diff hunk
- **AND** clicking "Previous" scrolls to and highlights the previous diff hunk
- **AND** a counter shows "current / total" hunks

#### Scenario: Shared toolbar buttons in both modes

- **WHEN** a user is in either Content Detail or Diff Comparison mode
- **THEN** the following toolbar buttons are always available:
  - "Plain Text" / "Preview" toggle (for content that supports preview)
  - "Copy" button
  - "Create Rule" button (if callbacks are provided)
  - "Full Screen" button

### Requirement: Toolbar Button State Matrix

The unified content view SHALL display different toolbar buttons based on the current mode and availability of data.

#### Scenario: Content Detail mode toolbar

- **WHEN** the view is in Content Detail mode
- **THEN** the toolbar displays:
  - Diff Comparison button (inactive, if original request exists)
  - Plain Text / Preview toggle (for applicable content)
  - Copy button
  - Create Rule button (if applicable)
  - Full Screen button

#### Scenario: Diff Comparison mode toolbar with diffs

- **WHEN** the view is in Diff Comparison mode
- **AND** one or more diff hunks exist
- **THEN** the toolbar displays:
  - Diff Comparison button (active)
  - Plain Text / Preview toggle
  - Previous diff hunk button
  - Diff hunk counter (e.g., "2 / 5")
  - Next diff hunk button
  - Copy button
  - Create Rule button (if applicable)
  - Full Screen button

#### Scenario: Diff Comparison mode toolbar without diffs

- **WHEN** the view is in Diff Comparison mode
- **AND** no diff hunks exist
- **THEN** the Previous and Next navigation buttons are hidden or disabled
- **AND** all other buttons remain visible

## MODIFIED Requirements

### Requirement: File Tree Navigation

The Content Detail view SHALL provide a file-system style tree in the left sidebar for navigating the request structure. The tree is shared between both Content Detail and Diff Comparison modes.

#### Scenario: Tree persists across mode switches

- **WHEN** a user switches between Content Detail and Diff Comparison modes
- **THEN** the expanded/collapsed state of the tree is preserved
- **AND** the selected node remains selected

#### Scenario: Default select first changed node in Diff mode

- **WHEN** a user switches to Diff Comparison mode
- **AND** no node is currently selected
- **AND** one or more changed nodes exist
- **THEN** the first changed node is automatically selected
- **AND** its diff is displayed in the content panel

#### Scenario: Folder nodes expand and collapse

- **WHEN** a user clicks on an object node or array node
- **THEN** the node expands to show its children if collapsed
- **AND** the node collapses to hide its children if expanded
- **AND** the expanded/collapsed state is persisted during the session

#### Scenario: Leaf nodes are selectable

- **WHEN** a user clicks on a leaf node (primitive value, string, or text)
- **THEN** the node is highlighted as selected
- **AND** in Content Detail mode, the node's content is displayed
- **AND** in Diff Comparison mode, the diff for that node is displayed

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

The unified content view SHALL allow users to adjust the width ratio between the tree sidebar and content panel by dragging the divider. The panel size is shared and persisted across both modes.

#### Scenario: Panel size persists across mode switches

- **WHEN** a user adjusts the panel width ratio in Content Detail mode
- **THEN** switches to Diff Comparison mode
- **THEN** the panel width ratio is preserved

#### Scenario: Drag divider to resize panels

- **WHEN** a user drags the divider between the tree and content panel
- **THEN** the tree panel expands or contracts accordingly
- **AND** the content panel adjusts its width to fill the remaining space
- **AND** the minimum width of the tree panel is 15% of the container
- **AND** the maximum width of the tree panel is 50% of the container

#### Scenario: Panel size persistence

- **WHEN** a user adjusts the panel width ratio
- **THEN** the ratio is saved to localStorage
- **AND** the ratio is restored when the unified content view is opened again

### Requirement: Full Screen Content View

The unified content view SHALL support full-screen mode for focused content reading in both Content Detail and Diff Comparison modes.

#### Scenario: Enter full screen from Content Detail mode

- **WHEN** a user clicks the full screen button while in Content Detail mode
- **THEN** the view expands to fill the entire viewport
- **AND** the content detail is displayed in full screen
- **AND** a button is provided to exit full screen mode

#### Scenario: Enter full screen from Diff Comparison mode

- **WHEN** a user clicks the full screen button while in Diff Comparison mode
- **THEN** the view expands to fill the entire viewport
- **AND** the diff comparison is displayed in full screen
- **AND** a button is provided to exit full screen mode

#### Scenario: Exit full screen mode

- **WHEN** a user clicks the exit button or presses the Escape key
- **THEN** the view returns to the normal embedded size
- **AND** the current mode (Content Detail or Diff Comparison) is preserved
- **AND** the selected node and scroll position are preserved

### Requirement: Request Metadata Display

The request viewer SHALL extract and display key metadata from the request, including model name, message count, tool count, and response status.

#### Scenario: Metadata bar shown above unified view

- **WHEN** a request detail panel is opened
- **THEN** a metadata bar displays key information above the unified content view
- **AND** the metadata bar is not affected by mode switching
- **AND** the metadata is adapter-specific

#### Scenario: Response status shown

- **WHEN** response data is available
- **THEN** the response status code and duration are displayed in the metadata bar

### Requirement: Content Panel Display

The unified content view SHALL display the selected node's content in a dedicated right panel with path navigation. In Diff Comparison mode, the panel displays side-by-side diff comparison.

#### Scenario: Content panel in Content Detail mode

- **WHEN** a node is selected in the tree while in Content Detail mode
- **THEN** a breadcrumb at the top of the content panel shows the node's path
- **AND** the node's full content is displayed below the breadcrumb
- **AND** Markdown content is rendered with proper styling

#### Scenario: Content panel in Diff Comparison mode

- **WHEN** a node is selected in the tree while in Diff Comparison mode
- **AND** the node has differences between original and modified requests
- **THEN** a side-by-side diff comparison is displayed
- **AND** added lines are highlighted in green
- **AND** removed lines are highlighted in red
- **AND** unchanged lines are shown in neutral color

#### Scenario: Breadcrumb navigation

- **WHEN** a node is selected in the tree
- **THEN** a breadcrumb at the top of the content panel shows the node's path (e.g., `messages.0.content.0.text`)
- **AND** clicking a segment in the breadcrumb navigates to that node
- **AND** the breadcrumb is displayed in both modes

#### Scenario: Default to root node selection

- **WHEN** the unified content view is first opened
- **THEN** the root node is selected by default in Content Detail mode
- **AND** the first changed node is selected by default in Diff Comparison mode (if differences exist)

#### Scenario: Inline markdown rendering

- **WHEN** a text node containing Markdown is selected in Content Detail mode
- **THEN** the Markdown is rendered with proper styling (headings, code highlighting, math formulas)
- **AND** the rendering is inline without extra container borders or toolbars
- **AND** code blocks maintain syntax highlighting

#### Scenario: Numeric array rendering

- **WHEN** a numeric array node is selected (e.g., `[0.12, 0.34, 0.56, ...]`)
- **THEN** the values are displayed comma-separated in a monospace font
- **AND** long arrays wrap to multiple lines
- **AND** the full array content is viewable with horizontal scroll if needed

### Requirement: Search and Navigation

The request viewer SHALL provide search functionality to quickly locate specific fields or content within the request.

#### Scenario: Search by field name in unified view

- **WHEN** a user types a field name in the search box
- **THEN** matching fields are highlighted in the tree
- **AND** the tree is automatically expanded to show the matching fields
- **AND** the search works in both Content Detail and Diff Comparison modes

#### Scenario: Navigate to next difference

- **WHEN** a user clicks "Next Difference" in the toolbar while in Diff Comparison mode
- **THEN** the content panel scrolls to the next diff hunk
- **AND** the diff hunk is highlighted
- **AND** the counter updates to show the current hunk index

#### Scenario: Navigate to previous difference

- **WHEN** a user clicks "Previous Difference" in the toolbar while in Diff Comparison mode
- **THEN** the content panel scrolls to the previous diff hunk
- **AND** the diff hunk is highlighted
- **AND** the counter updates to show the current hunk index
