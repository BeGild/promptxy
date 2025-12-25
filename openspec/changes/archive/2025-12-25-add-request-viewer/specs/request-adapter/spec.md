## ADDED Requirements

### Requirement: Adapter Interface

The system SHALL define a `RequestAdapter<T>` interface that enables the request viewer to support multiple API request formats through pluggable adapters.

#### Scenario: Adapter identifies supported format

- **WHEN** an adapter's `supports()` method is called with a request object
- **THEN** the method returns true if the request matches the expected format
- **AND** the return type is narrowed to the expected request type

#### Scenario: Adapter extracts metadata

- **WHEN** an adapter's `extractMetadata()` method is called
- **THEN** the method returns a `RequestMetadata` object with adapter-specific fields
- **AND** common fields like `model`, `messageCount` are included when available

#### Scenario: Adapter builds view tree

- **WHEN** an adapter's `buildViewTree()` method is called with a request
- **THEN** the method returns a `ViewNode` tree representing the request structure
- **AND** each node has appropriate type, label, and configuration

#### Scenario: Adapter provides field config

- **WHEN** an adapter's `getFieldConfig()` method is called with a field path
- **THEN** the method returns the configuration for that field if defined
- **AND** undefined is returned for fields without specific configuration

#### Scenario: Adapter defines view groups

- **WHEN** an adapter implements the optional `getGroups()` method
- **THEN** the method returns an array of `ViewGroup` objects
- **AND** each group has an id, label, icon, and associated nodes

### Requirement: Adapter Registry

The system SHALL provide a registry pattern for managing and discovering request adapters.

#### Scenario: Register adapter

- **WHEN** `AdapterRegistry.register()` is called with an adapter instance
- **THEN** the adapter is added to the registry
- **AND** subsequent `findAdapter()` calls can return this adapter

#### Scenario: Auto-detect adapter

- **WHEN** `AdapterRegistry.findAdapter()` is called with a request object
- **THEN** the registry iterates through registered adapters
- **AND** returns the first adapter whose `supports()` method returns true

#### Scenario: List all adapters

- **WHEN** `AdapterRegistry.listAdapters()` is called
- **THEN** an array of all registered adapter information is returned
- **AND** each item includes the adapter name and version

### Requirement: Tree Builder Utility

The system SHALL provide a utility function for building view trees from request objects, handling nested structures, diff status calculation, and collapse state determination.

#### Scenario: Build tree from path

- **WHEN** `buildTreeFromPath()` is called with a request object and options
- **THEN** a `ViewNode` tree is created with proper parent-child relationships
- **AND** each node's id follows the path convention (e.g., "messages.0.content.0.text")

#### Scenario: Calculate diff status

- **WHEN** building a tree with both original and modified requests
- **THEN** each node's `diffStatus` is set based on comparison with original
- **AND** status is one of: same, added, removed, modified

#### Scenario: Apply field config

- **WHEN** a field has a matching configuration
- **THEN** the node's type, collapse state, and metadata reflect the config
- **AND** custom renderers specified in config are applied

### Requirement: Claude API Adapter

The system SHALL include a built-in adapter for Claude Messages API requests with appropriate field configurations for System Prompt, Messages, and Tools.

#### Scenario: Recognize Claude Messages API

- **WHEN** a request contains `model` and `messages` fields
- **AND** `messages` is an array
- **THEN** ClaudeMessagesAdapter's `supports()` returns true

#### Scenario: Configure System Prompt rendering

- **WHEN** the `system` field is present in a Claude request
- **THEN** the field is configured as Markdown-rendered
- **AND** default collapse state is false (expanded)
- **AND** array items are treated as separate text blocks

#### Scenario: Configure Messages array

- **WHEN** the `messages` field is present
- **THEN** the field is configured as an array type
- **AND** default collapse state is false
- **AND** nested content arrays are properly handled

#### Scenario: Configure Tools array

- **WHEN** the `tools` field is present
- **THEN** the field is configured as array type
- **AND** default collapse state is true (collapsed)
- **AND** each tool's `input_schema` is configured as JSON type

#### Scenario: Extract Claude-specific metadata

- **WHEN** `extractMetadata()` is called on a Claude request
- **THEN** metadata includes model, messageCount, systemPromptLength, and toolCount

### Requirement: Extensibility

The adapter interface SHALL support future extension for additional API formats without modifying core viewer components.

#### Scenario: Add OpenAI adapter

- **WHEN** a new adapter for OpenAI Chat API is implemented
- **AND** it implements `RequestAdapter<OpenAIChatRequest>`
- **THEN** the adapter can be registered and used without modifying RequestDetailPanel

#### Scenario: Custom renderer per field

- **WHEN** an adapter specifies a custom renderer in field config
- **THEN** that renderer is used for the specific field
- **AND** default renderers continue to work for other fields

#### Scenario: Custom field grouping

- **WHEN** an adapter implements `getGroups()` with custom groups
- **THEN** the Structure Overview view reflects those groups
- **AND** group labels and icons are displayed correctly
