## 1. Implementation

### 1.1 Core Documentation

- [x] 1.1.1 Create `README.md` with quick start guide
  - Installation steps
  - Configuration creation
  - Service startup
  - Basic verification
- [x] 1.1.2 Create `docs/usage.md` with CLI-specific instructions
  - Claude Code configuration
  - Codex CLI configuration
  - Gemini CLI configuration
  - Common use case examples
  - Troubleshooting section
- [x] 1.1.3 Create `docs/configuration.md` as configuration reference
  - All config options explained
  - Environment variable overrides
  - Rule syntax reference
  - Operation types documentation
  - Security best practices

### 1.2 Configuration Examples

- [x] 1.2.1 Create `promptxy.config.json.example`
  - Complete configuration with comments
  - Example rules for each client type
  - Common patterns (replace, append, delete, insert, etc.)

### 1.3 Security & Troubleshooting

- [x] 1.3.1 Document security model in usage guide
  - Localhost-only binding explanation
  - Credential handling (no storage)
  - Header filtering behavior
- [x] 1.3.2 Document troubleshooting section
  - Common errors and solutions
  - Debug mode usage
  - Health check endpoint

## 2. Validation

### 2.1 Documentation Review

- [x] 2.1.1 Verify all CLI configuration examples are accurate
- [x] 2.1.2 Test all code snippets work as documented
- [x] 2.1.3 Review for clarity and completeness

### 2.2 Integration Testing

- [ ] 2.2.1 Follow README.md from scratch on clean environment
- [ ] 2.2.2 Verify each CLI configuration example works
- [ ] 2.2.3 Test all example configurations in promptxy.config.json.example

## 3. Notes

- This change is documentation-only; no code changes required
- All tasks are parallelizable except 2.2 (integration testing depends on 1.x completion)
- Focus on clarity and accuracy over completeness (can iterate)
- Chinese documentation is acceptable given project context
- All implementation tasks completed; validation tasks pending real environment testing
