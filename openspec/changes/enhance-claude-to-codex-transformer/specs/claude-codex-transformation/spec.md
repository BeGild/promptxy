# claude-codex-transformation Specification

## Purpose

定义 Claude Messages API 到 Codex Responses API 的协议转换规范，确保 Claude Code 客户端能够通过 PromptXY 网关完整使用 Codex 上游的能力。

## Requirements

### Requirement: Message Transformation

The system SHALL transform Claude Messages API requests into Codex Responses API format.

#### Scenario: Transform user message to input_text

- **WHEN** a Claude message has role `user` and contains text content
- **THEN** the system creates a Codex `message` item with role `user`
- **AND** the content is an `input_text` item with the text value

#### Scenario: Transform assistant message to output_text

- **WHEN** a Claude message has role `assistant` and contains text content
- **THEN** the system creates a Codex `message` item with role `assistant`
- **AND** the content is an `output_text` item with the text value

#### Scenario: Transform tool_use to function_call

- **WHEN** a Claude content block has type `tool_use`
- **THEN** the system creates a Codex `function_call` item
- **AND** the `call_id` is preserved
- **AND** the `name` is preserved
- **AND** the `input` is serialized to a JSON string as `arguments`

#### Scenario: Transform tool_result to function_call_output

- **WHEN** a Claude content block has type `tool_result`
- **THEN** the system creates a Codex `function_call_output` item
- **AND** the `tool_use_id` is mapped to `call_id`
- **AND** the `content` is preserved as `output` (stringified if object)

### Requirement: Tool Schema Transformation

The system SHALL transform Claude tool definitions to Codex tool format with schema pruning.

#### Scenario: Prune incompatible schema fields

- **WHEN** transforming a Claude tool to Codex format
- **THEN** the system removes fields: `$schema`, `format`, `title`, `examples`, `default`
- **AND** sets `additionalProperties` to `false`
- **AND** ensures `required` contains all property keys

#### Scenario: Handle AskUserQuestion answers field

- **WHEN** the tool name is `AskUserQuestion`
- **THEN** the system removes the `answers` property from input schema
- **AND** removes `answers` from the `required` array

### Requirement: SSE Event Transformation

The system SHALL transform Codex SSE events to Claude SSE events in streaming mode.

#### Scenario: Send message_start on first event

- **WHEN** the first Codex SSE event is received
- **THEN** the system sends a `message_start` event
- **AND** sends a `content_block_start` event with index 0 and type `text`

#### Scenario: Transform text delta

- **WHEN** a `response.output_text.delta` event is received
- **THEN** the system sends a `content_block_delta` event
- **AND** the delta type is `text_delta`
- **AND** the delta text matches the received text

#### Scenario: Transform tool call

- **WHEN** a `response.output_item.done` event with item type `function_call` is received
- **THEN** the system sends `content_block_start` with type `tool_use`
- **AND** sends `content_block_delta` with `input_json_delta`
- **AND** sends `content_block_stop`
- **AND** sends `message_delta` with `stop_reason` set to `tool_use`

#### Scenario: Send message_stop on completion

- **WHEN** a `response.completed` event is received
- **THEN** the system sends `content_block_stop` for index 0
- **AND** sends `message_stop`

## ADDED Requirements

### Requirement: Reasoning Content Transformation

The system SHALL transform Codex reasoning SSE events to Claude thinking blocks.

#### Scenario: Transform reasoning_text_delta to thinking block

- **WHEN** a `response.reasoning_text.delta` event is received
- **AND** no reasoning block has been started
- **THEN** the system sends `content_block_start` with type `thinking`
- **AND** sends `content_block_delta` with `thinking_delta` type

#### Scenario: Transform reasoning summary

- **WHEN** a `response.reasoning_summary_text.delta` event is received
- **THEN** the system sends `content_block_delta` with `thinking_delta` type
- **AND** includes the summary text

#### Scenario: Track reasoning block state

- **WHEN** reasoning events are received
- **THEN** the system maintains `reasoningBlockStarted` state
- **AND** maintains `currentReasoningIndex` for proper block tracking

### Requirement: Image Content Transformation

The system SHALL transform Claude image blocks to Codex input_image items.

#### Scenario: Transform image block to input_image

- **WHEN** a Claude content block has type `image`
- **THEN** the system creates a Codex `input_image` item
- **AND** the `source` field is preserved with type and url

#### Scenario: Handle base64 image data

- **WHEN** the image source contains base64 data URL
- **THEN** the system preserves the data URL format
- **AND** Codex receives the complete base64 image data

### Requirement: Stop Reason Mapping

The system SHALL map Codex finish_reason values to Claude stop_reason values.

#### Scenario: Map tool_calls to tool_use

- **WHEN** Codex finish_reason is `tool_calls`
- **THEN** Claude stop_reason is set to `tool_use`

#### Scenario: Map stop to end_turn

- **WHEN** Codex finish_reason is `stop`
- **THEN** Claude stop_reason is set to `end_turn`

#### Scenario: Map length to max_tokens

- **WHEN** Codex finish_reason is `length`
- **THEN** Claude stop_reason is set to `max_tokens`

#### Scenario: Default unknown reasons to end_turn

- **WHEN** Codex finish_reason is `null`, `content_filter`, or any other value
- **THEN** Claude stop_reason defaults to `end_turn`

### Requirement: Enhanced Usage Information

The system SHALL include detailed token usage information in Claude events.

#### Scenario: Include cached tokens in usage

- **WHEN** Codex response includes `input_tokens_details.cached_tokens`
- **THEN** Claude `message_delta` event includes `cached_tokens` in usage

#### Scenario: Include reasoning tokens in usage

- **WHEN** Codex response includes `output_tokens_details.reasoning_tokens`
- **THEN** Claude `message_delta` event includes `reasoning_tokens` in usage

#### Scenario: Handle non-streaming response usage

- **WHEN** transforming a non-streaming response
- **THEN** the response includes enhanced usage fields when available
- **AND** cached_tokens and reasoning_tokens are optional
