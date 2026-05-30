Trace execution flow from entry points through the current codebase.

1. Call `find_entry_points` with `path` = current working directory
2. For each high-confidence entry point, call `get_file_dependencies`

Report:
- **Entry points** — with confidence level and reason
- **Execution flow** — file chain from each entry point (one level deep)
- **Dead ends** — entry points that lead to dead code
- **Flow recommendations** — how to simplify the execution path
