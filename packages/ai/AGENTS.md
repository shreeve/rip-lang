# AI Agent Guide for @rip-lang/ai

**Purpose:** This package is an MCP (Model Context Protocol) stdio server that lets the in-chat AI consult its peers across providers, with persistent multi-turn conversations, content-hashed attachments, multi-model panels, and live model catalogs.

It deliberately complements — does not replicate — Cursor's native `Task` subagents. Subagents already give a peer model full tool access (`Read`, `Grep`, `Shell`, etc.). This package owns the things subagents don't:

- conversation state that survives restarts
- attachments that survive turns and detect change
- side-by-side panels with synthesis
- coauthor exclusion
- cost transparency

## Architecture

```text
mcp.rip                   protocol entry — JSON-RPC over stdio, tool dispatch
lib/credentials.rip       env + ~/.config/rip/credentials loader
lib/store.rip             bun:sqlite schema, CRUD, attachment records
lib/attachments.rip       file/url/blob load, SHA-256 cache, prompt rendering
lib/openai.rip            OpenAI adapter (chat, list_models)
lib/anthropic.rip         Anthropic adapter (chat, list_models)
lib/providers.rip         registry, parseModel, pricing, catalog cache, cost
lib/tools.rip             one function per MCP tool — pure orchestration
bin/rip-ai                CLI shim
```

Data flow for a `discuss` call:

```text
stdin JSON-RPC line
    ↓
mcp.rip dispatch
    ↓
tools.discuss(ctx, params)
    ├── store.findConversation / createConversation
    ├── attachments.load → store.recordAttachment
    ├── store.listMessages (for history)
    ├── providers.chat (parses model, selects adapter, applies pricing)
    │     └── openai|anthropic.chat → fetch! → response
    └── store.appendMessage (user msg, assistant msg, totals update)
    ↓
{ conversation_id, response_id, text, usage, ... }
    ↓
stdout JSON-RPC line
```

## Files you can edit

| File | Notes |
|---|---|
| `mcp.rip` | Protocol & tool registration. Add new tools here + in `lib/tools.rip`. |
| `lib/store.rip` | Schema migrations: edit `DDL`. All statements use prepared queries — keep them parameterized. |
| `lib/attachments.rip` | Load/render rules. URL allowlist lives here. |
| `lib/providers.rip` | **Pricing constants and aliases live here.** Update when providers change rates. |
| `lib/openai.rip`, `lib/anthropic.rip` | Adapter HTTP shape. New providers go in their own file plus a registration in `providers.rip` (`ADAPTERS`, alias map, `LOCAL_META`). |
| `lib/tools.rip` | Tool orchestration. Each tool is a separate exported function. |

## Adding a new provider

1. New file `lib/<name>.rip` exporting `provider`, `listModels`, `chat`, matching the adapter shape used by `openai.rip` and `anthropic.rip`.
2. In `lib/providers.rip`, add to `ADAPTERS`, add aliases, add `LOCAL_META` entries (pricing + tier + strengths).
3. Add the provider's env-var name to `providerEnvKey` in `providers.rip` and to `credentialedFor` in `tools.rip`.
4. Update the `provider` enum on `list_models` in `mcp.rip`.

## Adding a new MCP tool

1. Export a handler function from `lib/tools.rip`. It receives `(ctx, params)` and returns a plain object. Throw with a clear message for invalid input.
2. Register it in `mcp.rip`:
   - Add an entry to the `TOOLS` array (name, description, inputSchema)
   - Add an entry to `HANDLERS`
   - Add it to `ASYNC_TOOLS` if it awaits any provider call
3. Document it in `README.md`.

## Idiomatic Rip in this package

- All async calls use the dammit operator (`fetch! url`, `pending!`, `att.load!`). The one exception in this codebase is when `)!` would be ambiguous to the parser — use a temp binding (`pending = ...; result = pending!`).
- Never use the binary existential operator `x ? y` (removed). For nullish defaults use `x ?? y`. For ternary, write `x ? a : b` with both branches.
- Bare `try` (no `catch`) for fire-and-forget error suppression (e.g. `try chmodSync(...)`).
- Helper globals — `p`, `pp`, `warn`, `kind`, `assert`, `raise`, `noop` — are auto-injected into `globalThis`. Don't shadow them with locals (`p = ...`, `warn = ...` will subtly break).

## Pricing maintenance

Pricing tables live in `LOCAL_META` in `lib/providers.rip`. When a provider changes rates:

1. Edit the `pricing: { input_per_million, output_per_million }` block for that model.
2. Run `bun run test` (no provider tests yet, but the parse check matters).
3. Bump `package.json` version and CHANGELOG.

## Tests

There are no provider mocks yet — most logic is exercised by:

- the parse-check (`bun ./bin/rip -c packages/ai/lib/*.rip mcp.rip`)
- a manual MCP smoke test:
  ```bash
  printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
    | rip packages/ai/mcp.rip
  ```
  Should return two newline-delimited JSON responses.

## Pitfalls

- **bun:sqlite is sync.** Don't put `!` on `db.exec`, `stmt.run`, `stmt.get`, `stmt.all` — they are not promises.
- **JSON columns vs join tables.** Messages store attachment metadata as a JSON snapshot; the `attachments` table is a content-addressed cache, not a join. The query `findLastAttachmentBySource` uses `json_each` to walk it.
- **Catalog cache layering.** `listAll` first checks an in-process Map (5 min TTL), then live provider APIs, then the disk cache (`models.json`, 24 h TTL fallback). Stale-but-cached beats no-data.
- **Coauthor protection.** `independent_of` is a soft guarantee — it warns, it does not refuse. `fresh_review`'s `exclude_models` is a hard refusal only when the explicitly requested model is excluded; otherwise it picks an unexcluded credentialed default.
- **Cost caps.** `max_cost_usd` is a *preflight* check based on input-token estimation (chars/4). Output is unpredictable; we don't refuse mid-call. Overshoots are reported in `warnings[]`.

## Out of scope (deliberate non-goals)

- `delegate` with bounded tools — Cursor's `Task` already gives peers tool access; rebuilding it here would be worse
- Streaming (`discuss_stream`)
- Provider-native file uploads (images, audio, video)
- OAuth credential flows
- Web UI / REST adapter
- Cross-conversation semantic search
