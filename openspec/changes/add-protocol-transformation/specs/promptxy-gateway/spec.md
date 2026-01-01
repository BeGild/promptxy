## MODIFIED Requirements

### Requirement: Authentication Header Passthrough

The system MUST preserve current behavior by default: when no managed upstream authentication is configured for the matched supplier, authentication-related request headers are forwarded as received from the client.

When managed upstream authentication is configured (e.g., `supplier.auth` is present), the system MUST NOT forward the client-provided upstream credentials to the upstream request, and MUST inject/override upstream authentication using `supplier.auth`.

#### Scenario: Passthrough mode forwards client credentials

- **WHEN** a request includes client-provided authentication headers (e.g., `Authorization`)
- **AND WHEN** the matched supplier does not define `supplier.auth`
- **THEN** the system forwards those headers to the upstream request unchanged

#### Scenario: Managed upstream auth overrides client credentials

- **WHEN** a request includes client-provided authentication headers (e.g., `Authorization` or `x-api-key`)
- **AND WHEN** the matched supplier defines `supplier.auth`
- **THEN** the upstream request uses the credentials from `supplier.auth`
- **AND THEN** the client-provided upstream credentials are not forwarded upstream

### Requirement: Streaming Response Passthrough

The system MUST support streaming responses.

- When protocol transformation is NOT enabled for the matched supplier, the system MUST proxy bytes as they are received from upstream (no full buffering by default).
- When protocol transformation IS enabled and a streaming response requires transformation, the system MUST stream the transformed output without buffering the entire response in memory.

#### Scenario: SSE stream is proxied without full buffering (no transformation)

- **WHEN** upstream responds with a streaming body (e.g., SSE)
- **AND WHEN** the matched supplier has no response transformation enabled
- **THEN** the system streams data to the client as it arrives

#### Scenario: SSE stream is transformed and streamed (with transformation)

- **WHEN** upstream responds with a streaming body (e.g., SSE)
- **AND WHEN** the matched supplier requires protocol transformation for streaming output
- **THEN** the system parses the stream incrementally, transforms events, and serializes them back to a stream
- **AND THEN** the system does not buffer the entire response in memory

### Requirement: Sensitive Header Handling

The system MUST NOT log sensitive authentication headers by default, including but not limited to `Authorization`, `x-api-key`, and `x-goog-api-key`.

When managed upstream authentication is configured, the system MUST also ensure `supplier.auth` secrets are not logged, stored in request history, or returned in preview/trace outputs in plaintext.

#### Scenario: Authorization header is not logged

- **WHEN** a request includes an `Authorization` header
- **THEN** logs do not include the header value

#### Scenario: Upstream secrets are redacted in preview and history

- **WHEN** a supplier defines `supplier.auth` credentials
- **THEN** request history does not store the plaintext secret
- **AND THEN** any preview/trace output redacts the secret by default

## ADDED Requirements

### Requirement: Gateway Inbound Authentication

The system SHALL support optional gateway-level inbound authentication (`gatewayAuth`) to control access to the local gateway independently of upstream provider credentials.

The system MUST NOT require downstream clients (including Claude Code) to send any custom authentication header. Instead, the system SHALL accept gateway tokens from a configurable set of header names (`gatewayAuth.acceptedHeaders`) that match client-native capabilities.

#### Scenario: Missing or invalid gateway token is rejected

- **WHEN** `gatewayAuth.enabled` is true
- **AND WHEN** a request does not include a valid token in any header listed in `gatewayAuth.acceptedHeaders`
- **THEN** the request is rejected with an authentication error

#### Scenario: Gateway auth headers are stripped before upstream forwarding

- **WHEN** `gatewayAuth.enabled` is true
- **AND WHEN** a request is authenticated successfully
- **THEN** the inbound authentication headers used for gatewayAuth are removed before the request is sent upstream
