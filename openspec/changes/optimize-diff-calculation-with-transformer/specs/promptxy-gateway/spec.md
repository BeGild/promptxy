# promptxy-gateway Delta Spec

## ADDED Requirements

### Requirement: Transformed Request Body Preservation

The system SHALL preserve the request body after protocol transformer processing as `transformedBody` in the request record, separate from the original and final modified body.

#### Scenario: Save transformed body after protocol transformer

- **WHEN** a request passes through a protocol transformer (e.g., Claude→Codex)
- **AND** transformer processing completes successfully
- **THEN** `transformedBody` field in RequestRecord contains the JSON string of transformer output
- **AND** `originalBody` remains unchanged as the raw input from client
- **AND** `modifiedBody` contains the final body sent to upstream (after any rule applications)

#### Scenario: Undefined transformed body when no transformer used

- **WHEN** a request does not pass through a protocol transformer (transformer === 'none' or no transformer)
- **THEN** `transformedBody` field in RequestRecord is undefined
- **AND** `originalBody` and `modifiedBody` behave as before (original vs final comparison)
- **AND** database storage does not create a field for transformed body

#### Scenario: Include transformed body in database record

- **WHEN** saving a request record to database
- **AND** `transformedBody` is available
- **THEN** database file includes `transformedBody` field with the transformer output
- **AND** `transformedBody` is stored as JSON string (same format as originalBody and modifiedBody)
- **AND** backward compatibility is maintained for records without transformedBody

#### Scenario: Return transformed body in API response

- **WHEN** API client requests request detail via `GET /_promptxy/requests/:id`
- **AND** the request record has `transformedBody` field
- **THEN** API response includes `transformedBody` field as parsed JSON object
- **AND** `transformedBody` is null/undefined for old records without the field
- **AND** API response maintains backward compatibility with existing fields (originalBody, modifiedBody)

#### Scenario: Handle rule modifications after transformer

- **WHEN** rules are applied after protocol transformer
- **AND** modified body differs from transformed body
- **THEN** `modifiedBody` contains the final result after rule modifications
- **AND** `transformedBody` contains the pre-rule state (after transformer only)
- **AND** both bodies are available for accurate diff comparison
