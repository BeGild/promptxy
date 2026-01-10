# request-viewer Delta Spec

## MODIFIED Requirements

### Requirement: Diff Comparison

The request viewer SHALL display side-by-side comparison of two requests with accurate baseline selection to distinguish between protocol transformation differences and rule modifications.

#### Scenario: Select transformed body as baseline when transformer was used

- **WHEN** a request has `transformedBody` field available
- **AND** user opens Diff Comparison view
- **THEN** left side displays `transformedBody`
- **AND** right side displays `modifiedBody`
- **AND** label for left side is "转换后请求"
- **AND** differences shown represent only rule modifications, not protocol transformation

#### Scenario: Select original body as baseline when no transformer was used

- **WHEN** a request has no `transformedBody` field (undefined or null)
- **AND** user opens Diff Comparison view
- **THEN** left side displays `originalBody`
- **AND** right side displays `modifiedBody`
- **AND** label for left side is "原始请求"
- **AND** differences shown represent all changes including both rules and any other modifications

#### Scenario: Display no differences when no rules applied

- **WHEN** a request has `transformedBody` available
- **AND** no rules were applied (transformedBody equals modifiedBody)
- **AND** user opens Diff Comparison view
- **THEN** comparison shows no differences
- **AND** UI displays "转换后请求（无改写）" or "原始请求（无改写）" based on availability of transformedBody
- **AND** all content is shown in a single view instead of side-by-side

#### Scenario: Display differences when rules were applied after transformer

- **WHEN** a request has `transformedBody` available
- **AND** rules were applied (transformedBody differs from modifiedBody)
- **AND** user opens Diff Comparison view
- **THEN** side-by-side view shows highlighted differences
- **AND** left side shows `transformedBody` with removed items marked
- **AND** right side shows `modifiedBody` with added/modified items marked
- **AND** label for left side is "转换后请求"
- **AND** label for right side is "最终请求"
- **AND** summary indicates "X of Y lines changed" or similar message
