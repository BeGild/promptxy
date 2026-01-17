## ADDED Requirements

### Requirement: Claude → OpenAI Chat Request Transformation

The system SHALL transform Claude Messages API requests into OpenAI Chat Completions request format.

#### Scenario: Map system to OpenAI system message
- **WHEN** Claude request contains `system`
- **THEN** OpenAI request includes a `role=system` message with equivalent text

#### Scenario: Map tools to OpenAI tools
- **WHEN** Claude request includes `tools` with `input_schema`
- **THEN** OpenAI request includes `tools[].type=function` and `function.parameters` derived from `input_schema`

#### Scenario: Map tool_choice any to auto
- **WHEN** Claude tool_choice is `any`
- **THEN** OpenAI tool_choice is `auto`

### Requirement: OpenAI Chat → Claude Response Transformation

The system SHALL transform OpenAI Chat Completions responses into Claude Messages API responses.

#### Scenario: Map assistant content to Claude text block
- **WHEN** OpenAI response contains `choices[0].message.content`
- **THEN** Claude response contains `content[0].type=text` with same text

#### Scenario: Map tool_calls to tool_use blocks
- **WHEN** OpenAI response contains `choices[0].message.tool_calls`
- **THEN** Claude response contains `tool_use` blocks preserving `id` and `name`

### Requirement: SSE Event Transformation

The system SHALL transform OpenAI Chat streaming events into Claude SSE events.

#### Scenario: Emit message_start and content_block_start
- **WHEN** the first OpenAI SSE delta is received
- **THEN** the system emits Claude `message_start` and `content_block_start`

#### Scenario: Incrementally append tool_calls arguments
- **WHEN** OpenAI SSE emits incremental `delta.tool_calls[*].function.arguments`
- **THEN** the system emits Claude `input_json_delta` with `partial_json` segments in order

#### Scenario: Map finish_reason
- **WHEN** OpenAI finish_reason is `tool_calls`
- **THEN** Claude stop_reason is `tool_use`
- **WHEN** OpenAI finish_reason is `stop`
- **THEN** Claude stop_reason is `end_turn`
- **WHEN** OpenAI finish_reason is `length`
- **THEN** Claude stop_reason is `max_tokens`
