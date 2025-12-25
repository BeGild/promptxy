## ADDED Requirements

### Requirement: Rule Matching

The system SHALL support applying prompt mutation rules based on request context, including at minimum the client type and the target field to mutate.

#### Scenario: Rule matches by client and field

- **WHEN** a rule is configured for client `codex` and field `instructions`
- **AND WHEN** a Codex request includes an `instructions` field
- **THEN** the rule is applied to that field

### Requirement: Ordered Operations

The system SHALL apply operations in rule order, and operations within a rule in declared order, producing deterministic output.

#### Scenario: Operations run deterministically

- **WHEN** two operations are defined in a rule (e.g., replace then append)
- **THEN** the final output reflects the declared order

### Requirement: CRUD Operations on Prompt Text

The system SHALL support prompt text CRUD operations, including replace, delete, prepend, append, insert-before, insert-after, and set.

#### Scenario: Replace operation updates matched text

- **WHEN** a replace operation targets a substring or regex match
- **THEN** the matched text is replaced in the output

#### Scenario: Delete operation removes matched text

- **WHEN** a delete operation targets a substring or regex match
- **THEN** the matched text is removed from the output

#### Scenario: Append operation adds suffix text

- **WHEN** an append operation is configured
- **THEN** the output ends with the appended text

### Requirement: Safe No-Op Behavior

The system MUST behave as a no-op when no rules match or when a target field is missing, and it MUST still forward the request.

#### Scenario: Missing target field does not break request

- **WHEN** a request does not include the configured target prompt field
- **THEN** the system forwards the request unchanged
