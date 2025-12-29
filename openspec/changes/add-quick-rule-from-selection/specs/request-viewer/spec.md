## ADDED Requirements

### Requirement: Selection-Based Quick Rule Creation

The request viewer SHALL provide a quick action button that allows users to create matching rules based on selected text content in the plain text renderer.

#### Scenario: Button appears when text is selected

- **WHEN** a user selects text in the PlainTextRenderer component
- **THEN** a "Create Rule from Selection" button becomes enabled in the toolbar
- **AND** the button is disabled when no text is selected

#### Scenario: Button opens match mode selector

- **WHEN** a user clicks the "Create Rule from Selection" button
- **THEN** a match mode selector dialog is displayed
- **AND** the selected text content is passed to the selector
- **AND** the dialog shows a preview of the regex that will be generated

#### Scenario: Only supported node types show button

- **WHEN** the selected node is of type `NodeType.STRING_LONG` or `NodeType.MARKDOWN` (in plain text mode)
- **THEN** the quick rule creation button is displayed in the toolbar
- **WHEN** the selected node is of any other type (e.g., `NodeType.JSON`, `NodeType.ARRAY`)
- **THEN** the quick rule creation button is not displayed

### Requirement: Regex Pattern Generation

The system SHALL automatically generate regex patterns based on user-selected match mode, handling special character escaping and locale-specific word boundary rules.

#### Scenario: Exact match generates anchored regex

- **WHEN** a user selects "gpt-4" and chooses "Exact Match" mode
- **THEN** the generated regex is `^gpt-4$`
- **AND** special characters are escaped if present

#### Scenario: Prefix match generates start anchor

- **WHEN** a user selects "claude-" and chooses "Prefix Match" mode
- **THEN** the generated regex is `^claude-`
- **AND** the pattern matches only strings starting with the selected text

#### Scenario: Suffix match generates end anchor

- **WHEN** a user selects "-opus-2024" and chooses "Suffix Match" mode
- **THEN** the generated regex is `-opus-2024$`
- **AND** the pattern matches only strings ending with the selected text

#### Scenario: Contains match generates plain pattern

- **WHEN** a user selects "2024" and chooses "Contains Match" mode
- **THEN** the generated regex is `2024`
- **AND** the pattern matches strings containing the selected text anywhere

#### Scenario: Whole word match with ASCII text uses word boundaries

- **WHEN** a user selects "gpt-4" (ASCII only) and chooses "Whole Word Match" mode
- **THEN** the generated regex is `\bgpt-4\b`
- **AND** the pattern matches only complete words

#### Scenario: Whole word match with non-ASCII text omits word boundaries

- **WHEN** a user selects "你好" (contains non-ASCII) and chooses "Whole Word Match" mode
- **THEN** the generated regex is `你好`
- **AND** word boundary characters (`\b`) are NOT included since they don't work with CJK characters

#### Scenario: Ignore case flag is added when enabled

- **WHEN** a user enables "Ignore Case" option
- **THEN** the generated regex includes the `(?i)` flag prefix
- **EXAMPLE**: selecting "GPT-4" with ignore case generates `(?i)^gpt-4$`

#### Scenario: Special characters are escaped

- **WHEN** a user selects text containing regex special characters (e.g., `a?b*c`, `(test)`, `[0-9]`)
- **THEN** special characters are escaped with backslash
- **EXAMPLE**: `a?b*c` becomes `a\?b\*c`

#### Scenario: Newlines are preserved

- **WHEN** a user selects text containing newline characters
- **THEN** newlines are preserved in the generated regex as `\n`
- **AND** the pattern correctly matches multi-line content

### Requirement: Match Mode Selector Dialog

The system SHALL provide a dialog interface for selecting match modes and options, with real-time preview of the generated regex.

#### Scenario: Dialog displays six match mode options

- **WHEN** the match mode selector dialog is opened
- **THEN** the following options are displayed:
  - Exact Match (完整匹配)
  - Prefix Match (前缀匹配)
  - Suffix Match (后缀匹配)
  - Contains Match (包含匹配)
  - Whole Word Match (全词语匹配)
- **AND** each option has a radio button for selection

#### Scenario: Ignore case checkbox is available

- **WHEN** the match mode selector dialog is opened
- **THEN** an "Ignore Case" (忽略大小写) checkbox is displayed
- **AND** the checkbox is unchecked by default

#### Scenario: Real-time regex preview

- **WHEN** a user changes the selected match mode or toggles the ignore case option
- **THEN** a preview area displays the regex that will be generated
- **AND** the preview updates immediately

#### Scenario: Confirm generates regex and closes dialog

- **WHEN** a user clicks the "Confirm" button
- **THEN** the regex is generated based on selected options
- **AND** the dialog closes
- **AND** the system navigates to the rule creation tab with pre-filled data

#### Scenario: Cancel closes dialog without changes

- **WHEN** a user clicks the "Cancel" button or presses Escape
- **THEN** the dialog closes
- **AND** no rule is created
- **AND** the user returns to the previous view

#### Scenario: Keyboard navigation is supported

- **WHEN** the dialog is open
- **THEN** Tab key navigates between controls
- **AND** Enter key confirms the selection
- **AND** Escape key cancels the dialog

### Requirement: Selected Text Content Access

The PlainTextRenderer component SHALL provide access to the currently selected text content for use by the quick rule creation feature.

#### Scenario: Text selection is tracked

- **WHEN** a user selects text in the textarea
- **THEN** the component tracks the selected text content
- **AND** the selection is updated on mouseup and keyup events

#### Scenario: Empty selection disables quick action

- **WHEN** no text is selected or the selection is cleared
- **THEN** the "Create Rule from Selection" button is disabled
- **AND** clicking the button has no effect

#### Scenario: Selection with newlines is preserved

- **WHEN** a user selects text containing multiple lines
- **THEN** the newline characters are included in the selected text
- **AND** the regex generator correctly handles the newlines

## MODIFIED Requirements

### Requirement: Content Panel Display

The Content Detail view SHALL display the selected node's content in a dedicated right panel with path navigation and quick rule creation capability.

#### Scenario: Toolbar contains quick rule creation button

- **WHEN** a text node (STRING_LONG or MARKDOWN in plain text mode) is selected
- **THEN** the toolbar displays a "Create Rule from Selection" button
- **AND** the button is positioned next to existing action buttons (copy, full screen)
- **AND** the button is enabled only when text is selected in the content panel
