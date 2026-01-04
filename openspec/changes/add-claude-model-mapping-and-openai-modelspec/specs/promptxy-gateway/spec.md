## MODIFIED Requirements

### Requirement: Provider Configuration Includes Supported Models

The system MUST allow each supplier to declare a list of supported upstream model identifiers (`supportedModels`) and persist them in configuration.

#### Scenario: Supplier supportedModels is persisted

- **WHEN** a supplier is created or updated with `supportedModels`
- **THEN** the gateway stores the list in config
- **AND THEN** the list is returned by the suppliers API

### Requirement: Claude Route Model Mapping (haiku/sonnet/opus)

For `localService=claude` routes that perform cross-protocol transformation (i.e. transformer is not `none`), the system MUST support mapping Claude Code model tiers (`haiku`, `sonnet`, `opus`) to upstream model specs.

#### Scenario: Missing claudeModelMap yields actionable error

- **GIVEN** a `localService=claude` enabled route with transformer not `none`
- **AND GIVEN** the route does not define `claudeModelMap` (or lacks `sonnet`)
- **WHEN** a request is received
- **THEN** the gateway responds with HTTP 400 and an error indicating that model mapping is required

#### Scenario: Unknown Claude model defaults to sonnet

- **GIVEN** a `localService=claude` enabled route with `claudeModelMap.sonnet` configured
- **WHEN** the inbound request `model` does not contain `haiku` nor `opus` nor `sonnet`
- **THEN** the gateway treats it as `sonnet` for mapping purposes

#### Scenario: haiku/opus fall back to sonnet

- **GIVEN** a `localService=claude` enabled route with `claudeModelMap.sonnet` configured
- **AND GIVEN** `claudeModelMap.haiku` and/or `claudeModelMap.opus` is not configured
- **WHEN** an inbound request model tier resolves to `haiku` or `opus`
- **THEN** the gateway falls back to `claudeModelMap.sonnet`

### Requirement: OpenAI ModelSpec Reasoning Effort Parsing

For OpenAI/Codex upstream requests, the gateway MUST support parsing a model spec in the form `<base>-<effort>` into `model=<base>` and `reasoning.effort=<effort>` when `<effort>` is recognized.

#### Scenario: Recognized effort suffix is parsed

- **GIVEN** a supplier with `reasoningEfforts` containing `high`
- **WHEN** an upstream OpenAI request is built with `model="gpt-5.2-codex-high"`
- **THEN** the gateway sends `model="gpt-5.2-codex"`
- **AND THEN** the gateway includes `reasoning.effort="high"`

#### Scenario: Unrecognized effort suffix is forwarded unchanged

- **GIVEN** a supplier with `reasoningEfforts` that does not contain `ultra`
- **WHEN** an upstream OpenAI request is built with `model="gpt-5.2-codex-ultra"`
- **THEN** the gateway forwards `model="gpt-5.2-codex-ultra"` without error

