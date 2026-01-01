## ADDED Requirements

### Requirement: Supplier Transformer Configuration

The system SHALL allow suppliers to configure a protocol transformation pipeline using an explicit structure:

- `transformer.default`: a required transformer chain
- `transformer.models`: an optional exact-match map of model string to transformer chain override

A transformer chain step SHALL be either:

- a string transformer name (no options)
- an object `{ name: string, options?: object }`

#### Scenario: Default chain is required

- **WHEN** a supplier enables protocol transformation
- **THEN** `transformer.default` must be present and valid

#### Scenario: Model override uses exact match

- **WHEN** a request includes `model: "deepseek-chat"`
- **AND WHEN** the supplier defines `transformer.models["deepseek-chat"]`
- **THEN** the override chain is selected
- **AND THEN** partial/regex matching is not performed

### Requirement: Path Rewrite and Protocol Transformation Separation

The system MUST keep responsibilities separated:

- `pathMappings` performs URL path rewrite only
- protocol transformation performs request/response semantic transformation (body/headers/stream) and MUST NOT rewrite the URL path

#### Scenario: URL path mapping is applied independently of transformer chain

- **WHEN** a request path matches `pathMappings`
- **THEN** the upstream URL path is rewritten accordingly
- **AND THEN** the transformer chain selection is based on request content (e.g., model) and supplier config

### Requirement: Request and Response Transformation

When a supplier is configured with a transformer chain, the system SHALL:

1. transform downstream Anthropic Messages requests into the supplier's upstream protocol
2. transform upstream responses back into Anthropic-compatible responses for downstream clients

#### Scenario: Anthropic request is transformed for an OpenAI-compatible upstream

- **WHEN** a downstream client sends an Anthropic Messages request (including tools)
- **AND WHEN** the supplier transformer chain targets an OpenAI-compatible upstream
- **THEN** the upstream request body is transformed into the expected OpenAI-compatible format

#### Scenario: Upstream response is transformed back to Anthropic

- **WHEN** an upstream request is sent using protocol transformation
- **THEN** the downstream client receives an Anthropic-compatible response body

### Requirement: Streaming Transformation

When a request enables streaming and the upstream responds with a streaming body, the system MUST support transforming the stream while preserving streaming behavior (no full-response buffering by default).

#### Scenario: Streaming events are transformed incrementally

- **WHEN** a downstream request enables streaming
- **AND WHEN** upstream responds with a streaming body
- **THEN** the system transforms the stream incrementally and forwards it downstream

### Requirement: Transform Trace and Diagnostics

The system SHALL generate a transform trace for each transformed request, suitable for UI display and debugging, including:

- matched supplier identification
- `authHeaderUsed`: the inbound header name used to authenticate the request against `gatewayAuth` (header name only; never a value)
- selected chain (default vs model override)
- per-step summary (success/failure)
- warnings/errors and high-level reasons

The trace MUST NOT contain plaintext secrets (gateway tokens or upstream credentials).

#### Scenario: Trace indicates selected chain

- **WHEN** a request is transformed
- **THEN** the trace states whether `transformer.default` or `transformer.models[model]` was used

#### Scenario: Trace includes auth header name but not value

- **WHEN** `gatewayAuth.enabled` is true
- **AND WHEN** the request is authenticated successfully using one of the headers in `gatewayAuth.acceptedHeaders`
- **THEN** the trace includes `authHeaderUsed` with the matched header name
- **AND THEN** the trace does not include the gateway token value

#### Scenario: Trace pinpoints failing step

- **WHEN** a transformer step fails during transformation
- **THEN** the trace identifies the failing step and provides a short reason
