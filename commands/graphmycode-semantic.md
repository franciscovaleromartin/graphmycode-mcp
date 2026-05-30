Analyze logical duplication and semantic clustering in the current codebase.

1. Call `get_communities` with `path` = current working directory
2. Call `query_graph` asking "what files have the most dependencies?"

Report:
- **Module communities** — each community with its files and inferred purpose
- **Potential duplication** — communities with similar names or overlapping deps
- **Semantic recommendations** — suggest consolidations or renames
