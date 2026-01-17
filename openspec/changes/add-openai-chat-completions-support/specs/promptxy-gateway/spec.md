## MODIFIED Requirements

### Requirement: Provider Route Mapping

The system SHALL expose distinct route prefixes for each supported provider so clients can configure base URLs without protocol-level MITM.

#### Scenario: Provider prefixes are available
- **WHEN** a client is configured to use the gateway for a provider
- **THEN** it can target a stable local prefix for that provider (e.g., `/codex`, `/gemini`)

#### Scenario: Claude route can target OpenAI Chat suppliers
- **WHEN** the `/claude` route selects a supplier with protocol `openai-chat`
- **THEN** the gateway uses `/chat/completions` upstream path via protocol transformation
