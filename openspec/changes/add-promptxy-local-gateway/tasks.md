## 1. Implementation

- [x] 1.1 Scaffold `promptxy` minimal Node/TS service (no UI)
- [x] 1.2 Add config loader (file + env overrides) and validate config schema
- [x] 1.3 Implement rules engine with ordered operations (replace/delete/append/prepend/insert/set)
- [x] 1.4 Add unit tests for rules engine (regex, ordering, no-op cases)
- [x] 1.5 Implement gateway HTTP server with route prefixes: `/` (Anthropic), `/openai`, `/gemini`
- [x] 1.6 Implement Claude adapter: extract/modify/write-back `system` while preserving non-text blocks
- [x] 1.7 Implement Codex adapter: extract/modify/write-back `instructions` with safety around required prefixes
- [x] 1.8 Implement Gemini adapter (Gemini API Key mode, best-effort): support common system-instruction fields; fallback to passthrough
- [x] 1.9 Add integration tests using a mocked upstream server (stream + non-stream)
- [x] 1.10 Write local usage docs for 3 CLIs (env/config examples, troubleshooting)

## 2. Validation

- [x] 2.1 Run unit tests and integration tests locally
- [x] 2.2 Document manual smoke test steps for each CLI (Claude Code, Codex CLI, Gemini CLI - Gemini API Key mode)

## 3. Notes

- Dependencies can be kept minimal; avoid adding Redis/DB/UI for MVP.
- Parallelizable work: 1.3–1.4 (rules) can be done in parallel with 1.5 (gateway skeleton).
