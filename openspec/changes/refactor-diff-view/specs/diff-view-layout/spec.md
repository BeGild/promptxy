## MODIFIED Requirements

### Requirement: Multiple View Modes

The request viewer SHALL provide three distinct view modes for inspecting requests: Structure Overview, Content Detail, and Diff Comparison.

#### Scenario: Switch to Diff Comparison view (UPDATED)

- **WHEN** a user clicks the "Diff Comparison" tab
- **AND** both original and modified requests are available
- **THEN** a side-by-side comparison layout is displayed with:
  - A directory tree on the left showing the modified request structure (structure is unchanged)
  - A difference navigation area on the right (Meld-like)
  - A two-column text diff viewer on the right
- **AND** tree nodes display visual indicators for which nodes contain content changes
- **AND** the diff viewer displays full content (no filtering), highlighting changed lines only
- **AND** the two columns scroll in sync (single scroll model)

## ADDED Requirements

### Requirement: Leaf Node Treated as Virtual Text File

In Diff Comparison view, each leaf node SHALL be treated as a virtual text file for comparison.

#### Scenario: Only leaf nodes are comparable

- **GIVEN** Diff Comparison view is active
- **WHEN** a user selects a non-leaf node (folder/collection) in the directory tree
- **THEN** the right content area SHALL display a prompt message in Chinese:
  - "请选择叶子节点查看内容差异"
- **AND** no structured rendering is shown in the diff viewer

#### Scenario: Leaf node content uses Content Detail text semantics

- **GIVEN** a leaf node is selected in the directory tree
- **THEN** the diff viewer SHALL render leaf node content as plain text
- **AND** the text representation SHALL be consistent with the Content Detail "text view" semantics for the same leaf node
- **NOTE**: The goal is "virtual file" behavior, not structured JSON/Markdown component rendering

### Requirement: Line-Level Diff with Alignment

The diff viewer SHALL compute and render differences at line granularity, aligned like a typical diff tool (e.g., meld).

#### Scenario: Line-level diff is whitespace-sensitive

- **GIVEN** a leaf node is selected
- **THEN** the diff algorithm SHALL compare content at line granularity
- **AND** whitespace differences (spaces, empty lines) SHALL be treated as changes

#### Scenario: Two columns are aligned by placeholder lines

- **GIVEN** a leaf node is selected and its content differs between original and modified
- **THEN** the diff viewer SHALL display two columns:
  - Left: Original
  - Right: Modified
- **AND** inserted/deleted lines SHALL be aligned using placeholder empty lines so that corresponding content remains visually aligned

#### Scenario: Full content is always displayed

- **GIVEN** Diff Comparison view is active
- **THEN** the diff viewer SHALL always display all lines of both contents
- **AND** only changed lines SHALL be highlighted (no "show changes only" filtering)

### Requirement: Synchronized Scrolling

The diff viewer SHALL scroll both columns in sync.

#### Scenario: Single scroll model for both columns

- **GIVEN** a leaf node is selected
- **WHEN** the user scrolls vertically in the diff viewer
- **THEN** both columns SHALL scroll together (synchronized)
- **AND** the implementation SHOULD use a single scroll container (e.g., one virtualized list rendering both columns per row)

### Requirement: Difference Navigation (Hunks)

The diff view SHALL provide a navigation mechanism to jump between difference regions.

#### Scenario: Navigator jumps to a difference region

- **GIVEN** a leaf node is selected and differences exist
- **THEN** the diff view SHALL display a navigation bar / mini-map indicating difference regions
- **WHEN** a user clicks a difference region indicator
- **THEN** the diff viewer SHALL scroll to the corresponding region

### Requirement: Directory Tree Stability

The directory tree structure SHALL remain stable in Diff Comparison view.

#### Scenario: Tree structure is not filtered or altered

- **GIVEN** Diff Comparison view is active
- **THEN** the left directory tree SHALL display the full modified structure
- **AND** the tree SHALL NOT be filtered, truncated, or restructured by diff settings
- **AND** the tree structure SHALL be treated as unchanged between original and modified (only leaf content changes are considered)

## REMOVED Requirements

### Requirement: Paragraph-Level Diff in Side-by-Side Layout

The previous paragraph-level Markdown diff requirement is removed in favor of line-level text diff for leaf node content.

### Requirement: Show Changes Only Filtering

The previous "Show Changes Only" filtering behavior is removed; Diff Comparison view always shows full content and highlights changed lines only.

