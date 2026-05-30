Analyze the structure of the current codebase using graphmycode MCP.

Use the `analyze_structure` tool with `path` set to the current working directory.

Report:
1. **Hotspots** — files with highest fanIn, with count
2. **Dead code candidates** — files with fanIn=0 that are not entry points
3. **Coupling summary** — avgFanIn, avgFanOut, total edges
4. **Top recommendations** — refactoring priorities based on metrics
