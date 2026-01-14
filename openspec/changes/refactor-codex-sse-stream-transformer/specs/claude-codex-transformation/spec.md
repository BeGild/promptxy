## MODIFIED Requirements

### Requirement: SSE Event Transformation

The system SHALL unify the Codex SSE → Claude SSE streaming transformation implementation so that the streaming gateway path uses the same state machine as the protocol transformer, and MUST emit Claude-client-compatible event shapes.

#### Scenario: Gateway uses unified SSE transformer

- **WHEN** a client sends a streaming request to `POST /claude/v1/messages`
- **AND** the upstream protocol is `openai` (Codex Responses SSE)
- **THEN** the gateway uses the unified Codex SSE → Claude SSE transformer (protocol state machine)
- **AND** the legacy inline Codex SSE transformer implementation is NOT used

#### Scenario: message_start includes stable id and initial usage

- **WHEN** the first Codex SSE event is received
- **AND** a `response.created` event with an `id` is available
- **THEN** the emitted `message_start.message.id` equals that `response.created.id`
- **AND** the emitted `message_start.message.usage` includes `input_tokens: 0` and `output_tokens: 0`

#### Scenario: message_start emits ping for compatibility

- **WHEN** the transformer emits the initial `message_start` and `content_block_start(index=0,type=text)`
- **THEN** the transformer also emits a single `ping` event immediately after

### Requirement: Enhanced Usage Information

The system SHALL include full Codex usage information in Claude `message_delta.usage` on completion, including input tokens, cached tokens, and reasoning tokens, so that Claude clients can perform context accounting and auto-compaction.

#### Scenario: Include input tokens in completion usage

- **WHEN** a `response.completed` Codex SSE event includes `usage.input_tokens`
- **THEN** the emitted Claude `message_delta.usage` includes `input_tokens` with the same value

#### Scenario: Include cached tokens in completion usage

- **WHEN** a `response.completed` Codex SSE event includes `usage.input_tokens_details.cached_tokens`
- **THEN** the emitted Claude `message_delta.usage` includes `cached_tokens` with the same value

#### Scenario: Include reasoning tokens in completion usage

- **WHEN** a `response.completed` Codex SSE event includes `usage.output_tokens_details.reasoning_tokens`
- **THEN** the emitted Claude `message_delta.usage` includes `reasoning_tokens` with the same value
