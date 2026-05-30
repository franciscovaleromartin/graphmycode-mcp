Produce a prioritized technical debt report for the current codebase.

1. Call `analyze_structure` with `path` = current working directory
2. Call `get_communities` with `path` = current working directory
3. For each hotspot (top 5 by fanIn), call `get_file_dependencies`

Debt backlog:
- **P1 (Critical)** — files with fanIn > 10 or involved in cycles
- **P2 (High)** — files with fanIn 5-10 or communities > 20 files
- **P3 (Medium)** — dead code candidates, large unfocused communities
- Include T-shirt size estimates (S/M/L/XL) per item
