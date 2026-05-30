# graphmycode-mcp

MCP server for codebase structure analysis. Provides dependency graphs, community detection, hotspot identification, and agent context generation directly inside Claude Code.

## Install

```bash
npm install -g graphmycode-mcp
```

The postinstall script automatically:
1. Registers the MCP server in Claude Code (`~/.claude/claude.json`)
2. Installs 8 slash commands in `~/.claude/commands/`

Restart Claude Code after installing to activate.

---

### If the postinstall was skipped

This happens when installing with `--ignore-scripts` or in CI environments. Run setup manually:

```bash
graphmycode-mcp setup
```

---

### Manual registration (clone/dev install)

If you cloned the repo instead of installing from npm:

```bash
npm install
npm run build
node_path=$(which node)   # get absolute path — e.g. /opt/homebrew/bin/node
dist_path=$(pwd)/dist/index.js
claude mcp add -s user graphmycode -- "$node_path" "$dist_path"
```

Then copy the slash commands:

```bash
cp commands/*.md ~/.claude/commands/
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

## Slash Commands

Once installed, these commands are available in Claude Code:

| Command | Description |
|---------|-------------|
| `/graphmycode` | Hotspots, dead code, coupling summary |
| `/graphmycode-debt` | Prioritized technical debt backlog (P1/P2/P3) |
| `/graphmycode-flow` | Execution flow from entry points |
| `/graphmycode-heatmap` | Circular dependencies and hotspot heatmap |
| `/graphmycode-iterate` | Full analysis cycle with improvement plan |
| `/graphmycode-layers` | Architectural layers and violations |
| `/graphmycode-semantic` | Module communities and logical duplication |
| `/graphmycode-structural` | Structural dependency deep-dive |

## Requirements

- Node.js 18+
- [Claude Code](https://claude.ai/code) CLI installed and configured

## License

MIT
