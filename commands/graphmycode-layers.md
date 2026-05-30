Analyze the architectural layers of the current codebase.

1. Call `detect_stack` with `path` = current working directory
2. Call `get_communities` with `path` = current working directory
3. Call `analyze_structure` with `path` = current working directory

Report:
- **Stack summary** — languages, frameworks, project type
- **Architectural layers** — map communities to layers (presentation/business/data/infrastructure)
- **Layer violations** — edges crossing architectural boundaries in the wrong direction
- **Architecture recommendations** — improvements to layering
