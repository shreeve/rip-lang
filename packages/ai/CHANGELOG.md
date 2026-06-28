# Changelog

## 1.1.0

**Faster, simpler model selection — two autodetected models.**

- The catalog is now just two logical models: `gpt` (latest OpenAI flagship) and
  `claude` (latest Anthropic flagship). The old multi-version/multi-tier registry
  (`gpt-5.4`, mini, `claude-opus-4-6`, `fable`, `sonnet`, `haiku`, ~25 aliases) is gone.
- **"Latest" is autodetected live** from each provider's `/models` API — the
  highest-versioned id in the flagship family — and cached in
  `~/.config/rip-ai/latest.json` (12h TTL). The hot path never makes a network
  call to pick a model, and the cache is warmed in the background at startup.
- Defaults: `chat` → `gpt`, `discuss` → `claude`, `panel` synthesis → `gpt`.
- `INSTRUCTIONS` and tool descriptions no longer steer toward `status`/`list_models`
  for selection; `gpt`/`claude` are the documented answer.
- Pricing covers the flagship family only (`PRICING` keyed by provider, applied
  when the id matches `FAMILY`): an autodetected successor inherits the rate, while
  an explicit non-flagship pin reports `null` instead of being mispriced at
  flagship rates (which previously could falsely trip a `max_cost_usd` preflight).
- `list_models` is now purely informational and flags `is_latest` per provider —
  computed from the freshly fetched rows, so a forced refresh is never stale.

**Reliability hardening (review-driven):**

- **OpenAI empty-output guard.** Reasoning models spend `max_completion_tokens` on
  hidden reasoning first; too small a cap returned `finish_reason: length` with
  empty content, silently surfacing as blank text. The adapter now raises an
  actionable error (with the reasoning-token count), and `providers.chat` warns on
  any truncated-but-non-empty response.
- **Date-aware "latest" pick.** A trailing `-YYYYMMDD` snapshot date is no longer
  treated as a version component (which could let an old dated build outrank a newer
  clean release); it's used only as a tie-breaker between equal versions.
- **No cross-provider cache clobber.** `latest.json` is merged with what's on disk
  before writing, and reads hydrate consistently, so refreshing one provider can't
  drop the other's cached entry. Corrupt/mismatched cache entries are ignored.
- **`fresh_review` resolves the true latest.** Selection and exclusions now go
  through the async `resolveModel!`, so a cold/unwarmed cache can't dispatch the
  `SEED` fallback.
- **Concurrent refreshes coalesce.** Startup warm + first request share one
  in-flight `/models` call per provider.

Migration: replace any pinned alias (`opus`, `haiku`, `gpt-5.4`, …) with `gpt` or
`claude`, or use an explicit `provider:model`. Concrete `provider:model` specs still
work everywhere.

## 1.0.x

- Initial release: persistent multi-model consultation MCP — `chat`, `discuss`,
  `panel`, `fresh_review`, content-hashed attachments, conversation management.
