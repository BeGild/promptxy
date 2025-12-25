# request-viewer Specification Delta

## ADDED Requirements

### Requirement: Path Autocomplete Search

The request viewer SHALL provide an autocomplete input for searching requests by path, displaying all unique historical paths as dropdown suggestions.

#### Scenario: Load unique paths on focus

- **WHEN** a user focuses on the search input
- **THEN** a list of all unique request paths is loaded from `GET /_promptxy/paths`
- **AND** the paths are displayed in a dropdown suggestions list
- **AND** the input remains visible and editable during loading

#### Scenario: Local filtering of path suggestions

- **WHEN** a user types in the search input
- **THEN** the dropdown suggestions are filtered locally based on the input value
- **AND** filtering is case-insensitive
- **AND** no network request is made for filtering

#### Scenario: Select path from suggestions

- **WHEN** a user selects a path from the dropdown suggestions
- **THEN** the search is triggered with the selected path value
- **AND** requests are filtered using path prefix matching
- **AND** the dropdown closes

#### Scenario: Path prefix matching

- **WHEN** a user searches with a value starting with `/`
- **THEN** requests are filtered using `path LIKE 'value%'`
- **AND** all requests with paths matching the prefix are returned
- **EXAMPLE**: searching `/api/users` returns `/api/users/123`, `/api/users/profile`, etc.

#### Scenario: ID fuzzy matching

- **WHEN** a user searches with a value not starting with `/`
- **THEN** requests are filtered using `LIKE '%value%'` on `id`, `path`, and `original_body` fields
- **AND** requests matching any of the three fields are returned

#### Scenario: Custom value allowed

- **WHEN** a user types a value not in the suggestions list
- **THEN** the input accepts the custom value
- **AND** the search is triggered based on the input pattern (starts with `/` or not)

#### Scenario: Clear search

- **WHEN** a user clicks the "Clear Search" button
- **THEN** the search input is cleared
- **AND** all requests are displayed without filtering

#### Scenario: Virtual scroll compatibility

- **WHEN** the virtual scroll mode is enabled
- **THEN** the PathAutocomplete component is used instead of the standard Input
- **AND** behavior is consistent with the standard list view

#### Scenario: Loading state indication

- **WHEN** path suggestions are being loaded
- **THEN** a loading indicator is displayed in the input
- **AND** the input remains interactive
- **WHEN** search results are being loaded after selection
- **THEN** a loading indicator is displayed in the input
- **AND** the dropdown is hidden

#### Scenario: Error handling

- **WHEN** loading path suggestions fails
- **THEN** the component falls back to a standard input allowing custom values
- **AND** an error message is logged to the console
- **AND** the user can still search by typing manually
