## MODIFIED Requirements

### Requirement: Transform Trace Display

The Protocol Lab SHALL surface not only step-level trace data but also a compact summary of field-level audit information so users can quickly verify correctness.

#### Scenario: Protocol Lab shows missing/extra/unmapped summaries

- **WHEN** a preview run returns a trace with FieldAudit
- **THEN** the UI displays:
  - missing required target paths (as errors)
  - unmapped source paths (as warnings)
  - extra target paths (as informational)
  - defaulted fields with their sources (template/route/supplier/inferred)

#### Scenario: User can copy audit as JSON

- **WHEN** a preview run returns FieldAudit
- **THEN** the user can copy/export the audit payload as JSON for sharing and debugging

