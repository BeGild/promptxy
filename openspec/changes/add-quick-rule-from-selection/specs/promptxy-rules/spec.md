## ADDED Requirements

### Requirement: Rule Pre-Filling from Request Context

The rule editor SHALL support pre-filling rule fields from request context when creating rules based on selected content.

#### Scenario: Client and method are auto-filled

- **WHEN** a rule is created from a request
- **THEN** the `client` field is automatically set from the request's client type
- **AND** the `method` field is automatically set from the request's HTTP method
- **AND** the fields are editable after pre-filling

#### Scenario: Path regex is auto-filled from request path

- **WHEN** a rule is created from a request
- **THEN** the `pathRegex` field is automatically set to match the request path exactly
- **EXAMPLE**: for request path `/v1/messages`, the pathRegex is set to `^/v1/messages$`

#### Scenario: Model regex is extracted from request body

- **WHEN** a rule is created from a request
- **AND** the request body contains a `model` field
- **THEN** the `modelRegex` field is automatically set to match the model value exactly
- **EXAMPLE**: for `{"model": "claude-3-opus-20240229"}`, the modelRegex is set to `^claude-3-opus-20240229$`

#### Scenario: Model regex is omitted when model field is missing

- **WHEN** a rule is created from a request
- **AND** the request body does not contain a `model` field
- **THEN** the `modelRegex` field is left empty
- **AND** no error is raised

#### Scenario: Selected text regex is pre-filled

- **WHEN** a user creates a rule from selected text with a chosen match mode
- **THEN** the appropriate regex field is pre-filled with the generated pattern
- **AND** the pattern is based on the selected text and match mode
- **EXAMPLE**: selecting "gpt-4" with "Exact Match" mode pre-fills `^gpt-4$` to the target field

#### Scenario: Rule name is auto-generated from selection

- **WHEN** a rule is created from selected text
- **THEN** the rule name is auto-generated to indicate the selection-based origin
- **EXAMPLE**: name is set to "基于选中内容 \"gpt-4\" 的规则"

## MODIFIED Requirements

### Requirement: Rule Matching

The system SHALL support applying prompt mutation rules based on request context, including at minimum the client type, the target field to mutate, and optionally regex patterns for path and model matching.

#### Scenario: Rule matches by client and field

- **WHEN** a rule is configured for client `codex` and field `instructions`
- **AND WHEN** a Codex request includes an `instructions` field
- **THEN** the rule is applied to that field

#### Scenario: Rule matches by path regex

- **WHEN** a rule includes a `pathRegex` pattern
- **AND WHEN** a request's path matches the pattern
- **THEN** the rule is considered a match for the path condition
- **EXAMPLE**: pathRegex `^/v1/messages$` matches `/v1/messages` but not `/v1/completions`

#### Scenario: Rule matches by model regex

- **WHEN** a rule includes a `modelRegex` pattern
- **AND WHEN** a request's model field matches the pattern
- **THEN** the rule is considered a match for the model condition
- **EXAMPLE**: modelRegex `^gpt-4` matches both `gpt-4` and `gpt-4-turbo`

#### Scenario: All conditions must match for rule to apply

- **WHEN** a rule specifies multiple conditions (client, field, pathRegex, modelRegex)
- **AND WHEN** a request matches all specified conditions
- **THEN** the rule is applied
- **AND** if any condition does not match, the rule is not applied

### Requirement: Safe No-Op Behavior

The system MUST behave as a no-op when no rules match or when a target field is missing, and it MUST still forward the request.

#### Scenario: Missing target field does not break request

- **WHEN** a request does not include the configured target prompt field
- **THEN** the system forwards the request unchanged

#### Scenario: Invalid regex pattern does not break request processing

- **WHEN** a rule contains an invalid regex pattern in pathRegex or modelRegex
- **THEN** the system logs a warning
- **AND** the rule is skipped
- **AND** the request continues to be processed
