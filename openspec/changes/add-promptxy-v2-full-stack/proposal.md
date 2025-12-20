# Change: Implement PromptXY v2.0 Full Stack (Complete Architecture Rewrite)

## Why
The current `promptxy` V1 implementation is a functional MVP with:
- ✅ Rule-based prompt modification (7 operation types)
- ✅ Support for Claude Code, Codex CLI, Gemini CLI
- ✅ HTTP proxy gateway on port 7070
- ✅ Configuration via JSON file

However, V1 has significant usability gaps:
1. **No request visibility** - Users cannot see what requests passed through
2. **Manual config editing** - Must edit JSON files by hand, no validation
3. **No real-time monitoring** - Cannot monitor requests as they happen
4. **No request history** - Past requests are lost forever
5. **No visual interface** - No way to manage rules without text editor

### V1 Code Structure to be Replaced
```
Current V1 files (will be completely replaced):
- src/main.ts (single server, no API)
- src/promptxy/gateway.ts (no capture, no SSE)
- src/promptxy/config.ts (file-only, no API sync)
- src/promptxy/types.ts (basic types only)
- src/promptxy/http.ts, logger.ts
- src/promptxy/rules/engine.ts (keep logic, refactor interface)
- src/promptxy/adapters/*.ts (keep logic, refactor interface)
- tests/ (will be updated for new architecture)
```

### V2 Architecture
The existing documentation (`docs/ARCHITECTURE.md`, `docs/BACKEND_API_EXTENSION.md`, `docs/WEB_UI_DESIGN.md`) outlines a complete v2.0 architecture that addresses all gaps:
- **Backend**: SQLite database + REST API + SSE server (ports 7070 + 7071)
- **Frontend**: React + HeroUI web interface
- **Data Flow**: CLI → Gateway → Capture → Modify → Record → SSE → Web UI

### Migration Strategy
**Complete replacement**: V1 gateway code will be refactored into V2 architecture:
- Rule engine logic: ✅ Keep, refactor for V2
- Adapter logic: ✅ Keep, refactor for V2
- Gateway core: ❌ Replace with enhanced version (adds capture + SSE)
- Main entry: ❌ Replace with dual-server startup
- Config system: ❌ Replace with API + file sync
- Tests: ❌ Update for new architecture

**Result**: V1 functionality is preserved but enhanced with V2 capabilities. No rollback needed because V2 is a strict superset.

## What Changes

### Backend Changes (Complete Rewrite + Enhancement)
- **New API Server** (port 7071): RESTful API for rule/request/config management
- **Database Layer**: SQLite storage for request history with automatic cleanup
- **SSE Server**: Real-time event streaming for new request notifications
- **Gateway Enhancement**: Adds request capture, recording, and SSE broadcasting to existing proxy logic
- **New API Endpoints**:
  - `GET /_promptxy/requests` - Request history with pagination/filtering
  - `GET /_promptxy/requests/:id` - Request detail with original/modified diff
  - `GET /_promptxy/events` - SSE connection for real-time updates
  - `POST /_promptxy/config/sync` - Update rules and apply immediately
  - `GET /_promptxy/config` - Read current configuration
  - `POST /_promptxy/requests/cleanup` - Manual data cleanup

### Frontend Changes (New Addition)
- **New Web UI**: Single-page application for managing all aspects
- **Pages**:
  - RulesPage: Visual rule list, editor, CRUD operations
  - RequestsPage: Request history with filtering and search
  - RequestDetail: Modal showing original vs modified request diff
  - PreviewPage: Rule testing sandbox
  - SettingsPage: Configuration management
- **Real-time Features**: SSE client for live request updates
- **Data Management**: Export/import rules and request history
- **Desktop-Only**: Optimized for desktop browsers, no mobile support

### Architecture Changes
- **Port Split**: Gateway on 7070, API on 7071 (production: unified on 7071)
- **Data Flow**: CLI → Gateway (7070) → Capture → Modify → Forward → Record → SSE → UI
- **Storage**: `~/.local/promptxy/promptxy.db` (SQLite) + `~/.local/promptxy/config.json`
- **Deployment**: Separate dev mode (independent servers) and production mode (unified)

### Code Reuse from V1
- ✅ **Rule Engine Logic**: `src/promptxy/rules/engine.ts` - Core algorithm preserved
- ✅ **Adapter Logic**: `src/promptxy/adapters/*.ts` - Protocol-specific mutations preserved
- ✅ **Type Definitions**: Enhanced from V1 types
- ✅ **HTTP Utilities**: Enhanced with database/SSE support
- ❌ **Gateway Core**: Replaced with enhanced version (adds capture + SSE)
- ❌ **Main Entry**: Replaced with dual-server startup
- ❌ **Config System**: Replaced with API + file sync

## Impact

### Affected Specs (New)
- `promptxy-backend-api` - Complete backend API specification
- `promptxy-frontend-ui` - Complete frontend UI specification

### Affected Code
- **New Files** (Backend):
  - `backend/src/promptxy/database.ts` - SQLite operations
  - `backend/src/promptxy/api-server.ts` - REST API server
  - `backend/src/promptxy/types.ts` - TypeScript type definitions
  - Modified: `backend/src/main.ts` - Launch both servers
  - Modified: `backend/src/promptxy/gateway.ts` - Add request capture & SSE

- **New Files** (Frontend):
  - `frontend/src/` - Complete React application structure
  - `frontend/package.json` - Vite + React + HeroUI dependencies
  - `frontend/vite.config.ts` - Build configuration

### Compatibility
- **Backward Compatible**: Existing gateway functionality unchanged
- **New Capabilities**: Additive only, no breaking changes
- **CLI Configuration**: No changes required for existing setups

### Security
- **Localhost Only**: API server binds to 127.0.0.1 by default
- **No Credential Storage**: API keys remain in CLI environment only
- **Sensitive Header Filtering**: Logs exclude Authorization headers
- **Data Retention**: Automatic cleanup of old request history

### Performance
- **Database**: SQLite handles 1000+ requests efficiently with indexes
- **Frontend**: Virtual scrolling for large request lists
- **Real-time**: SSE is lightweight compared to WebSocket
- **Memory**: Request history limited to 100 records by default

### Deployment
- **Development**: Two separate servers (gateway + API + frontend dev server)
- **Production**: Single binary serving API + static frontend files
- **Build Process**: Frontend built to static files, served by backend

### Compatibility & Migration
- **Backward Compatible**: V2.0 is a superset of V1 - all V1 functionality remains unchanged
- **No Breaking Changes**: Existing CLI configurations work without modification
- **Additive Only**: New features (UI, API, database) are completely optional
- **Gradual Adoption**: Users can start with V1 workflow and adopt V2 features at their own pace
- **No Migration Required**: New database is purely additive; existing config.json works unchanged
- **No Rollback Needed**: If V2 features have issues, users can simply ignore them and continue using V1 CLI-only workflow
