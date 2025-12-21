# Change: Add User Documentation and Configuration Examples for promptxy

## Why

The core `promptxy` gateway implementation is complete and functional (verified by tests and code review), but there are no user-facing documentation or configuration examples. This creates a significant barrier to adoption - users cannot easily:

1. Understand how to configure their CLI tools to use the gateway
2. Create valid configuration files
3. Start the service and verify it works
4. Troubleshoot common issues

Based on the critical analysis in `docs/origin-and-requirements.md`, the implementation achieves 95% functional completeness but only 40% deliverability due to missing documentation.

## What Changes

- **New capability**: `promptxy-docs` - User-facing documentation and configuration examples
- Documentation files:
  - `README.md` - Quick start guide
  - `docs/usage.md` - Detailed usage instructions for all 3 CLIs
  - `docs/configuration.md` - Configuration reference
  - `promptxy.config.json.example` - Configuration template
- No breaking changes to existing code

## Impact

- Affected specs (new):
  - `promptxy-docs` - Documentation capability
- Affected code:
  - No code changes; documentation only
- Compatibility:
  - 100% backward compatible
  - Purely additive
- Security:
  - Documentation will include security best practices (localhost-only binding, no credential storage)
