# promptxy-gateway Specification

## Purpose
TBD - created by archiving change add-promptxy-local-gateway. Update Purpose after archive.
## Requirements
### Requirement: Local Gateway Listener

The system SHALL provide a local HTTP service that listens on a configurable host and port, and MUST default to binding on `127.0.0.1` when no host is provided.

#### Scenario: Default bind is localhost-only

- **WHEN** the service starts without an explicit host configuration
- **THEN** it listens only on `127.0.0.1`

### Requirement: Upstream Request Forwarding

The system SHALL forward incoming requests to a configured upstream base URL while preserving method, path, query, and body semantics, and MUST return the upstream status code and response body to the client.

#### Scenario: Non-stream request is forwarded and returned

- **WHEN** a client sends a non-stream request to a supported route
- **THEN** the system forwards it to the configured upstream
- **AND THEN** the client receives the upstream status code and response body

### Requirement: Authentication Header Passthrough

The system MUST forward authentication-related request headers exactly as received from the client, and it MUST NOT require storing upstream API keys in local configuration for the MVP.

#### Scenario: Client-provided credentials are forwarded

- **WHEN** a request includes client-provided authentication headers (e.g., `Authorization`)
- **THEN** the system forwards those headers to the upstream request

### Requirement: Streaming Response Passthrough

The system MUST support streaming responses by proxying bytes as they are received from upstream, without buffering the entire response in memory by default.

#### Scenario: SSE stream is proxied without full buffering

- **WHEN** upstream responds with a streaming body (e.g., SSE)
- **THEN** the system streams data to the client as it arrives

### Requirement: Provider Route Mapping

The system SHALL expose distinct route prefixes for each supported provider so clients can configure base URLs without protocol-level MITM.

#### Scenario: Provider prefixes are available

- **WHEN** a client is configured to use the gateway for a provider
- **THEN** it can target a stable local prefix for that provider (e.g., `/codex`, `/gemini`)

### Requirement: Sensitive Header Handling

The system MUST NOT log sensitive authentication headers by default, including `Authorization` and known API key headers.

#### Scenario: Authorization header is not logged

- **WHEN** a request includes an `Authorization` header
- **THEN** logs do not include the header value
