<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# @rip-lang/ai

> **Persistent multi-model AI consultation MCP — discuss, panel, fresh-review, content-hashed attachments, live model catalog**

An MCP stdio server that lets the AI you're working with consult its peers — across providers, with conversations that survive restarts, attachments that travel between turns, and parallel model panels with synthesis. ~2,000 lines of Rip, zero npm dependencies (uses `bun:sqlite` and `bun`'s built-in `fetch`).

## Why this exists

Cursor's native `Task` subagents already give a peer model full tool access. This package focuses on the things subagents don't do:

- **Persistent conversations** that survive IDE / server / machine restarts
- **Multi-model panels** with optional cheap-model synthesis
- **Content-hashed attachments** reused across turns, with change detection
- **Live model catalog** queried from provider APIs at call time
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
  models.json               catalog disk cache, 24h TTL
```

The DB is auto-created on first run. If it gets corrupted, the server quarantines it (`*.corrupt.<timestamp>`) and creates a fresh one — `status` reports the recovery.

## Tools

### status

Server info, credential availability, defaults, conversation count, db path.

### list_models

Live + local merged catalog with capability metadata.

```
list_models()                      # all providers, memory-cached 5min
list_models({ provider: "openai" })
list_models({ refresh: true })     # bypass cache
```

Each entry has: `id`, `provider`, `provider_model`, `available`, `tool_use`, `context`, `tier` (`frontier` | `mid` | `cheap` | `unknown`), `strengths`, `pricing`, `source` (`live+local` | `live` | `local`).

### chat

One-shot peer message, no persistence.

```
chat({ prompt: "Is this O(n²) or O(n)?", model: "claude-opus-4-7" })
chat({
  prompt: "Spot the bug",
  attachments: [{ type: "file", path: "src/compiler.js" }]
})
```

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string | yes | |
| `model` | string | no | `"provider:model"` or alias (`gpt`, `opus`, `haiku`, …). Defaults to `openai:gpt-5.5`. |
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
| `model` | string | no | Defaults to `anthropic:claude-opus-4-7`. |
| `system` | string | no | Used only on the first turn. |
| `attachments` | array | no | Hashed; if a file's hash changes between turns, the peer is told. |
| `independent_of` | string[] | no | Labels of artifacts / drafts to stay independent from. Mismatches surface as warnings. |
| `max_tokens` / `max_cost_usd` | | no | |

Returns: `conversation_id`, `message_id`, `response_id`, `text`, `attachments`, `changed_attachments`, per-call `usage`, conversation-wide `conversation_usage`, `warnings`.

### panel

Send the same prompt to several models in parallel. Optional cheap-model synthesis over successful responses.

```
panel({
  prompt: "Critique this approach",
  models: ["openai:gpt-5.5", "anthropic:claude-opus-4-7", "anthropic:claude-haiku-4-1"],
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
  exclude_models: ["anthropic:claude-opus-4-7"]
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

Default models:

| Tool | Default | Override |
|---|---|---|
| `chat` | `openai:gpt-5.5` | `model` parameter |
| `discuss` | `anthropic:claude-opus-4-7` | `model` parameter |
| `panel` synthesis | `openai:gpt-5.5-mini` | `synthesis_model` parameter |
| `fresh_review` | first credentialed default not in `exclude_models` | `model` parameter |

Aliases recognized in any `model:` parameter: `gpt`, `gpt-5.5`, `gpt-5.4`, `mini`, `claude`, `opus`, `claude-opus-4-7`, `claude-opus-4-6`, `sonnet`, `claude-sonnet-4-5`, `haiku`, `claude-haiku-4-1`, `openai`, `anthropic`. Or use the canonical `provider:model` form.

Pricing constants in `lib/providers.rip` are seeded from public rates and are easy to update.

## Cost

Every tool that calls a model returns `usage: { tokens_in, tokens_out, cost_usd }`. `discuss` also returns `conversation_usage` rolling totals. `max_cost_usd` (or `per_model_max_cost_usd` for `panel`) refuses calls whose preflight estimate exceeds the cap, and warns when actual cost overshoots after the fact.

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
lib/providers.rip         registry, pricing, capability metadata, cost, catalog cache
lib/tools.rip             handlers for all 11 MCP tools
bin/rip-ai                CLI shim (exec rip mcp.rip via the loader)
```

## Requirements

- **Bun** 1.0+ (uses `bun:sqlite` and `fetch`)
- **rip-lang** 3.14.5+
- At least one provider key (OpenAI and/or Anthropic)

## License

MIT
