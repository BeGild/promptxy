## ADDED Requirements

### Requirement: SQLite Database Storage
The system SHALL persist all request records in a SQLite database located at `~/.local/promptxy/promptxy.db` with automatic directory creation.

#### Scenario: Database initialization
- **WHEN** the service starts for the first time
- **THEN** it creates the `~/.local/promptxy/` directory if it doesn't exist
- **AND THEN** it initializes the SQLite database with required tables

#### Scenario: Request persistence
- **WHEN** a request passes through the gateway
- **THEN** the complete request record is saved to the database
- **AND THEN** the record includes original body, modified body, matched rules, and response info

### Requirement: Request History API
The system SHALL provide RESTful endpoints for retrieving request history with pagination and filtering.

#### Scenario: List requests with pagination
- **WHEN** a client calls `GET /_promptxy/requests?limit=50&offset=0`
- **THEN** the system returns the 50 most recent requests
- **AND THEN** the response includes total count for pagination

#### Scenario: Filter requests by client
- **WHEN** a client calls `GET /_promptxy/requests?client=codex`
- **THEN** only requests from Codex CLI are returned
- **AND THEN** the response maintains pagination structure

#### Scenario: Get request detail
- **WHEN** a client calls `GET /_promptxy/requests/:id`
- **THEN** the system returns the complete request record
- **AND THEN** the response includes original body, modified body, and matched rules

### Requirement: Request Detail with Diff Data
The request detail endpoint MUST return both original and modified request bodies to enable diff visualization.

#### Scenario: Complete request data
- **WHEN** a client retrieves a request detail
- **THEN** the response includes `originalBody` (JSON string)
- **AND THEN** the response includes `modifiedBody` (JSON string)
- **AND THEN** the response includes `matchedRules` (JSON array of rule IDs and operation types)

### Requirement: SSE Event Streaming
The system SHALL provide a Server-Sent Events endpoint for real-time request notifications.

#### Scenario: SSE connection
- **WHEN** a client connects to `GET /_promptxy/events`
- **THEN** the response headers include `Content-Type: text/event-stream`
- **AND THEN** the connection remains open for server push events

#### Scenario: New request event
- **WHEN** a new request is captured by the gateway
- **THEN** an SSE event is broadcast to all connected clients
- **AND THEN** the event data includes request ID, timestamp, client, path, and method

#### Scenario: Client reconnection
- **WHEN** an SSE connection is lost
- **AND WHEN** the client reconnects
- **THEN** new events are received normally
- **AND THEN** no historical events are sent (only new ones)

### Requirement: Configuration Sync API
The system SHALL provide an endpoint to update configuration and apply rules immediately.

#### Scenario: Sync rules
- **WHEN** a client POSTs new rules to `/_promptxy/config/sync`
- **THEN** the system validates the rule format
- **AND THEN** updates the in-memory configuration
- **AND THEN** persists to `~/.local/promptxy/config.json`
- **AND THEN** returns success with applied rule count

#### Scenario: Read configuration
- **WHEN** a client GETs `/_promptxy/config`
- **THEN** the system returns the current complete configuration
- **AND THEN** includes all rules, upstream URLs, and settings

### Requirement: Data Cleanup API
The system SHALL provide manual and automatic data cleanup to prevent unbounded storage growth.

#### Scenario: Manual cleanup
- **WHEN** a client POSTs to `/_promptxy/requests/cleanup?keep=100`
- **THEN** the system deletes all requests except the most recent 100
- **AND THEN** returns the count of deleted records

#### Scenario: Automatic cleanup
- **WHEN** the auto-cleanup interval elapses (default: 1 hour)
- **THEN** the system checks if request count exceeds `maxHistory` (default: 100)
- **AND THEN** deletes old records if needed
- **AND THEN** logs the cleanup action

### Requirement: Request Capture in Gateway
The gateway MUST capture complete request/response data and store it in the database.

#### Scenario: Request recording
- **WHEN** a request passes through the gateway
- **THEN** the gateway records the original request body
- **AND THEN** applies rules and records the modified body
- **AND THEN** forwards to upstream and records response
- **AND THEN** saves the complete record to database
- **AND THEN** broadcasts SSE event

#### Scenario: Error handling
- **WHEN** a request fails (upstream error or network issue)
- **THEN** the gateway still records the attempt
- **AND THEN** stores the error message
- **AND THEN** broadcasts SSE event with error status

### Requirement: Health Check Endpoint
The system SHALL provide a health check endpoint for monitoring.

#### Scenario: Health check
- **WHEN** a client calls `GET /_promptxy/health`
- **THEN** the system returns 200 OK
- **AND THEN** the response includes service status and version

### Requirement: CORS Support
The API server SHALL support Cross-Origin Resource Sharing for frontend development.

#### Scenario: Frontend API call
- **WHEN** the frontend (on different port) makes API requests
- **THEN** the API server responds with appropriate CORS headers
- **AND THEN** the browser allows the request

### Requirement: Sensitive Header Filtering
The system MUST NOT log or store sensitive authentication headers.

#### Scenario: Authorization header protection
- **WHEN** a request includes `Authorization` header
- **THEN** the header is forwarded to upstream
- **AND THEN** the header is NOT stored in database
- **AND THEN** the header is NOT logged

### Requirement: Database Indexing
The system MUST create appropriate indexes for efficient querying.

#### Scenario: Indexed queries
- **WHEN** querying requests by timestamp
- **THEN** the query uses the timestamp index
- **AND THEN** returns results in under 100ms for 1000 records

#### Scenario: Combined filtering
- **WHEN** querying requests by client and time range
- **THEN** the query uses the composite index
- **AND THEN** returns results efficiently

### Requirement: Type-Safe API
The system SHALL provide TypeScript type definitions for all API contracts.

#### Scenario: Type safety
- **WHEN** the backend defines API types
- **THEN** the frontend can import and use them
- **AND THEN** compile-time validation catches API contract violations

### Requirement: Graceful Shutdown
The system SHALL handle shutdown signals to close connections properly.

#### Scenario: Service shutdown
- **WHEN** the service receives SIGTERM or SIGINT
- **THEN** it closes all active SSE connections
- **AND THEN** closes database connections
- **AND THEN** exits cleanly

## MODIFIED Requirements

### Requirement: Local Gateway Listener
The system SHALL provide a local HTTP service that listens on a configurable host and port, and MUST default to binding on `127.0.0.1` when no host is provided.

#### Scenario: Default bind is localhost-only
- **WHEN** the service starts without an explicit host configuration
- **THEN** it listens only on `127.0.0.1`
- **AND THEN** the API server also binds to localhost

#### Scenario: Dual server startup
- **WHEN** the service starts
- **THEN** the gateway starts on configured port (default 7070)
- **AND THEN** the API server starts on port+1 (default 7071)
- **AND THEN** both servers are ready simultaneously

### Requirement: Upstream Request Forwarding
The system SHALL forward incoming requests to a configured upstream base URL while preserving method, path, query, and body semantics, and MUST return the upstream status code and response body to the client.

#### Scenario: Non-stream request is forwarded and returned
- **WHEN** a client sends a non-stream request to a supported route
- **THEN** the system forwards it to the configured upstream
- **AND THEN** captures the complete response
- **AND THEN** returns the upstream status code and response body to the client

#### Scenario: Request/response data is captured
- **WHEN** a request completes
- **THEN** the original request body is stored
- **AND THEN** the modified request body is stored
- **AND THEN** the response status and duration are stored

### Requirement: Provider Route Mapping
The system SHALL expose distinct route prefixes for each supported provider so clients can configure base URLs without protocol-level MITM.

#### Scenario: Provider prefixes are available
- **WHEN** a client is configured to use the gateway for a provider
- **THEN** it can target a stable local prefix for that provider
- **AND THEN** the gateway routes to the correct upstream
- **AND THEN** the request is captured and stored

### Requirement: Ordered Operations
The system SHALL apply operations in rule order, and operations within a rule in declared order, producing deterministic output.

#### Scenario: Operations run deterministically
- **WHEN** two operations are defined in a rule (e.g., replace then append)
- **THEN** the final output reflects the declared order
- **AND THEN** the matched rules array records each operation type

#### Scenario: Multiple rules execution
- **WHEN** multiple rules match a request
- **THEN** they are applied in order
- **AND THEN** each match is recorded in the request history
- **AND THEN** the final modified body reflects all changes

### Requirement: Safe No-Op Behavior
The system MUST behave as a no-op when no rules match or when a target field is missing, and it MUST still forward the request.

#### Scenario: Missing target field does not break request
- **WHEN** a request does not include the configured target prompt field
- **THEN** the system forwards the request unchanged
- **AND THEN** still records the request in history
- **AND THEN** marks it as having no matched rules

#### Scenario: No matching rules
- **WHEN** no rules match the request
- **THEN** the request is forwarded unchanged
- **AND THEN** recorded with empty matched rules array
- **AND THEN** still triggers SSE event

## REMOVED Requirements

### Requirement: Minimal Logging (from MVP)
**Reason**: The MVP requirement to "only log field differences" is replaced by comprehensive request storage in database.

**Migration**: All request data is now stored in SQLite, providing complete audit trail without relying on log files.

### Requirement: No Default File Storage (from MVP)
**Reason**: The MVP explicitly avoided file storage, but v2.0 requires persistent storage for request history.

**Migration**: Data is stored in `~/.local/promptxy/promptxy.db` with automatic cleanup, maintaining privacy while enabling features.

### Requirement: Single Server Architecture (from MVP)
**Reason**: The MVP used a single server on one port. v2.0 requires separate gateway and API servers for clear separation of concerns.

**Migration**: Gateway on 7070, API on 7071. Production mode serves both from single process but different ports.
