# promptxy (local prompt gateway)

`promptxy` is a local (`127.0.0.1`) HTTP gateway that lets you **search / replace / insert / append / delete**
system instructions in requests coming from:

- Claude Code (Anthropic Messages API)
- Codex CLI (OpenAI Responses API)
- Gemini CLI (Gemini API Key mode)

It works by pointing each CLI’s `base_url/endpoint` to `promptxy`, then applying rules to the request body
and forwarding it to the real upstream API.

## Quick Start

### 1) Install deps

```bash
npm install
```

### 2) Create a config

Copy the example and edit it:

```bash
cp promptxy.config.example.json promptxy.config.json
```

### 3) Run

```bash
npm run dev
```

Health check:

```bash
curl -s http://127.0.0.1:7070/_promptxy/health
```

## Config

By default `promptxy` searches config in this order:

1. `PROMPTXY_CONFIG=/path/to/config.json`
2. `./promptxy.config.json` (current working directory)
3. `~/.promptxy/config.json`

### Env overrides

- `PROMPTXY_HOST` (default `127.0.0.1`)
- `PROMPTXY_PORT` (default `7070`)
- `PROMPTXY_UPSTREAM_ANTHROPIC` (default `https://api.anthropic.com`)
- `PROMPTXY_UPSTREAM_OPENAI` (default `https://api.openai.com`)
- `PROMPTXY_UPSTREAM_GEMINI` (default `https://generativelanguage.googleapis.com`)
- `PROMPTXY_DEBUG=1` (prints rule application summary; does NOT log auth headers)

## Rules

Rules match by `(client, field)` and optionally by method/path/model.

Supported clients:
- `claude`
- `codex`
- `gemini`

Supported fields:
- `system` (Claude + Gemini)
- `instructions` (Codex)

Supported operations:
- `set`
- `append`
- `prepend`
- `replace` (string match or regex)
- `delete` (string match or regex)
- `insert_before` (regex)
- `insert_after` (regex)

See `promptxy.config.example.json` for a minimal working example.

## CLI Setup

### Claude Code

Point Claude Code to `promptxy`:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:7070"
```

Auth is **passed through** from the CLI request. `promptxy` does not store upstream keys.

### Codex CLI

In `~/.codex/config.toml`, add a provider using the Responses API:

```toml
model_provider = "promptxy"
wire_api = "responses"

[model_providers.promptxy]
name = "promptxy"
base_url = "http://127.0.0.1:7070/openai"
wire_api = "responses"
requires_openai_auth = true
```

Codex credentials are passed through as-is.

### Gemini CLI (Gemini API Key mode)

Point Gemini API base URL to `promptxy`:

```bash
export GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:7070/gemini"
```

Gemini API key is passed through as-is (commonly via `x-goog-api-key` or query `key=` depending on the client).

## Notes

- This is a **local gateway**: it does not implement multi-user auth, quotas, or account pooling.
- Streaming responses are proxied as bytes (no SSE parsing / no response rewriting in MVP).
- `PROMPTXY_DEBUG=1` prints which rules applied, but does not print credential headers (e.g. `Authorization`).

## Manual Smoke Test (CLI)

These steps verify that each CLI is actually calling `promptxy` on localhost.

1) Start `promptxy` with debug on:

```bash
PROMPTXY_DEBUG=1 npm run dev
```

2) Run one simple request from each CLI and confirm you see a log line like:
`[promptxy] <CLIENT> <METHOD> <PATH> -> <UPSTREAM_URL> (rules=... ops=...)`

### Claude Code

- Ensure `ANTHROPIC_BASE_URL` is set (see above)
- Run a minimal prompt (example):

```bash
claude -p "say hi"
```

### Codex CLI

- Ensure your provider base URL points to `/openai` (see above)
- Run a minimal prompt (example):

```bash
codex "say hi"
```

### Gemini CLI (Gemini API Key mode)

- Ensure `GOOGLE_GEMINI_BASE_URL` points to `/gemini` (see above)
- Run a minimal prompt (example):

```bash
gemini "say hi"
```

