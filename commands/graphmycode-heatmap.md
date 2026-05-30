Detect circular dependencies and dependency hotspots in the current codebase.

1. Call `analyze_structure` with `path` = current working directory
2. Call `query_graph` asking "¿hay ciclos de importación?"
3. Call `query_graph` asking "¿qué archivos tienen más dependencias?"

Report:
- **Circular imports** — each cycle with full file chain
- **Hotspot heatmap** — top 10 files by fanIn as ranked list
- **Risk assessment** — which cycles are most dangerous
- **Fix recommendations** — concrete steps to break each cycle
