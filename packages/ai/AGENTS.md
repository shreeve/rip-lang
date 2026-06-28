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
lib/providers.rip         latest-model autodetect + cache, parseModel, pricing, cost, catalog
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
| `lib/providers.rip` | **Flagship families, pricing, seeds, and latest-model autodetect live here.** Update `PRICING` when rates change; `FAMILY` only if a provider renames its flagship tier. |
| `lib/openai.rip`, `lib/anthropic.rip` | Adapter HTTP shape. New providers go in their own file plus a registration in `providers.rip` (`ADAPTERS`, `FAMILY`, `SEED`, `PRICING`). |
| `lib/tools.rip` | Tool orchestration. Each tool is a separate exported function. |

## Model selection (latest-alias autodetect)

The server exposes exactly two logical models: `gpt` (latest OpenAI flagship) and `claude` (latest Anthropic flagship). There is no hand-maintained model registry.

- `LATEST_ALIASES` maps `gpt`/`chatgpt`/`openai`/`gpt-latest` → `openai` and `claude`/`anthropic`/`opus`/`claude-latest` → `anthropic`. These are the *only* aliases; anything else must be a concrete `provider:model`.
- `ensureLatest!(provider)` queries the provider's `/models` API and picks the highest-versioned id matching `FAMILY[provider]` (version compared digit-group by digit-group via `modelVersion`/`cmpVersion`). Result is cached in `latest.json` with a **12h TTL**; `SEED[provider]` is the cold/offline fallback.
- `parseModel` is **sync** and resolves latest aliases from the cache (may be `SEED` until warmed) — used where an id is needed up front (exclusions, logging). `resolveModel!` is **async** and does a freshness check (one network call if stale) before resolving — `providers.chat!` uses it.
- `mcp.rip` calls `providers.warmLatest()` at startup (fire-and-forget) so the first real call usually hits a warm cache. Don't `await` it.
- Don't steer the in-chat AI toward `list_models` for selection — `gpt`/`claude` are the answer. `list_models` is informational (flags `is_latest`).

## Adding a new provider

1. New file `lib/<name>.rip` exporting `provider`, `listModels`, `chat`, matching the adapter shape used by `openai.rip` and `anthropic.rip`.
2. In `lib/providers.rip`, add to `ADAPTERS`, `FAMILY` (flagship regex), `SEED` (fallback id), `PRICING`, and `LATEST_ALIASES` (alias → provider key).
3. Add the provider's env-var name to `providerEnvKey` in `providers.rip` and to `credentialedFor` in `tools.rip`.
4. Update the `provider` enum on `list_models` in `mcp.rip` and the alias list in `INSTRUCTIONS`.

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

Pricing is provider-scoped in `PRICING` in `lib/providers.rip` (so an autodetected successor inherits the flagship's rate without a code change). When a provider changes rates:

1. Edit the `{ input_per_million, output_per_million }` block for that provider.
2. Run `bun run test` (no provider tests yet, but the parse check matters).
3. Bump `package.json` + `mcp.rip` `VERSION` and note it in `CHANGELOG.md`.

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
- **Two caches, different jobs.** `latest.json` (12h TTL) holds the resolved flagship ids and is what model *selection* reads — keep it fast. `models.json` + the in-process Map (5 min) back `listAll`, which is now only the informational `list_models` catalog. Don't route selection through `listAll`.
- **Coauthor protection.** `independent_of` is a soft guarantee — it warns, it does not refuse. `fresh_review`'s `exclude_models` is a hard refusal only when the explicitly requested model is excluded; otherwise it picks an unexcluded credentialed default.
- **Cost caps.** `max_cost_usd` is a *preflight* check based on input-token estimation (chars/4). Output is unpredictable; we don't refuse mid-call. Overshoots are reported in `warnings[]`.

## Out of scope (deliberate non-goals)

- `delegate` with bounded tools — Cursor's `Task` already gives peers tool access; rebuilding it here would be worse
- Streaming (`discuss_stream`)
- Provider-native file uploads (images, audio, video)
- OAuth credential flows
- Web UI / REST adapter
- Cross-conversation semantic search
