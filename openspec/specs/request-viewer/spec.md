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

