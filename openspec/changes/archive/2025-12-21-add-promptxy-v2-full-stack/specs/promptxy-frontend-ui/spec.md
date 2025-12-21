## ADDED Requirements

### Requirement: Rules Management Page

The system SHALL provide a dedicated page for visual rule management with list view, search, and CRUD operations.

#### Scenario: View all rules

- **WHEN** a user navigates to the Rules page
- **THEN** they see a list of all rules as cards
- **AND THEN** each card shows rule ID, client, field, and enabled status
- **AND THEN** the page displays summary statistics (total, enabled, disabled)

#### Scenario: Search and filter rules

- **WHEN** a user enters text in the search box
- **THEN** the rule list filters in real-time
- **AND WHEN** a user selects a client filter
- **THEN** only rules for that client are shown

#### Scenario: Create new rule

- **WHEN** a user clicks "New Rule" button
- **THEN** a rule editor modal opens
- **AND THEN** the user can configure all rule properties
- **AND THEN** the rule is saved to backend and appears in the list

#### Scenario: Edit existing rule

- **WHEN** a user clicks "Edit" on a rule card
- **THEN** the rule editor modal opens with existing values
- **AND THEN** changes are saved to backend
- **AND THEN** the UI updates immediately

#### Scenario: Delete rule

- **WHEN** a user clicks "Delete" on a rule card
- **THEN** a confirmation dialog appears
- **AND THEN** the rule is removed from backend
- **AND THEN** the UI updates to remove the card

#### Scenario: Toggle rule enable/disable

- **WHEN** a user clicks the enable/disable toggle
- **THEN** the rule state updates in backend
- **AND THEN** the UI shows the new state immediately
- **AND THEN** the statistics update

### Requirement: Rule Editor Modal

The system SHALL provide a dynamic rule editor that adapts fields based on operation type.

#### Scenario: Dynamic form fields

- **WHEN** a user selects an operation type
- **THEN** only relevant input fields appear
- **AND THEN** required fields are clearly marked
- **AND THEN** invalid configurations are prevented

#### Scenario: Rule validation

- **WHEN** a user submits a rule
- **THEN** the system validates all fields
- **AND THEN** shows clear error messages for invalid input
- **AND THEN** prevents submission until valid

#### Scenario: Rule preview

- **WHEN** a user clicks "Preview" in the editor
- **THEN** they can test the rule against sample input
- **AND THEN** see before/after results
- **AND THEN** understand the rule's effect

#### Scenario: UUID generation

- **WHEN** a user creates a new rule
- **THEN** they can auto-generate a UUID for the rule ID
- **AND THEN** the ID is unique across all rules

### Requirement: Request History Page

The system SHALL provide a page to browse all captured requests with filtering and pagination.

#### Scenario: View request list

- **WHEN** a user navigates to Requests page
- **THEN** they see a paginated list of recent requests
- **AND THEN** each item shows timestamp, client, path, status, and matched rule count
- **AND THEN** new requests appear in real-time via SSE

#### Scenario: Real-time updates

- **WHEN** a new request passes through the gateway
- **THEN** the request list updates automatically
- **AND THEN** a visual indicator shows the new item
- **AND THEN** the user doesn't need to refresh

#### Scenario: Filter requests

- **WHEN** a user selects a client filter
- **THEN** only requests from that client are shown
- **AND WHEN** a user enters a time range
- **THEN** requests are filtered by timestamp

#### Scenario: Search requests

- **WHEN** a user enters search text
- **THEN** the system searches request bodies
- **AND THEN** shows matching requests

#### Scenario: Pagination

- **WHEN** there are more requests than page size
- **THEN** pagination controls appear
- **AND THEN** users can navigate through pages

### Requirement: Request Detail Modal

The system SHALL provide a detailed view of a single request with original/modified comparison.

#### Scenario: View request details

- **WHEN** a user clicks on a request in the list
- **THEN** a modal opens with complete request information
- **AND THEN** shows metadata (ID, timestamp, client, path, status, duration)

#### Scenario: Original vs Modified view

- **WHEN** the detail modal opens
- **THEN** it shows original request body
- **AND THEN** shows modified request body
- **AND THEN** highlights the differences

#### Scenario: Matched rules display

- **WHEN** a request had matched rules
- **THEN** the modal lists each rule ID and operation type
- **AND THEN** users can identify which rules affected the request

#### Scenario: Response information

- **WHEN** the request completed
- **THEN** the modal shows response status code
- **AND THEN** shows response duration
- **AND THEN** shows any error messages

#### Scenario: Export request

- **WHEN** a user clicks "Export"
- **THEN** the request data is downloaded as JSON
- **AND THEN** includes original, modified, and metadata

#### Scenario: Replay request

- **WHEN** a user clicks "Replay"
- **THEN** the original request is sent through the gateway again
- **AND THEN** the user sees the new result

### Requirement: Diff Viewer Component

The system SHALL provide a visual diff showing changes between original and modified requests.

#### Scenario: Side-by-side comparison

- **WHEN** viewing request detail
- **AND WHEN** there are differences
- **THEN** the system shows original on left, modified on right
- **AND THEN** highlights added lines in green
- **AND THEN** highlights removed lines in red
- **AND THEN** highlights modified lines in yellow

#### Scenario: JSON formatting

- **WHEN** request bodies are JSON
- **THEN** they are pretty-printed
- **AND THEN** syntax highlighting is applied
- **AND THEN** collapsible tree view is available

#### Scenario: No differences

- **WHEN** a request had no rule matches
- **THEN** the diff viewer shows "No changes" message
- **AND THEN** indicates the request passed through unchanged

### Requirement: Preview/Sandbox Page

The system SHALL provide a testing environment for rules without affecting live requests.

#### Scenario: Test input

- **WHEN** a user navigates to Preview page
- **THEN** they can enter or paste a test request body
- **AND THEN** select which rules to apply
- **AND THEN** see the results immediately

#### Scenario: Step-by-step execution

- **WHEN** multiple rules are applied
- **THEN** the user can see each rule's effect
- **AND THEN** understand the transformation chain

#### Scenario: Rule selection

- **WHEN** a user wants to test specific rules
- **THEN** they can toggle individual rules on/off
- **AND THEN** see how different rule combinations work

### Requirement: Settings/Configuration Page

The system SHALL provide a page to manage overall configuration.

#### Scenario: View configuration

- **WHEN** a user navigates to Settings page
- **THEN** they see current configuration
- **AND THEN** includes upstream URLs, storage settings, debug mode

#### Scenario: Edit configuration

- **WHEN** a user modifies settings
- **THEN** changes are saved to backend
- **AND THEN** take effect immediately

#### Scenario: Export configuration

- **WHEN** a user clicks "Export Config"
- **THEN** all rules and settings are downloaded as JSON
- **AND THEN** can be shared or backed up

#### Scenario: Import configuration

- **WHEN** a user selects a config file to import
- **THEN** the system validates the file
- **AND THEN** merges or replaces existing config
- **AND THEN** updates the UI immediately

#### Scenario: Data cleanup

- **WHEN** a user clicks "Cleanup Old Data"
- **THEN** the system removes old request records
- **AND THEN** shows how many records were deleted

### Requirement: Real-time Status Indicator

The system SHALL provide visual feedback for SSE connection status.

#### Scenario: Connected status

- **WHEN** SSE connection is active
- **THEN** a green indicator shows "Live"
- **AND THEN** new requests appear immediately

#### Scenario: Disconnected status

- **WHEN** SSE connection is lost
- **THEN** a red indicator shows "Disconnected"
- **AND THEN** a "Reconnect" button is available
- **AND THEN** users can still view existing data

#### Scenario: Connecting status

- **WHEN** attempting to connect
- **THEN** a yellow indicator shows "Connecting"
- **AND THEN** the system attempts automatic reconnection

### Requirement: Empty State Handling

The system SHALL provide helpful empty states for all views.

#### Scenario: No rules exist

- **WHEN** the Rules page has no rules
- **THEN** it shows "No rules yet" message
- **AND THEN** provides a "Create Your First Rule" button
- **AND THEN** includes a link to documentation

#### Scenario: No requests yet

- **WHEN** the Requests page has no history
- **THEN** it shows "No requests captured" message
- **AND THEN** explains how to start using the gateway
- **AND THEN** provides configuration examples

#### Scenario: Search returns no results

- **WHEN** a search or filter yields no matches
- **THEN** it shows "No results found"
- **AND THEN** provides options to clear filters

### Requirement: Responsive Layout

The system SHALL adapt to different screen sizes for desktop use.

#### Scenario: Desktop view

- **WHEN** viewing on wide screen
- **THEN** three-column layout is used (sidebar, main, detail)
- **AND THEN** all information is visible at once

#### Scenario: Tablet/Desktop view

- **WHEN** viewing on smaller desktop or tablet window
- **THEN** layout collapses to two columns
- **AND THEN** detail panel becomes a modal

#### Scenario: Compact view

- **WHEN** viewing on narrow desktop window
- **THEN** single column layout
- **AND THEN** navigation uses collapsible menu
- **AND THEN** modals for all detailed views

### Requirement: Loading States

The system SHALL show loading indicators during async operations.

#### Scenario: Initial page load

- **WHEN** a page is loading data
- **THEN** skeleton loaders appear
- **AND THEN** content fades in when ready

#### Scenario: Action feedback

- **WHEN** a user performs an action (save, delete, etc.)
- **THEN** a loading spinner appears
- **AND THEN** success/error toast notification appears
- **AND THEN** the UI updates appropriately

### Requirement: Error Handling

The system SHALL gracefully handle and display errors.

#### Scenario: API connection failure

- **WHEN** the frontend cannot reach the backend
- **THEN** a clear error message is shown
- **AND THEN** provides retry button
- **AND THEN** explains common causes

#### Scenario: Invalid data

- **WHEN** the backend returns unexpected data
- **THEN** the UI shows "Data load failed"
- **AND THEN** provides options to refresh

#### Scenario: Action failure

- **WHEN** a save/delete operation fails
- **THEN** an error toast appears
- **AND THEN** the error message is specific and actionable

### Requirement: Keyboard Navigation

The system SHALL support keyboard shortcuts for common actions.

#### Scenario: Global shortcuts

- **WHEN** a user presses `Ctrl+K` (or `Cmd+K`)
- **THEN** a command palette opens
- **AND THEN** users can navigate to any page

#### Scenario: Modal shortcuts

- **WHEN** a modal is open
- **THEN** `Esc` closes the modal
- **AND THEN** `Enter` submits forms

### Requirement: Theme Support

The system SHALL support light and dark themes.

#### Scenario: Theme toggle

- **WHEN** a user clicks the theme toggle
- **THEN** the entire UI switches theme
- **AND THEN** the preference is saved
- **AND THEN** persists across sessions

#### Scenario: System preference

- **WHEN** no theme is manually selected
- **THEN** the UI matches the system preference
- **AND THEN** updates when the system theme changes

### Requirement: Data Export/Import

The system SHALL allow users to export and import all data.

#### Scenario: Export all data

- **WHEN** a user clicks "Export All"
- **THEN** a JSON file is downloaded
- **AND THEN** includes rules, config, and selected requests

#### Scenario: Import data

- **WHEN** a user selects a valid export file
- **THEN** the system validates the format
- **AND THEN** imports the data
- **AND THEN** shows import summary

### Requirement: Performance Optimization

The system SHALL handle large datasets efficiently.

#### Scenario: Large request history

- **WHEN** there are 1000+ requests
- **THEN** the list uses virtual scrolling
- **AND THEN** only visible items are rendered
- **AND THEN** scrolling remains smooth

#### Scenario: Large rule set

- **WHEN** there are 100+ rules
- **THEN** the list uses pagination or virtual scrolling
- **AND THEN** search remains responsive

#### Scenario: Frequent updates

- **WHEN** many requests arrive via SSE
- **THEN** the UI doesn't freeze
- **AND THEN** updates are batched if needed

### Requirement: Accessibility

The system SHALL be accessible to users with disabilities.

#### Scenario: Screen reader support

- **WHEN** using a screen reader
- **THEN** all interactive elements have proper labels
- **AND THEN** semantic HTML is used
- **AND THEN** ARIA attributes are applied where needed

#### Scenario: Keyboard-only navigation

- **WHEN** a user navigates with Tab
- **THEN** focus indicators are visible
- **AND THEN** all actions are keyboard-accessible
- **AND THEN** tab order is logical

#### Scenario: Color contrast

- **WHEN** viewing the UI
- **THEN** text meets WCAG AA contrast ratios
- **AND THEN** information is not conveyed by color alone

## MODIFIED Requirements

### Requirement: Quick Start Documentation

The system MUST provide a README.md file that enables users to start the service within 5 minutes, including installation, configuration, and basic verification steps.

#### Scenario: User installs and starts service

- **WHEN** a user reads the README.md
- **THEN** they can install dependencies, create config, and start the service in under 5 minutes
- **AND THEN** they know how to access the web UI

#### Scenario: User verifies service is running

- **WHEN** the service is started
- **THEN** the user can verify it's working via health endpoint
- **AND THEN** they can access the web UI at `http://localhost:7071`

### Requirement: CLI Configuration Examples

The system SHALL provide complete configuration examples for Claude Code, Codex CLI, and Gemini CLI to use the local gateway.

#### Scenario: Configure Claude Code

- **WHEN** a user wants to use promptxy with Claude Code
- **THEN** they find exact commands to set `ANTHROPIC_BASE_URL` to point to localhost
- **AND THEN** the documentation explains the full flow (CLI → Gateway → UI)

#### Scenario: Configure Codex CLI

- **WHEN** a user wants to use promptxy with Codex CLI
- **THEN** they find exact commands to set `OPENAI_BASE_URL`
- **AND THEN** understand how requests appear in the UI

#### Scenario: Configure Gemini CLI

- **WHEN** a user wants to use promptxy with Gemini CLI
- **THEN** they find exact commands for Gemini API
- **AND THEN** see how to monitor requests in real-time

### Requirement: Configuration File Template

The system MUST provide a complete, valid `promptxy.config.json.example` file that demonstrates all supported configuration options with comments.

#### Scenario: User creates configuration

- **WHEN** a user copies the example config file
- **THEN** they have a valid starting point with all required fields
- **AND THEN** the config includes storage settings for request history

#### Scenario: User understands config options

- **WHEN** a user reads the example config
- **THEN** they understand what each field does through inline comments
- **AND THEN** they see examples of rules that work with the UI

### Requirement: Detailed Usage Guide

The system SHALL provide a comprehensive usage guide covering:

- How rules work and their syntax
- Common use cases with examples
- Troubleshooting common issues
- Debug mode usage
- **Web UI features and workflows**

#### Scenario: User learns web UI

- **WHEN** a user reads the usage guide
- **THEN** they understand how to navigate the UI
- **AND THEN** they know how to create rules visually
- **AND THEN** they can interpret request history

#### Scenario: User troubleshoots UI issues

- **WHEN** the web UI doesn't work
- **THEN** the guide helps diagnose common problems
- **AND THEN** explains how to check backend connectivity
- **AND THEN** provides solutions for SSE connection issues

### Requirement: Security Best Practices Documentation

The system MUST document security considerations including localhost-only binding, credential handling, and sensitive header filtering.

#### Scenario: User understands web UI security

- **WHEN** a user reads security documentation
- **THEN** they understand the web UI is also localhost-only
- **AND THEN** they know request data is stored locally
- **AND THEN** they understand data retention policies

### Requirement: Health Check Documentation

The system MUST document the health check endpoint and how to use it for monitoring.

#### Scenario: User monitors service health

- **WHEN** they need to check if service is running
- **THEN** they can use the health endpoint
- **AND THEN** the web UI shows connection status
- **AND THEN** they can diagnose issues

## REMOVED Requirements

### Requirement: Minimal UI (from design docs)

**Reason**: The original design suggested minimal UI components. This is replaced by comprehensive HeroUI-based interface.

**Migration**: All UI components are built with HeroUI for consistency and professional appearance.

### Requirement: Simple Modal-only Views (from design docs)

**Reason**: Original design used modals for everything. This is enhanced with dedicated pages for better UX.

**Migration**: Rules and Requests have dedicated pages with modals for details/editing.

### Requirement: Manual Refresh Only (from design docs)

**Reason**: Original design required manual refresh. This is replaced by SSE-based real-time updates.

**Migration**: UI automatically updates via SSE, with manual refresh as fallback.
