## MODIFIED Requirements

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

## ADDED Requirements

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
