## MODIFIED Requirements

### Requirement: Transform Trace and Diagnostics

The system SHALL extend the transform trace to include field-level audit evidence sufficient for debugging and replay, not just step-level summaries.

The trace MUST remain safe-by-default and MUST NOT include plaintext secrets (gateway tokens or upstream credentials).

#### Scenario: Trace includes field-level audit summary

- **WHEN** a request is transformed across protocols
- **THEN** the trace includes a FieldAudit summary including:
  - `missingRequiredTargetPaths`
  - `extraTargetPaths`
  - `unmappedSourcePaths`
  - `defaulted` entries (path + source + reason)
- **AND THEN** the audit uses a stable path representation (JSON Pointer)

#### Scenario: Audit never leaks secrets

- **WHEN** a supplier or gateway auth is configured with secrets
- **THEN** the audit/trace does not include any plaintext secret value

## ADDED Requirements

### Requirement: Canonical Transformation Implementation (Rewrite)

For the `/claude → /codex` v1 target path, the system SHALL have exactly one canonical protocol transformation implementation.

Any legacy/previous transformer implementation for this path MUST be removed after cutover to avoid divergence and accidental use of an out-of-spec behavior.

#### Scenario: No dual transformation code path exists after cutover

- **GIVEN** the v1 Codex transformation pipeline is enabled
- **WHEN** the gateway processes Claude requests to Codex
- **THEN** requests and streaming responses are handled by the canonical Pipeline implementation
- **AND THEN** there is no remaining legacy implementation that can be selected implicitly

### Requirement: Codex Request Validation (missing=error, extra=ok)

When transforming to Codex Responses (`POST /v1/responses`), the system MUST validate that required fields and types are present before sending upstream.

Extra fields are allowed, but MUST be reported in FieldAudit.

#### Scenario: Missing required Codex fields yields an actionable error

- **GIVEN** a request is being transformed to Codex Responses format
- **WHEN** a required target field is missing or has an invalid type
- **THEN** the system aborts the request before upstream forwarding
- **AND THEN** the error response includes `missingRequiredTargetPaths` for debugging

#### Scenario: Extra target fields are allowed but audited

- **WHEN** the transformed Codex request contains fields not required for v1
- **THEN** the request is still forwarded (extra fields OK)
- **AND THEN** `extraTargetPaths` is populated in FieldAudit

### Requirement: Tool Call Mapping (Claude blocks → Codex input[] symmetry)

The system MUST map Claude tool interactions into Codex `input[]` items while enforcing call/output symmetry:

- `tool_use` → `function_call` (`arguments` is a JSON string)
- `tool_result` → `function_call_output`

#### Scenario: tool_use maps to function_call with JSON string arguments

- **GIVEN** a Claude message contains a `tool_use` block with `{ id, name, input }`
- **WHEN** the request is transformed to Codex
- **THEN** the output `input[]` contains a `function_call` with:
  - `call_id == tool_use.id`
  - `name == tool_use.name`
  - `arguments` as a JSON string derived from `tool_use.input`

#### Scenario: tool_result maps to function_call_output and preserves call_id

- **GIVEN** a Claude message contains a `tool_result` block with `tool_use_id`
- **WHEN** the request is transformed to Codex
- **THEN** the output `input[]` contains a `function_call_output` with `call_id == tool_use_id`

#### Scenario: call_id symmetry is enforced (missing=error)

- **WHEN** tool calls and outputs are not symmetric (missing output, orphan output, or missing call_id)
- **THEN** the system errors before upstream forwarding
- **AND THEN** the error details identify the invariant and the offending call_id(s)

### Requirement: Instructions Composition (template + system)

When transforming Claude → Codex, the system MUST build `instructions` as:

- `instructions = instructionsTemplate + "\n\n" + normalize(system)` (when system is present)
- `instructions = instructionsTemplate` (when system is absent)

#### Scenario: system blocks are normalized into a string

- **GIVEN** a Claude request includes `system` as an array of text blocks
- **WHEN** the request is transformed to Codex
- **THEN** the Codex `instructions` includes the concatenated text content in order
- **AND THEN** any non-text blocks are ignored but recorded as unmapped/extra evidence

### Requirement: Codex SSE Tool Call Mapping (Responses SSE → Claude SSE tool_use)

When transforming Codex Responses streaming output back to Claude SSE, the system MUST:

- interpret event type from `data.type` (not relying on `event:` line)
- map `response.output_item.done` items based on `item.type`
- emit a Claude Code consumable tool sequence for tool calls

#### Scenario: function_call item produces Claude tool_use SSE sequence

- **GIVEN** an upstream SSE event with `data.type="response.output_item.done"` and `item.type="function_call"`
- **WHEN** the stream is transformed to Claude SSE
- **THEN** the output stream contains the sequence:
  1) `content_block_start` with `content_block.name` and `content_block.id`
  2) one or more `content_block_delta` with `delta.type="input_json_delta"`
  3) `content_block_stop`
  4) `message_delta` (to trigger the next tool loop)

#### Scenario: response.completed is the preferred stream terminator

- **WHEN** the upstream stream includes `data.type="response.completed"`
- **THEN** the transformer ends the downstream Claude SSE message cleanly (content_block_stop if needed + message_stop)

#### Scenario: missing response.completed is observable

- **WHEN** the upstream stream ends without `response.completed`
- **THEN** the transformer still terminates the downstream stream safely (message_stop)
- **AND THEN** FieldAudit records `missingUpstreamCompleted=true`
