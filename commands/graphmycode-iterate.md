Run a full graphmycode analysis cycle and generate an improvement plan.

1. Call `analyze_structure` with `path` = current working directory
2. Call `get_communities` with `path` = current working directory
3. Call `detect_stack` with `path` = current working directory
4. Call `query_graph` asking "¿cuales son los archivos más acoplados?"

Report:
- **Current state** — quick metrics snapshot (files, edges, density, avgFanIn/Out)
- **Top 3 issues** — critical structural problems ranked by impact
- **Quick wins** — improvements you can make in < 1 hour
- **Strategic moves** — refactoring priorities for next sprint
- **Success metrics** — how you'll know the refactoring worked
