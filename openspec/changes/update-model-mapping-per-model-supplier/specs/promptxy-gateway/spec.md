## MODIFIED Requirements

### Requirement: Provider Route Mapping

The system SHALL continue to expose distinct route prefixes for each supported provider (`/claude`, `/codex`, `/gemini`).

#### Scenario: Provider prefixes remain stable

- **WHEN** a client is configured to use the gateway
- **THEN** it can target stable local prefixes `/claude`, `/codex`, and `/gemini`

### Requirement: Route Default Upstream Supplier

The system MUST allow each route to define a default upstream supplier (`defaultSupplierId`), and MUST use this supplier when no model-mapping rule matches.

#### Scenario: No rule match uses default supplier

- **GIVEN** an enabled route with `defaultSupplierId` configured
- **AND GIVEN** an inbound request with a `model` that does not match any mapping rule
- **WHEN** the request is received
- **THEN** the gateway forwards the request to the supplier referenced by `defaultSupplierId`
- **AND THEN** the request `model` is forwarded unchanged

### Requirement: Model Mapping Can Select Supplier And Optional Model

For any route with model mapping enabled, the system MUST support mapping an inbound `model` (matched via wildcard pattern) to a target supplier (`targetSupplierId`) and an optional target model (`targetModel`).

#### Scenario: Rule match switches supplier and model

- **GIVEN** an enabled route with `modelMapping.enabled=true`
- **AND GIVEN** a rule whose `pattern` matches the inbound `model`
- **WHEN** a request is received
- **THEN** the gateway selects the supplier referenced by `targetSupplierId`
- **AND THEN** if `targetModel` is provided, the gateway forwards the request using `model=targetModel`

#### Scenario: Missing targetModel means passthrough model

- **GIVEN** an enabled route with `modelMapping.enabled=true`
- **AND GIVEN** a matching rule that defines `targetSupplierId` but does not define `targetModel`
- **WHEN** a request is received
- **THEN** the gateway forwards the request to `targetSupplierId`
- **AND THEN** the request `model` is forwarded unchanged

### Requirement: Transformer Is Derived From Target Supplier Protocol

The system MUST NOT require storing a route-level `transformer` setting for this feature, and MUST derive the effective transformer based on the local entrypoint and the selected target supplier protocol.

#### Scenario: Claude entry derives transformer from protocol

- **GIVEN** a `/claude` request and a selected target supplier
- **WHEN** the supplier protocol is `anthropic`
- **THEN** the effective transformer is `none`
- **WHEN** the supplier protocol is `openai`
- **THEN** the effective transformer is `codex` (Responses)
- **WHEN** the supplier protocol is `gemini`
- **THEN** the effective transformer is `gemini`

### Requirement: Codex/Gemini Entrypoints Forbid Cross-Protocol Supplier Selection

The system MUST reject routing configurations (and/or requests) where `/codex` or `/gemini` entrypoints attempt to target a supplier with a different protocol.

#### Scenario: Codex entry rejects non-openai supplier target

- **GIVEN** a `/codex` request
- **AND GIVEN** the selected target supplier protocol is not `openai`
- **WHEN** the request is received
- **THEN** the gateway responds with HTTP 400 indicating the route selection is invalid

#### Scenario: Gemini entry rejects non-gemini supplier target

- **GIVEN** a `/gemini` request
- **AND GIVEN** the selected target supplier protocol is not `gemini`
- **WHEN** the request is received
- **THEN** the gateway responds with HTTP 400 indicating the route selection is invalid
