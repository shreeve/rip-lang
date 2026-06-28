<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# @rip-lang/ai

> **Persistent multi-model AI consultation MCP — discuss, panel, fresh-review, content-hashed attachments, live model catalog**

An MCP stdio server that lets the AI you're working with consult its peers — across providers, with conversations that survive restarts, attachments that travel between turns, and parallel model panels with synthesis. ~2,000 lines of Rip, zero npm dependencies (uses `bun:sqlite` and `bun`'s built-in `fetch`).

## Why this exists

Cursor's native `Task` subagents already give a peer model full tool access. This package focuses on the things subagents don't do:

- **Two models, zero guesswork** — `gpt` (latest OpenAI) and `claude` (latest Anthropic), autodetected live and cached
- **Persistent conversations** that survive IDE / server / machine restarts
- **Multi-model panels** with optional synthesis
- **Content-hashed attachments** reused across turns, with change detection
- **Cost transparency** on every call, with optional caps
- **Independence guarantees** for unbiased fresh review (avoids coauthor models)

## Install

```bash
bun add @rip-lang/ai
```

Add to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "ai": { "command": "rip-ai" }
  }
}
```

API keys come from environment variables or `~/.config/rip/credentials`:

```bash
mkdir -p ~/.config/rip
cat > ~/.config/rip/credentials << 'EOF'
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EOF
chmod 600 ~/.config/rip/credentials
```

Environment variables always win over the file.

## Storage

```
~/.config/rip-ai/
  conversations.db          SQLite (WAL, mode 0600)
  attachments/ab/cd/<sha>   content-addressed cache (mode 0600)
  models.json               catalog disk cache (informational)
  latest.json               resolved latest gpt/claude ids, 12h TTL
```

The DB is auto-created on first run. If it gets corrupted, the server quarantines it (`*.corrupt.<timestamp>`) and creates a fresh one — `status` reports the recovery.

## Tools

### status

Server info, credential availability, defaults, conversation count, db path.

### list_models

Resolved provider catalog. **Rarely needed** — just pass `model: "gpt"` or `"claude"`. Use this only when you want the concrete version string behind an alias.

```
list_models()                      # all providers, memory-cached 5min
list_models({ provider: "openai" })
list_models({ refresh: true })     # bypass cache
```

Each entry has: `id`, `provider`, `provider_model`, `display`, `available`, `is_latest` (the current flagship pick), `pricing`, `created_at`, `source`.

### chat

One-shot peer message, no persistence.

```
chat({ prompt: "Is this O(n²) or O(n)?", model: "claude" })
chat({
  prompt: "Spot the bug",
  attachments: [{ type: "file", path: "src/compiler.js" }]
})
```

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string | yes | |
| `model` | string | no | `"gpt"` (latest OpenAI) or `"claude"` (latest Anthropic). Defaults to `"gpt"`. An explicit `"provider:model"` also works. |
| `system` | string | no | |
| `attachments` | array | no | See **Attachments** below. |
| `max_tokens` | int | no | |
| `max_cost_usd` | number | no | Refuse if estimated input cost would exceed this cap. |

### discuss

Multi-turn conversation, persistent across server restarts. Pass the same `conversation_id` to continue.

```
discuss({ message: "Should we use a B-tree or a hash here?" })
# returns conversation_id; reuse it:
discuss({ conversation_id: "c_a1b2…", message: "What about cache locality?" })
discuss({
  conversation_id: "c_a1b2…",
  message: "Reread the file — has it changed?",
  attachments: [{ type: "file", path: "src/cache.rip" }]
})
```

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `message` | string | yes | |
| `conversation_id` | string | no | Omit to create a new conversation. |
| `model` | string | no | `"gpt"` or `"claude"`. Defaults to `"claude"`. |
| `system` | string | no | Used only on the first turn. |
| `attachments` | array | no | Hashed; if a file's hash changes between turns, the peer is told. |
| `independent_of` | string[] | no | Labels of artifacts / drafts to stay independent from. Mismatches surface as warnings. |
| `max_tokens` / `max_cost_usd` | | no | |

Returns: `conversation_id`, `message_id`, `response_id`, `text`, `attachments`, `changed_attachments`, per-call `usage`, conversation-wide `conversation_usage`, `warnings`.

### panel

Send the same prompt to several models in parallel. Optional synthesis over successful responses.

```
panel({
  prompt: "Critique this approach",
  models: ["gpt", "claude"],
  synthesize: true,
  attachments: [{ type: "file", path: "PLAN.md" }]
})
```

Returns `responses[]` (per-model results, including failures), an optional `synthesis` block, total `usage`, `warnings`. One model failure does not fail the panel; only "all panelists failed" raises.

### fresh_review

Independent review of an artifact. `exclude_models` lets you avoid models that previously coauthored it.

```
fresh_review({
  artifact: "PLAN.md",
  prompt: "Be hostile. Find what's wrong.",
  exclude_models: ["claude"]
})
```

If a `model` is given and it's in `exclude_models`, the call fails fast. If no model is given, the server picks the first credentialed default that isn't excluded.

### Conversation management

| Tool | Params | Returns |
|---|---|---|
| `list_conversations` | `limit?`, `before?`, `include_redacted?` | `conversations: [...]` |
| `get_conversation` | `conversation_id`, `include_attachments?` | `conversation, messages: [...]` |
| `delete_conversation` | `conversation_id` | `{ deleted: true, conversation_id }` |
| `export_conversation` | `conversation_id`, `format: "json" \| "markdown"` | `{ format, content }` |
| `redact` | `conversation_id`, `mode: "content" \| "all"` | `{ redacted: true, mode }` |

`redact("content")` replaces every message text with `[redacted]` and clears attachment refs but keeps the row + token/cost totals. `redact("all")` removes every message but keeps the conversation row and totals.

## Attachments

All tools that send a prompt accept an `attachments` array:

```js
[
  { type: "file", path: "src/compiler.js" },
  { type: "url",  url:  "https://example.com/spec.txt" },
  { type: "blob", name: "snippet.rip", content: "x = 42\n" }
]
```

Each attachment is loaded once, hashed (SHA-256), and cached on disk. On later turns of the same `discuss`, attachments with the same source path but a different hash are flagged in `changed_attachments` and the peer is told the hash before/after.

| Limit | Value |
|---|---|
| Per attachment | 2 MB |
| Per call (sum) | 8 MB |
| URL protocols | `http`, `https` (no private IPs) |
| URL redirects | up to 3 |
| URL timeout | 10 s |

Binary content (image / audio / video, files containing null bytes) is sent as a metadata stub only. Provider-native file uploads are out of scope for this version.

## Models

Two models, both **autodetected live** — no version string to remember and nothing to bump when providers ship a new release:

| Alias | Resolves to |
|---|---|
| `gpt` (also `chatgpt`, `openai`, `gpt-latest`) | the latest OpenAI flagship |
| `claude` (also `anthropic`, `opus`, `claude-latest`) | the latest Anthropic flagship |

Defaults:

| Tool | Default | Override |
|---|---|---|
| `chat` | `gpt` | `model` parameter |
| `discuss` | `claude` | `model` parameter |
| `panel` synthesis | `gpt` | `synthesis_model` parameter |
| `fresh_review` | first credentialed default not in `exclude_models` | `model` parameter |

You can still pin an exact model with the canonical `provider:model` form (e.g. `openai:gpt-5.5`) anywhere a `model:` is accepted.

### How "latest" is resolved

On the first call (and at most once every 12h after), the server queries each provider's `/models` API and picks the **highest-versioned id in the flagship family**, then caches it to `~/.config/rip-ai/latest.json`. The hot path reads the cache — no per-call network. The server also warms the cache in the background at startup, so by the time you call a tool the concrete version is usually already resolved.

The flagship families and offline fallbacks live at the top of `lib/providers.rip`:

```
FAMILY  = { openai: /^gpt-\d+(?:\.\d+)*$/, anthropic: /^claude-opus-\d+(?:[-.]\d+)*$/ }
SEED    = { openai: 'openai:gpt-5.5',      anthropic: 'anthropic:claude-opus-4-8' }
PRICING = { openai: {…}, anthropic: {…} }   # per-1M-token rates, provider-scoped
```

Change `FAMILY` only if a provider renames its flagship tier (e.g. Anthropic moving off `opus`). `SEED` is only used cold / offline — a live refresh overrides it. `PRICING` is provider-scoped so an autodetected successor inherits rates without a code change.

## Cost

Every tool that calls a model returns a `usage` object with a token breakdown, the dollar cost, and a ready-to-print one-line `summary`:

```json
{
  "tokens_in": 12525,
  "tokens_out": 7290,
  "reasoning_tokens": 3200,
  "cached_tokens": 0,
  "cost_usd": 0.171975,
  "summary": "12,525 in · 7,290 out (3,200 reasoning + 4,090 answer) · $0.1720"
}
```

`reasoning_tokens` is the hidden reasoning portion of the output (OpenAI reasoning models; Anthropic folds thinking into `tokens_out`). `cached_tokens` is the cached-input portion when the provider reports it. `discuss` also returns `conversation_usage` (same shape) with rolling conversation totals; `panel`'s `usage` is the summed total across all panelists plus synthesis.

`max_cost_usd` (or `per_model_max_cost_usd` for `panel`) refuses calls whose preflight estimate exceeds the cap, and warns when actual cost overshoots after the fact.

## Failure semantics

| Situation | Behavior |
|---|---|
| Missing API key for the targeted model | JSON-RPC error |
| `panel` member fails | other members continue; failures appear with `ok: false` in `responses[]` |
| All `panel` members fail | JSON-RPC error |
| Attachment file disappears between turns | last cached content used, with a warning |
| URL fetch fails (timeout, redirect loop, private IP, 4xx, 5xx) | tool error |
| SQLite db corrupt at startup | quarantined to `*.corrupt.<ts>`, fresh DB created, `status` reports recovery |
| Cost cap exceeded preflight | refuse with explanatory error |
| Cost cap exceeded post-hoc | succeed, surface in `warnings[]` |

## Layout

```
mcp.rip                   protocol entry, JSON-RPC dispatch
lib/credentials.rip       env + ~/.config/rip/credentials
lib/store.rip             SQLite schema, CRUD, attachment records
lib/attachments.rip       file/url/blob load, SHA-256 cache, prompt rendering
lib/openai.rip            OpenAI adapter (chat, list_models)
lib/anthropic.rip         Anthropic adapter (chat, list_models)
lib/providers.rip         latest-model autodetect + cache, pricing, cost, catalog
lib/tools.rip             handlers for all 11 MCP tools
bin/rip-ai                CLI shim (exec rip mcp.rip via the loader)
```

## Requirements

- **Bun** 1.0+ (uses `bun:sqlite` and `fetch`)
- **rip-lang** 3.14.5+
- At least one provider key (OpenAI and/or Anthropic)

## License

MIT
