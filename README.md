# graphmycode-mcp

[![npm version](https://img.shields.io/npm/v/graphmycode-mcp)](https://www.npmjs.com/package/graphmycode-mcp)

MCP server for codebase structure analysis. Provides dependency graphs, community detection, hotspot identification, and agent context generation.

Works with **Claude Code, Cursor, Windsurf, Cline, Continue, Zed, and Google Antigravity**.

## Install

```bash
npm install -g graphmycode-mcp
```

The postinstall script automatically registers the MCP server in **Claude Code** and installs 9 slash commands.

To register in other editors, run:

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

If you prefer to configure manually, add the following snippet to each editor's config file.

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

Create the file `~/.continue/mcpServers/graphmycode.json`:

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

Continue automatically picks up JSON files from `~/.continue/mcpServers/`.

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
|------|-------------|
| `analyze_structure` | Full dependency graph with hotspots, dead code, and coupling metrics |
| `detect_stack` | Languages, frameworks, and project type |
| `get_file_dependencies` | Imports and importedBy for a specific file |
| `get_communities` | Module clusters detected via graph analysis |
| `find_entry_points` | Files with no importers (CLI, main, index) |
| `query_graph` | Natural language queries over the graph |
| `export_agent_context` | Generate `CLAUDE.md` / `AGENTS.md` for the codebase |

## Slash Commands (Claude Code only)

| Command | Description |
|---------|-------------|
| `/graphmycode` | Hotspots, dead code, coupling summary |
| `/graphmycode-analysis` | Full analysis cycle with improvement plan |
| `/graphmycode-context` | Generate CLAUDE.md / AGENTS.md for the codebase |
| `/graphmycode-debt` | Prioritized technical debt backlog (P1/P2/P3) |
| `/graphmycode-flow` | Execution flow from entry points |
| `/graphmycode-heatmap` | Circular dependencies and hotspot heatmap |
| `/graphmycode-layers` | Architectural layers and violations |
| `/graphmycode-semantic` | Module communities and logical duplication |
| `/graphmycode-structural` | Structural dependency deep-dive |

## Visual interface

For an interactive visual graph of your codebase, visit **[graphmycode.com](https://graphmycode.com)**.

## Requirements

- Node.js 18+
- At least one of: Claude Code, Cursor, Windsurf, Cline, Continue, Zed, or Google Antigravity

## License

MIT
