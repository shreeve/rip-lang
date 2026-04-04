<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip AI - @rip-lang/ai

> **AI-to-AI collaboration MCP server — peer review, second opinions, and multi-turn discussion between models**

An MCP stdio server that lets one AI talk to another. Claude Opus 4.6 in
Cursor automatically gets GPT-5.4 as its peer, and vice versa. Three tools
— `chat`, `review`, `discuss` — cover quick questions, structured code
review, and multi-turn conversations. ~360 lines of Rip, zero dependencies
beyond the language itself.

## Quick Start

```bash
bun add @rip-lang/ai
```

Add to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "ai": {
      "command": "rip",
      "args": ["/path/to/packages/ai/mcp.rip"]
    }
  }
}
```

API keys are loaded from environment variables or `~/.config/rip/credentials`:

```bash
mkdir -p ~/.config/rip
cat > ~/.config/rip/credentials << 'EOF'
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EOF
chmod 600 ~/.config/rip/credentials
```

## How It Works

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   Claude    │  stdio   │   rip-ai    │  HTTPS   │  GPT-5.4    │
│  (Cursor)   │◀────────▶│   (MCP)     │────────▶ │  (OpenAI)   │
└─────────────┘          └─────────────┘          └─────────────┘
```

The calling AI (typically Claude in Cursor) sends a tool call over MCP stdio.
The server forwards it to the peer model's API and returns the response. The
peer is selected automatically — Claude gets GPT-5.4, GPT gets Claude — so
every review comes from a genuinely different perspective.

## Tools

### chat

Send a message and get a response. Use for quick questions, second opinions,
or brainstorming.

```coffee
# From Cursor's Claude, this reaches GPT-5.4:
chat({ message: "Is this the right data structure for a LRU cache?" })
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | yes | The message to send |
| `system` | string | no | System prompt override |

### review

Structured code review with feedback on correctness, safety, performance,
style, and suggestions. Include language and context for better results.

```coffee
review({
  code: "...",
  language: "rip",
  context: "This is a compiler code generator",
  focus: "bugs"
})
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | yes | The code to review |
| `language` | string | no | Programming language |
| `context` | string | no | What the code does, project info, constraints |
| `focus` | string | no | `bugs`, `performance`, `style`, `security`, or `all` (default) |

### discuss

Multi-turn conversation that maintains history across calls. Pick a
conversation ID and keep using it for back-and-forth discussion.

```coffee
discuss({ conversation_id: "arch-review", message: "Should we use a B-tree or a hash map here?" })
discuss({ conversation_id: "arch-review", message: "What about cache locality?" })
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | yes | Unique ID for this conversation thread |
| `message` | string | yes | Your message in the conversation |
| `system` | string | no | System prompt (first message or reset only) |
| `reset` | boolean | no | Clear history and start fresh |

## Peer Selection

The peer model is chosen automatically based on who's calling:

| Caller | Peer | Flag |
|--------|------|------|
| Claude (default) | GPT-5.4 | none needed |
| GPT | Claude Opus 4.6 | `--peer anthropic` |

```bash
rip mcp.rip                    # peer = GPT-5.4 (default, for Claude)
rip mcp.rip --peer anthropic   # peer = Claude Opus 4.6 (for GPT)
```

## Credential Resolution

API keys are resolved in order of priority:

1. **Environment variables** — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
2. **Credentials file** — `~/.config/rip/credentials` (KEY=value, one per line)

Environment variables always win. The credentials file is optional but
convenient — set it once and every MCP session picks it up.

## How It's Built

| File | Lines | Role |
|------|-------|------|
| `mcp.rip` | ~360 | MCP server — protocol, tools, provider API calls, conversation state |

The server implements the MCP JSON-RPC 2.0 protocol over stdio. Each tool
call builds a message array, sends it to the peer provider's HTTP API, and
returns the response as a text content block. Multi-turn conversations
accumulate message history keyed by conversation ID.

## Requirements

- **Bun** 1.0+
- **rip-lang** 3.x
- At least one API key (OpenAI and/or Anthropic)

## License

MIT
