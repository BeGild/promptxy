## ADDED Requirements

### Requirement: Claude Count Tokens Endpoint

PromptXY 网关 SHALL provide support for the Claude `/v1/messages/count_tokens` API endpoint across all protocol transformers, enabling users to calculate token usage for messages before making generation requests.

**Scope**: The requirement covers the core capability to accept and process count_tokens requests, delegating to appropriate protocol-specific implementations while maintaining unified response formats.

#### Scenario: Codex transformer calculates tokens via upstream API

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with a Codex (OpenAI) supplier configured
- **AND** the upstream API supports count_tokens capability (detected via `/models` endpoint)
- **THEN** the gateway SHALL attempt to call the upstream count_tokens endpoint and return the precise token count from the API response

**Expected Result**:
```json
{
  "input_tokens": 1234,
  "_method": "tiktoken"
}
```

#### Scenario: Codex transformer falls back to local estimation

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with a Codex supplier configured
- **AND** the upstream API does NOT support count_tokens (or the detection call fails)
- **THEN** the gateway SHALL calculate tokens using local byte estimation (character count / 3) and return the result with fallback marker

**Expected Result**:
```json
{
  "input_tokens": 567,
  "_method": "estimate",
  "_fallback": true
}
```

#### Scenario: Gemini transformer reuses existing implementation

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with a Gemini supplier configured
- **THEN** the gateway SHALL delegate to the existing Gemini count_tokens transformer without any modifications

**Expected Result**:
```json
{
  "input_tokens": 89,
  "_method": "tiktoken"
}
```

**Note**: The `_fallback` field SHALL NOT be present for Gemini responses since it uses the existing tiktoken implementation.

#### Scenario: Anthropic supplier transparent forwarding

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with an Anthropic supplier configured (transformer=none)
- **THEN** the gateway SHALL transparently forward the request to the Anthropic API without any transformation

**Expected Result**:
```json
{
  "input_tokens": 234
}
```

**Note**: No `_method` or `_fallback` fields shall be present since Anthropic handles the request natively.

#### Scenario: Invalid request validation

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request without the required `messages` field
- **THEN** the gateway SHALL return a 400 error response

**Expected Result**:
```json
{
  "error": "invalid_request",
  "message": "messages is required and must be an array"
}
```

#### Scenario: System field in string format

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with `system` as a string
- **THEN** the gateway SHALL include the system tokens in the total calculation

**Expected Result**:
```json
{
  "input_tokens": 150,
  "_method": "estimate",
  "_fallback": true
}
```

#### Scenario: System field in array format

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with `system` as an array of content blocks
- **THEN** the gateway SHALL iterate through blocks and include only text blocks in the calculation

**Expected Result**:
```json
{
  "input_tokens": 200,
  "_method": "estimate",
  "_fallback": true
}
```

#### Scenario: Messages with complex content blocks

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with messages containing mixed content blocks (text, tool_use, tool_result)
- **THEN** the gateway SHALL calculate tokens for each block type:
  - `text`: count characters
  - `tool_use`: count characters in JSON stringified input
  - `tool_result`: count characters in stringified content

**Expected Result**:
```json
{
  "input_tokens": 345,
  "_method": "estimate",
  "_fallback": true
}
```

#### Scenario: Tools field provided

- **WHEN** a client sends a `POST /v1/messages/count_tokens` request with `tools` array
- **THEN** the gateway SHALL include tool tokens (name + description + input_schema JSON) in the total calculation

**Expected Result**:
```json
{
  "input_tokens": 89,
  "_method": "estimate",
  "_fallback": true
}
```

#### Scenario: Mixed system, messages, and tools

- **WHEN** a client sends a complete `POST /v1/messages/count_tokens` request with all optional fields (system, messages, tools)
- **THEN** the gateway SHALL calculate the sum of tokens from all three components

**Expected Result**:
```json
{
  "input_tokens": 789,
  "_method": "estimate",
  "_fallback": true
}
```

#### Scenario: Concurrent requests for identical content

- **WHEN** multiple clients send identical `POST /v1/messages/count_tokens` requests concurrently
- **AND** a caching mechanism is implemented (optional, planned enhancement)
- **THEN** the gateway SHALL return cached results for requests after the first one to improve performance

**Expected Result**:
- First request: `{ "input_tokens": 456, "_method": "estimate", "_fallback": true }`
- Second request (same content): `{ "input_tokens": 456, "_method": "estimate", "_fallback": true, "_cache_used": true }`

**Note**: Caching is optional and marked by the `_cache_used` field.

#### Scenario: Upstream API detection failure

- **WHEN** the gateway attempts to detect upstream count_tokens support via `/models` endpoint
- **AND** the detection request fails (network error, timeout, or malformed response)
- **THEN** the gateway SHALL log the error and fall back to local estimation without retrying detection

**Expected Result**:
```json
{
  "input_tokens": 123,
  "_method": "estimate",
  "_fallback": true
}
```

**Log Output Example**:
```
WARN: Upstream count_tokens detection failed for supplier xyz: Network timeout
INFO: Falling back to local token estimation
```
