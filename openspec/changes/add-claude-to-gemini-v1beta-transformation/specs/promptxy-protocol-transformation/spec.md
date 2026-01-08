## ADDED Requirements

### Requirement: Gemini v1beta Upstream Targeting

When a route/supplier selects the `claude → gemini(v1beta)` transformer, the system MUST target the standard Gemini API v1beta endpoints (API Key mode):

- non-stream: `POST /v1beta/models/{model}:generateContent`
- stream: `POST /v1beta/models/{model}:streamGenerateContent?alt=sse`
- countTokens (optional but recommended): `POST /v1beta/models/{model}:countTokens`

The system MUST emit trace evidence of the final upstream action, query params, and auth injection strategy.

#### Scenario: Streaming requests always include alt=sse

- **WHEN** a downstream Claude request sets `stream=true`
- **THEN** the upstream request uses `:streamGenerateContent`
- **AND THEN** the upstream request query includes `alt=sse`

#### Scenario: Non-stream requests use generateContent

- **WHEN** a downstream Claude request sets `stream=false` (or omits stream)
- **THEN** the upstream request uses `:generateContent`

### Requirement: Gemini baseUrl Compatibility

The system MUST support two supplier `baseUrl` shapes for Gemini v1beta:

1. `https://generativelanguage.googleapis.com`
2. `https://generativelanguage.googleapis.com/v1beta/models`

The system MUST construct the final upstream path correctly in both cases and MUST record the chosen mode in trace.

#### Scenario: baseUrl without /v1beta/models is expanded

- **GIVEN** supplier `baseUrl` is `https://generativelanguage.googleapis.com`
- **WHEN** targeting model `gemini-2.5-flash`
- **THEN** the upstream path starts with `/v1beta/models/gemini-2.5-flash:`

#### Scenario: baseUrl ending with /v1beta/models is used directly

- **GIVEN** supplier `baseUrl` ends with `/v1beta/models`
- **WHEN** targeting model `gemini-2.5-flash`
- **THEN** the upstream path starts with `/gemini-2.5-flash:`

### Requirement: Gemini Authentication Injection (key preferred)

When sending requests to Gemini v1beta (API Key mode), the system MUST prefer query-string authentication:

- `?key=<API_KEY>`

The system MAY additionally set `x-goog-api-key: <API_KEY>` as a compatibility fallback, but MUST NOT rely on it as the only mechanism unless explicitly configured.

Secrets MUST NOT appear in preview, trace, or request history in plaintext.

#### Scenario: Query key authentication is applied

- **GIVEN** a supplier provides a Gemini API key
- **WHEN** an upstream Gemini request is built
- **THEN** the outgoing URL includes `key=` (redacted in trace)

### Requirement: Header Mapping (Claude SDK → Gemini)

The transformer MUST remove Claude/SDK-specific headers before forwarding upstream to Gemini, including:

- any `anthropic-*` headers
- any `x-stainless-*` headers
- `x-api-key` (Claude API key)

The transformer MUST preserve generic headers as safe defaults (e.g., `user-agent`) and MUST ensure `content-type: application/json`.

#### Scenario: anthropic and stainless headers are stripped

- **GIVEN** a downstream request includes `anthropic-version` and `x-stainless-runtime`
- **WHEN** the request is transformed for Gemini
- **THEN** those headers are not forwarded upstream

### Requirement: Model Mapping (Claude → Gemini)

The system MUST map the downstream Claude `model` into an upstream Gemini `{model}` path segment using explicit route configuration (e.g., `claudeModelMap`), and MUST NOT perform fuzzy matching.

#### Scenario: Exact model tier mapping is used

- **WHEN** a downstream request selects a Claude model tier (e.g., sonnet)
- **THEN** the transformer picks the configured Gemini model name for that tier
- **AND THEN** it uses that name in the upstream URL path

### Requirement: systemInstruction Role and Content

The transformer MUST map downstream Claude `system` into Gemini `systemInstruction.parts[].text`.

The transformer MUST set `systemInstruction.role` to `"user"` for v1, and MUST record this decision in trace.

#### Scenario: System is normalized into systemInstruction text

- **WHEN** a Claude request contains system text (string or blocks)
- **THEN** the upstream Gemini request includes `systemInstruction.parts[0].text` with the normalized content

### Requirement: Messages and Tool Interactions Mapping (Claude ↔ Gemini parts)

The transformer MUST map Claude messages to Gemini `contents[]` using:

- role mapping: `user → user`, `assistant → model`
- text blocks as `{ text }` parts
- tool calls and results as `{ functionCall }` and `{ functionResponse }` parts as needed to preserve the tool loop semantics

#### Scenario: Assistant tool_use becomes an upstream functionCall part

- **GIVEN** a Claude assistant message contains a `tool_use` block
- **WHEN** the request is transformed for Gemini
- **THEN** the corresponding Gemini content contains a `functionCall` part with the same tool name and input args

#### Scenario: tool_result becomes an upstream functionResponse part

- **GIVEN** a Claude user message contains a `tool_result` block with `tool_use_id`
- **WHEN** the request is transformed for Gemini
- **THEN** the corresponding Gemini content contains a `functionResponse` part
- **AND THEN** `functionResponse.id == tool_use_id`

### Requirement: Tool Use ID Generation (Claude Code compatibility)

When emitting Claude `tool_use` blocks (non-stream or SSE) from Gemini `functionCall`, the transformer MUST generate `tool_use.id` values in a Claude Code compatible shape:

- the id MUST start with `toolu_`
- ids MUST be unique within a single response stream

#### Scenario: Generated tool_use id starts with toolu_

- **WHEN** Gemini produces a `functionCall` without a stable id
- **THEN** the transformer emits a Claude `tool_use` with an id that starts with `toolu_`

### Requirement: Tool Schema Sanitization for Gemini

When mapping Claude tools to Gemini `functionDeclarations`, the transformer MUST sanitize JSON Schema to improve upstream acceptance and to avoid pathological schemas.

At minimum, the sanitizer MUST:

- apply a whitelist for supported schema keywords
- filter unsupported `string.format` values (removing or downgrading them)
- detect cycles / excessive depth and fail fast with an actionable error
- record removed field paths and warnings in trace/audit

#### Scenario: Unsupported format is removed and audited

- **GIVEN** a tool schema contains a `format` not in the allowed list
- **WHEN** the tool schema is transformed for Gemini
- **THEN** the field is removed (or downgraded) and a warning is recorded in audit

### Requirement: Gemini Response (non-stream) to Claude Response

When `stream=false`, the transformer MUST map Gemini JSON responses into a Claude Messages response:

- candidates selection: use `candidates[0]`
- parts mapping:
  - `text` parts → Claude `text` blocks (merged if adjacent)
  - `functionCall` parts → Claude `tool_use` blocks
- `usageMetadata` → Claude `usage` (`input_tokens`, `output_tokens`)

The transformer MUST NOT forward Gemini “thought” parts to the client, but MUST record their presence in trace.

#### Scenario: Adjacent text parts are consolidated

- **GIVEN** Gemini returns multiple adjacent `text` parts
- **WHEN** the response is transformed to Claude
- **THEN** the Claude response contains a single combined text block

### Requirement: Gemini SSE to Claude SSE (streaming)

When `stream=true`, the transformer MUST parse Gemini SSE and emit Anthropic-compatible SSE events, including:

- `message_start`
- `content_block_start` / `content_block_delta` / `content_block_stop`
- `message_delta`
- `message_stop`

For tool calls, the transformer MUST emit a Claude Code consumable tool sequence:

1. `content_block_start` (type=`tool_use`)
2. one or more `content_block_delta` with `delta.type="input_json_delta"`
3. `content_block_stop`
4. `message_delta` to trigger the next tool loop step

#### Scenario: Streaming tool call produces Claude tool_use event sequence

- **WHEN** a Gemini stream yields a `functionCall` part
- **THEN** the output stream contains the Claude SSE tool_use sequence
- **AND THEN** the tool_use id is stable for the subsequent tool_result

### Requirement: Streaming usageMetadata Accumulation

The transformer MUST support `usageMetadata` appearing in multiple Gemini stream chunks by accumulating/merging usage evidence and emitting a final Claude `message_delta.usage` before `message_stop` when available.

#### Scenario: usageMetadata in multiple chunks is merged

- **GIVEN** a Gemini stream includes `usageMetadata` in multiple chunks
- **WHEN** the stream ends
- **THEN** the final Claude `message_delta` includes merged token counts (when present)

### Requirement: finishReason Mapping (Gemini → Claude)

The transformer MUST map Gemini `finishReason` into Claude `stop_reason` deterministically, defaulting to `end_turn` for unknown values.

The transformer MUST record warning/error severity for safety and malformed-tool related reasons in trace.

#### Scenario: MAX_TOKENS maps to max_tokens

- **WHEN** Gemini finishReason is `MAX_TOKENS`
- **THEN** Claude stop_reason is `max_tokens`

### Requirement: Streaming Error Format (Gemini → Claude SSE)

When Gemini streaming fails (HTTP error or invalid stream semantics), the transformer MUST emit Claude-compatible SSE error output:

1. `event: error` with JSON `{ type, message }`
2. `event: done` (to terminate the stream for Claude clients)

#### Scenario: Stream error terminates with error + done

- **WHEN** an upstream Gemini stream returns an error
- **THEN** the downstream receives `event: error`
- **AND THEN** the stream ends with `event: done`

### Requirement: count_tokens Compatibility (optional but recommended)

If the gateway exposes `/v1/messages/count_tokens` for Claude clients, the transformer MUST support converting it to Gemini `:countTokens` and mapping the response back to Claude `{ input_tokens }`.

If upstream `:countTokens` fails, the system MAY fall back to a local estimate, but MUST record fallback usage in trace.

#### Scenario: count_tokens falls back with trace evidence

- **WHEN** Gemini `:countTokens` fails
- **THEN** the system returns a local estimate
- **AND THEN** trace indicates `count_tokens_fallback=true`
