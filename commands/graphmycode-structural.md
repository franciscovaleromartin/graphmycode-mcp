Perform structural dependency analysis of the current codebase.

1. Call `analyze_structure` with `path` = current working directory
2. For the top 3 files by fanIn, call `get_file_dependencies`

Report:
- **Most depended-on files** with full import/importedBy lists
- **Bidirectional dependencies** — files that import each other
- **Structural recommendations** — how to reduce coupling
