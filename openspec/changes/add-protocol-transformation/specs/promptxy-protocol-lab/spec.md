## ADDED Requirements

### Requirement: Protocol Lab Workspace

The system SHALL provide a dedicated UI workspace ("Protocol Lab") that allows users to validate protocol transformation behavior for a selected supplier.

The Protocol Lab MUST prioritize verifiability over visualization: preview and trace are first-class; canvas-based mapping is out of scope for v1.

#### Scenario: User selects a supplier and runs a preview

- **WHEN** a user opens Protocol Lab
- **AND WHEN** they select a supplier and provide a sample request
- **THEN** the system displays a transformation preview and trace

### Requirement: Sample Request Input

The Protocol Lab SHALL provide an editor for sample downstream requests (Anthropic Messages), including:

- selecting from saved fixtures
- editing JSON content
- toggling streaming on/off

#### Scenario: User loads a fixture

- **WHEN** a user selects a fixture in Protocol Lab
- **THEN** the request editor is populated with the fixture content

### Requirement: Upstream Preview Output (Redacted)

The Protocol Lab MUST display an upstream request preview including method/path/headers/body.

Sensitive values (gateway token and upstream credentials) MUST be redacted by default in the UI output.

#### Scenario: Upstream auth is redacted in preview

- **WHEN** a preview is displayed for a supplier with `supplier.auth`
- **THEN** any upstream credentials are shown as redacted (not plaintext)

### Requirement: Transform Trace Display

The Protocol Lab SHALL display the transform trace including chain selection, step summaries, warnings, and errors.

#### Scenario: User can see why a model override was (not) used

- **WHEN** a preview is run with a given `model` value
- **THEN** the trace indicates whether an exact-match override was selected
- **AND THEN** warnings are shown when no override matches

#### Scenario: User can see which inbound auth header was used

- **WHEN** `gatewayAuth.enabled` is true
- **AND WHEN** the preview run authenticates successfully
- **THEN** the trace display shows `authHeaderUsed` as a header name only
- **AND THEN** the token value is never displayed

### Requirement: Copy/Export Utilities

The Protocol Lab SHALL provide copy/export utilities for:

- upstream request JSON
- cURL representation (best-effort)
- trace output

#### Scenario: User copies upstream request preview

- **WHEN** a user clicks "Copy" on the upstream preview
- **THEN** the preview content is copied to clipboard in a usable format
