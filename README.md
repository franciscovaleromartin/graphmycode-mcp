# graphmycode-mcp

[![npm version](https://img.shields.io/npm/v/graphmycode-mcp)](https://www.npmjs.com/package/graphmycode-mcp)

Give your AI agent a **complete, precomputed dependency graph** of any codebase — so it works from a real map of your architecture instead of rebuilding it, file by file, every session.

Works with **Claude Code, Cursor, Windsurf, Cline, Continue, Zed, and Google Antigravity**.

---

## Why it matters

On a large codebase, the hardest part isn't writing code — it's understanding what's connected to what. Which files are load-bearing? Where are the import cycles? What's dead weight nobody uses anymore?

Answering those questions properly means looking at the **whole** repo at once. `graphmycode-mcp` does that analysis up front and hands your agent the result:

- **Complete, not approximate.** Importers, coupling, dead code — measured across every file, not guessed from a sample.
- **Real graph analysis.** Circular dependencies and module clustering come from proven graph algorithms (Louvain community detection), so the agent catches structural problems that are easy to miss reading code linearly.
- **Lean on context.** Your agent gets a compact, accurate map from the first message — leaving its context budget for the actual work.

The result: faster onboarding to unfamiliar code, sharper refactor decisions, and an agent that understands your project's real shape from message one.

---

## What it gives your agent

### A real dependency graph
Every file's imports, who imports it, and how connected it is — across the whole project.

### Problem detection at the architecture level
- **Hotspots** — the files everything depends on. High blast radius, top refactor priority.
- **Dead code** — files nobody imports. Safe to remove.
- **Circular dependencies** — import cycles that quietly make testing and maintenance harder.
- **Coupling metrics** — `fanIn`, `fanOut`, and edge count at a glance.

### Architecture as it actually is
- **Module communities** — functional clusters surfaced by graph analysis, revealing the structure that really exists.
- **Architectural layers** — whether the project respects layer separation or violates it.

### Instant project context
`export_agent_context` generates a `CLAUDE.md` / `AGENTS.md` with the stack, build/test commands, module map, most critical files, and key dependencies — so your agent starts grounded in your project, not in generic assumptions.

---

## Install

```bash
npm install -g graphmycode-mcp
```

The postinstall script registers the MCP server in **Claude Code** and installs 9 slash commands.

For other editors:

```bash
graphmycode-mcp setup --all          # all supported editors
graphmycode-mcp setup cursor         # Cursor only
graphmycode-mcp setup windsurf       # Windsurf only
graphmycode-mcp setup cline          # Cline (VSCode) only
graphmycode-mcp setup continue       # Continue only
graphmycode-mcp setup zed            # Zed only
graphmycode-mcp setup antigravity    # Google Antigravity only
```

Restart your editor(s) after setup.

---

## Manual configuration per editor

### Claude Code

```bash
claude mcp add -s user graphmycode -- node $(npm root -g)/graphmycode-mcp/dist/index.js
```

Or if you cloned the repo:

```bash
node_path=$(which node)
dist_path=$(pwd)/dist/index.js
claude mcp add -s user graphmycode -- "$node_path" "$dist_path"
```

Then copy the slash commands:

```bash
cp commands/*.md ~/.claude/commands/
```

### Cursor

File: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "graphmycode": {
      "command": "npx",
      "args": ["-y", "graphmycode-mcp"]
    }
  }
}
```

### Windsurf

File: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "graphmycode": {
      "command": "npx",
      "args": ["-y", "graphmycode-mcp"]
    }
  }
}
```

### Cline (VSCode extension)

Open **Cline → MCP Servers → Configure MCP Servers** and add:

```json
{
  "mcpServers": {
    "graphmycode": {
      "command": "npx",
      "args": ["-y", "graphmycode-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Continue

File: `~/.continue/mcpServers/graphmycode.json`

```json
{
  "mcpServers": {
    "graphmycode": {
      "command": "npx",
      "args": ["-y", "graphmycode-mcp"]
    }
  }
}
```

Continue auto-loads JSON files from `~/.continue/mcpServers/`.

### Google Antigravity

File: `~/.gemini/config/mcp_config.json` (macOS/Linux)
File: `C:\Users\<USER>\.gemini\antigravity\mcp_config.json` (Windows)

```json
{
  "mcpServers": {
    "graphmycode": {
      "command": "npx",
      "args": ["-y", "graphmycode-mcp"]
    }
  }
}
```

### Zed

File: `~/.config/zed/settings.json`

```json
{
  "context_servers": {
    "graphmycode-mcp": {
      "source": "custom",
      "command": "npx",
      "args": ["-y", "graphmycode-mcp"]
    }
  }
}
```

---

## Tools

| Tool | Description |
| --- | --- |
| `analyze_structure` | Full dependency graph with hotspots, dead code, and coupling metrics |
| `get_communities` | Module clusters detected via graph analysis |
| `get_file_dependencies` | Imports and importedBy for a specific file |
| `export_agent_context` | Generate `CLAUDE.md` / `AGENTS.md` for the codebase |
| `find_entry_points` | Files with no importers (CLI, main, index) |
| `detect_stack` | Languages, frameworks, and project type |
| `query_graph` | Natural language queries over the graph |

---

## Slash Commands (Claude Code only)

| Command | Description |
| --- | --- |
| `/graphmycode` | Hotspots, dead code, coupling summary |
| `/graphmycode-analysis` | Full analysis cycle with improvement plan |
| `/graphmycode-context` | Generate CLAUDE.md / AGENTS.md |
| `/graphmycode-debt` | Prioritized technical debt backlog (P1/P2/P3) |
| `/graphmycode-heatmap` | Circular dependencies and hotspot heatmap |
| `/graphmycode-semantic` | Module communities and logical duplication |
| `/graphmycode-layers` | Architectural layers and violations |
| `/graphmycode-structural` | Structural dependency deep-dive |
| `/graphmycode-flow` | Execution flow from entry points |

---

## Visual interface

For an interactive visual graph of your codebase, visit **[graphmycode.com](https://graphmycode.com)**.

## Requirements

- Node.js 18+
- At least one of: Claude Code, Cursor, Windsurf, Cline, Continue, Zed, or Google Antigravity

## License

MIT
