## Context

### Background

The `promptxy` project started as a local HTTP proxy (MVP) for modifying prompts sent to AI CLI tools (Claude Code, Codex CLI, Gemini CLI). The MVP provides:

- Rule-based prompt modification
- Request forwarding to upstream APIs
- CLI configuration support

However, users face significant usability challenges:

1. **No visibility** - Cannot see what requests passed through
2. **Manual config** - Must edit JSON files by hand
3. **No debugging** - Cannot easily verify rules work
4. **No history** - Past requests are lost

### Existing Documentation

Three comprehensive documents outline the v2.0 vision:

- `docs/ARCHITECTURE.md` - Overall system design
- `docs/BACKEND_API_EXTENSION.md` - API and database specification
- `docs/WEB_UI_DESIGN.md` - Frontend UI design

### Current State

- **Completed**: MVP gateway with rule engine (`add-promptxy-local-gateway`)
- **In Progress**: Documentation (`add-promptxy-docs`)
- **This Change**: Full v2.0 implementation

## Goals / Non-Goals

### Goals

1. **Complete v2.0 Architecture**: Implement all features from design docs
2. **Request Capture & Visibility**: Store and display all proxied requests
3. **Visual Rule Management**: CRUD operations via web UI
4. **Real-time Updates**: Live request monitoring via SSE
5. **Request Analysis**: Original vs modified diff view
6. **Developer Experience**: Fast, intuitive, beautiful UI

### Non-Goals

1. **Cloud Deployment**: Focus on local development only
2. **Multi-user Support**: Single user, local machine
3. **Advanced Analytics**: Basic stats only (count, success rate)
4. **Mobile UI**: Desktop-first design (not needed for local tool)
5. **Plugin System**: Core features only

## Decisions

### Decision 1: Port Separation (7070 + 7071)

**What**: Gateway on 7070, API on 7071

**Why**:

- **Separation of Concerns**: Gateway handles proxy logic, API handles management
- **Independent Scaling**: Can scale API independently if needed
- **Clear Boundaries**: Different responsibilities, different lifecycles
- **Development Simplicity**: Can restart API without affecting active proxy

**Alternatives Considered**:

- Single port with path-based routing: Simpler but mixes concerns
- Unix sockets: Overkill for local tool
- Dynamic ports: Harder for users to configure

**Trade-offs**:

- - Clean architecture, easier to maintain
- - Requires two ports to be available

### Decision 2: SQLite for Request Storage

**What**: Use SQLite in `~/.local/promptxy/promptxy.db`

**Why**:

- **Zero Setup**: No external database required
- **File-based**: Easy backup, version control optional
- **Query Power**: SQL for filtering, pagination, aggregation
- **Performance**: Excellent for 100-1000 records
- **Reliability**: ACID compliance, crash-safe

**Alternatives Considered**:

- JSON files: Simple but poor query performance, no concurrency
- IndexedDB (browser only): Doesn't work for backend
- Redis: Requires separate process, overkill
- Flat file with line-delimited JSON: No query capability

**Trade-offs**:

- - Perfect for local tool scale
- - Requires native module (sqlite3) - but acceptable for Node.js

### Decision 3: SSE for Real-time Updates

**What**: Server-Sent Events for request notifications

**Why**:

- **Simplicity**: One-way server→client is all we need
- **Native Support**: No external libraries needed
- **HTTP Compatible**: Works through proxies, firewalls
- **Resource Efficient**: Lightweight connections
- **Automatic Reconnect**: Built into browser EventSource

**Alternatives Considered**:

- WebSocket: Full duplex, but requires ws library, more complex
- Polling: Simple but inefficient, higher latency
- Long polling: Complex server-side, resource heavy

**Trade-offs**:

- - Perfect fit for our use case (server push only)
- - Limited to text data (but we only send JSON)

### Decision 4: React + HeroUI for Frontend

**What**: Modern React with HeroUI component library

**Why**:

- **Component Rich**: Pre-built forms, tables, modals, tabs
- **TypeScript Native**: Full type safety
- **Tailwind Integration**: Easy theming and customization
- **Developer Experience**: Fast development, professional look
- **Active Maintenance**: Well-supported library

**Alternatives Considered**:

- Vanilla JS: Too slow to develop, no component model
- Vue: Good but React more familiar to target audience
- MUI/Chakra: Similar but HeroUI has better defaults
- No framework: Reinventing wheels, poor DX

**Trade-offs**:

- - Professional UI, fast development
- - Bundle size (acceptable for local tool)

### Decision 5: Zustand + TanStack Query

**What**: Lightweight state management + data fetching

**Why**:

- **Zustand**: Minimal boilerplate, works well with TypeScript
- **TanStack Query**: Caching, retries, background updates
- **Separation**: Query handles server state, Zustand handles UI state
- **Performance**: Optimized re-renders

**Alternatives Considered**:

- Redux: Overkill, too much boilerplate
- Context API alone: Causes unnecessary re-renders
- MobX: More magic, harder to debug

**Trade-offs**:

- - Modern, lightweight, powerful
- - Two libraries to learn (but both are simple)

### Decision 6: Request Data Model

**What**: Store original + modified body + matched rules

**Why**:

- **Debugging**: Need to see what changed
- **Audit Trail**: Understand rule impact
- **Replay**: Can re-test with same data
- **Analysis**: Identify problematic rules

**Schema Design**:

```typescript
interface RequestRecord {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  originalBody: string; // JSON string
  modifiedBody: string; // JSON string
  matchedRules: string; // JSON array
  responseStatus?: number;
  durationMs?: number;
  error?: string;
}
```

**Why JSON strings**:

- SQLite TEXT is simple
- Preserves exact structure
- Easy to query with JSON functions if needed
- No schema migration needed for upstream API changes

**Indexes**:

- `timestamp DESC` - for sorting
- `client` - for filtering
- `client, timestamp DESC` - combined queries

### Decision 7: Automatic Data Cleanup

**What**: Keep last 100 requests, auto-cleanup every hour

**Why**:

- **Privacy**: Don't accumulate sensitive data forever
- **Performance**: Small database = fast queries
- **Disk Space**: Prevent unbounded growth
- **Simplicity**: Set-and-forget

**Configuration**:

```typescript
storage: {
  maxHistory: 100,
  autoCleanup: true,
  cleanupInterval: 1 // hours
}
```

**Cleanup SQL**:

```sql
DELETE FROM requests
WHERE id NOT IN (
  SELECT id FROM requests
  ORDER BY timestamp DESC
  LIMIT ?
)
```

**Alternatives**:

- Manual cleanup only: Users forget, DB grows
- Time-based retention: Harder to reason about
- Size-based: Unpredictable

### Decision 8: Production Deployment Model

**What**: Frontend built to static files, served by backend

**Why**:

- **Single Binary**: One process to manage
- **Single Port**: Only port 7071 needed in production
- **Simplicity**: Easier deployment and operation
- **No CORS**: Same origin in production

**Development Mode**:

- Backend: ports 7070 + 7071
- Frontend: Vite dev server on 5173
- CORS enabled for cross-origin requests

**Production Mode**:

- Backend: port 7071 serves API + static files
- Frontend: Built to `backend/public/`
- No CORS needed

**Alternatives Considered**:

- Separate frontend server: More complex, requires CORS
- CDN deployment: Overkill for local tool

**Trade-offs**:

- - Simple, single binary
- - Frontend build step required

### Decision 9: No Rollback Design Required

**What**: V2.0 is purely additive, no rollback mechanism needed

**Why**:

- **Superset Architecture**: V2.0 includes all V1 functionality plus new features
- **Optional Features**: UI/API/database are completely optional
- **Zero Risk**: If V2 features don't work, users continue with V1 workflow
- **No Migration**: Existing configs and workflows unchanged
- **Gradual Adoption**: Users can adopt V2 features at their own pace

**Implementation**:

- V1 functionality: CLI-only, file-based config, no database
- V2 additions: Web UI, API server, SQLite database
- Both can coexist - V2 features are opt-in

**Trade-offs**:

- - Zero risk, backward compatible
- - No complex migration or rollback procedures
- - Users can ignore V2 features if preferred
- - None (purely additive change)

### Decision 10: Security Model

**What**: Localhost-only, no credential storage, header filtering

**Why**:

- **Localhost Only**: Prevents network exposure
- **No Credential Storage**: Keys stay in CLI environment
- **Header Filtering**: Prevents accidental logging of secrets
- **Principle of Least Privilege**

**Implementation**:

```typescript
// Gateway binds to 127.0.0.1 by default
listen: {
  host: '127.0.0.1',
  port: 7070
}

// Sensitive headers filtered from logs
const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'api-key'];
```

**Trade-offs**:

- - Secure by default
- - Cannot access from other machines (intentional)

### Decision 11: Rule Editor Design

**What**: Dynamic form based on operation type

**Why**:

- **User Friendly**: Only show relevant fields
- **Validation**: Prevent invalid configurations
- **Discoverability**: Users see what's possible
- **Type Safety**: TypeScript ensures correctness

**Dynamic Field Mapping**:

```typescript
const opTypeFields = {
  set: ['text'],
  append: ['text'],
  prepend: ['text'],
  replace: ['match', 'regex', 'flags', 'replacement'],
  delete: ['match', 'regex', 'flags'],
  insert_before: ['regex', 'flags', 'text'],
  insert_after: ['regex', 'flags', 'text'],
};
```

**Alternatives**:

- JSON editor: Powerful but error-prone
- YAML editor: Better syntax but still manual

### Decision 12: Diff Visualization

**What**: Side-by-side view with syntax highlighting

**Why**:

- **Clarity**: See changes in context
- **Developer Familiar**: Like GitHub diff view
- **Multiple Formats**: JSON pretty-printed, line-level diff
- **Interactive**: Can collapse/expand sections

**Implementation Strategy**:

1. Parse JSON
2. Pretty-print both versions
3. Line-by-line comparison
4. Highlight added/removed/modified lines
5. Show matched rules alongside

**Alternatives**:

- Inline diff: Harder to read for large changes
- Character-level: Too noisy for JSON

### Decision 13: Error Handling Strategy

**What**: Graceful degradation with user-friendly messages

**Why**:

- **Resilience**: UI doesn't crash on API errors
- **Clarity**: Users understand what went wrong
- **Recovery**: Clear next steps

**Layers**:

1. **API Layer**: Retry, timeout, error parsing
2. **Hook Layer**: React Query error boundaries
3. **Component Layer**: Error states, empty states
4. **Page Layer**: Full-page error handling

**Specific Cases**:

- API down: "Cannot connect to backend" + retry button
- Invalid config: "Config validation failed" + show errors
- SSE disconnect: "Live updates paused" + reconnect button
- Empty data: "No requests yet" + getting started guide

## Risks / Trade-offs

### Risk 1: SQLite Performance at Scale

**Risk**: Performance degrades with 10,000+ records
**Mitigation**:

- Automatic cleanup keeps DB small
- Indexes on common queries
- Virtual scrolling in UI
- Acceptable: Local tool, unlikely to hit this scale

### Risk 2: Frontend Bundle Size

**Risk**: React + HeroUI + dependencies = large bundle
**Mitigation**:

- Code splitting by routes
- Vite optimization
- Acceptable: Local tool, fast internet expected

### Risk 3: Cross-Platform Compatibility

**Risk**: SQLite or file paths work differently on Windows/Mac/Linux
**Mitigation**:

- Use Node.js path module
- Test on all platforms
- Use standard SQLite driver

### Risk 4: SSE Connection Stability

**Risk**: Connections drop, events missed
**Mitigation**:

- Automatic reconnection in EventSource
- UI shows connection status
- Can manually refresh request list

### Risk 5: Rule Complexity

**Risk**: Users create complex rules that are hard to debug
**Mitigation**:

- Preview feature in rule editor
- Step-by-step rule application view
- Rule execution logging (optional)

### Risk 6: API Breaking Changes

**Risk**: Upstream APIs change, breaking adapters
**Mitigation**:

- Adapter pattern isolates changes
- Fallback to passthrough
- Configurable upstream URLs

### Risk 7: State Management Complexity

**Risk**: Too many Zustand stores + Query caches = confusion
**Mitigation**:

- Clear separation: Query = server state, Zustand = UI state
- Documentation in code
- Keep stores minimal

### Risk 8: CORS Issues in Dev

**Risk**: Frontend dev server can't reach backend
**Mitigation**:

- Explicit CORS configuration
- Clear error messages
- Dev script sets up everything

## Migration Plan

### From MVP to v2.0

**Step 1: Backend Extension** (This change)

- Add database layer
- Add API server
- Enhance gateway
- No breaking changes to existing functionality

**Step 2: Frontend Implementation** (This change)

- New web UI
- Existing CLI users unaffected
- New users get full experience

**Step 3: Documentation Update** (This change)

- Update README
- Add migration guide
- Deprecate old patterns if needed

### Data Migration

- **No migration needed**: New database is additive
- **Config**: Existing config.json works unchanged
- **Users**: Can adopt new features gradually

### Rollback

- **Not required**: V2.0 is a superset of V1
- If V2 features have issues, users can simply ignore them
- V1 CLI-only workflow continues working unchanged

## Open Questions

1. **Q**: Should we support multiple config files?
   **A**: No for v2.0, keep single config. Can add later if needed.

2. **Q**: How to handle very large request bodies?
   **A**: Truncate in UI, store full in DB, configurable limits.

3. **Q**: Should we add health check endpoint?
   **A**: Yes, for monitoring and UI status indicator.

4. **Q**: What about request body size limits?
   **A**: Configurable, default to reasonable 1MB.

5. **Q**: Should we add request replay feature?
   **A**: Yes, in RequestDetail modal - "Replay" button.

6. **Q**: How to handle streaming responses in history?
   **A**: Store final aggregated response, not intermediate chunks.

7. **Q**: Should we add rule import/export?
   **A**: Yes, via config sync endpoints.

8. **Q**: What about mobile access?
   **A**: Not in scope for v2.0. Local tool is desktop-focused.

## Summary

This design provides a complete, production-ready v2.0 implementation that:

- ✅ Solves all MVP usability problems
- ✅ Follows existing design documents
- ✅ Uses proven, modern technologies
- ✅ Maintains backward compatibility
- ✅ Prioritizes security and privacy
- ✅ Optimizes for developer experience
- ✅ Scales appropriately for local tool use case
- ✅ Requires no rollback mechanism (purely additive)
- ✅ Ignores mobile concerns (desktop-only tool)
