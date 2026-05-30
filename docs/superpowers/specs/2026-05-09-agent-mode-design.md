# Agent Mode Detection — Design Spec
Date: 2026-05-09 | Branch: AgentMode

## Overview

Automatically detect whether the analyzed codebase belongs to an AI agent and show a dedicated panel in the sidebar with a context export optimized for agents.

## Scope

- Detection logic: pure regex/string analysis on graph + externalDeps, no LLM, < 200ms
- UI: sidebar panel (conditional on detection)
- Export: client-side `.md` generation from the already-built graph, no external deps

Out of scope: scanning raw file content (not available in main thread), backend flow changes.

## Architecture

### New files

| File | Responsibility |
|---|---|
| `src/lib/agent-detection.ts` | `detectAgentCode()` — pure function, graph + externalDeps → result |
| `src/lib/agent-context-export.ts` | `exportAgentContext()` — generates and downloads `agent-context.md` |

### Modified files

| File | Change |
|---|---|
| `src/screens/SidePanel.tsx` | Add `externalDeps` from state, `useMemo` for detection, render Agent Mode panel |

### Data flow

```
graph + externalDeps (AppState)
  → detectAgentCode() [useMemo in SidePanel]
  → AgentDetectionResult { isAgent, confidence }
  → if isAgent: render AgentModePanel
  → user clicks export → exportAgentContext(graph, projectName, externalDeps) → download
```

## Detection Function

### Signature

```typescript
export interface AgentDetectionResult {
  isAgent: boolean;
  confidence: number; // 0-1, capped at 1.0
}

export function detectAgentCode(
  graph: KnowledgeGraph,
  externalDeps: Record<string, string[]>
): AgentDetectionResult
```

Note: the spec requested `detectAgentCode(code: string, files?: string[])` but raw file content is not available in the main thread. The adapted signature uses graph + externalDeps, which cover all high-weight signals.

### Signal weights

| Signal category | Source | Weight |
|---|---|---|
| First AI framework import found | `externalDeps` values | +0.35 |
| Each additional distinct AI framework | `externalDeps` values | +0.10 |
| Agent config file present (CLAUDE.md, AGENTS.md, .mcp.json, system_prompt.txt) | `graph.nodes[label=File]` filePath | +0.30 per file |
| Agent function name (run_agent, execute_tool, dispatch, invoke, run_tool) | `graph.nodes[label=Function/Method]` name | +0.12 per match, max 0.25 |
| Subagent pattern in name/path (subagent, sub_agent, multi_agent, orchestrat, spawn) | all `graph.nodes` name + filePath | +0.20 per match, max 0.30 |

**Threshold:** `isAgent = confidence >= 0.35`

### AI framework package list

```typescript
const AI_FRAMEWORKS = [
  // Python
  'anthropic', 'openai', 'langchain', 'litellm', 'autogen', 'crewai',
  'pydantic_ai', 'pydantic-ai', 'openai-agents', 'google-generativeai',
  'google-genai', 'groq', 'cohere', 'mistralai', 'together',
  // JS/TS
  '@anthropic-ai/sdk', '@langchain/core', '@langchain/openai', '@langchain/anthropic',
  'ai', // Vercel AI SDK
];
```

### Calibration examples

| Scenario | Confidence | isAgent |
|---|---|---|
| `anthropic` in deps | 0.35 | true |
| `CLAUDE.md` present | 0.30 | false |
| `CLAUDE.md` + function `run_agent` | 0.42 | true |
| `openai` + `CLAUDE.md` | 0.65 | true |
| Plain React app | 0.00 | false |
| `AGENTS.md` + `subagent` in function name | 0.50 | true |

## Export Function

### Signature

```typescript
export function exportAgentContext(
  graph: KnowledgeGraph,
  projectName: string,
  externalDeps: Record<string, string[]>
): void
```

Triggers browser download of `agent-context.md`.

### File structure

```md
# GraphMyCode — Agent Context Export
Generated: YYYY-MM-DD | Project: <projectName>

## Context Prompt
<compact project description ~600-900 tokens for use as system prompt or CLAUDE.md paste>
Includes: inferred purpose, architecture layers (from folder names), key entry points, tech stack.

## Project Structure
<directory tree with node counts per folder>

## Key Nodes
<top 10 nodes by degree: name | type | file | connections>

## Main Dependencies
<deduplicated list of all external packages detected>

## Detected Communities
<each Community node from graph: name + member symbols>
```

### Context Prompt generation (deterministic, no LLM)

Built from:
1. Project name
2. Top 3 directories with most nodes → inferred architecture layers
3. Top 5 most-connected functions/classes with their file path
4. All unique external packages (tech stack)
5. Count stats (files, functions, classes, edges)

### Download trigger

```typescript
const blob = new Blob([content], { type: 'text/markdown' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'agent-context.md';
a.click();
URL.revokeObjectURL(url);
```

## UI — SidePanel Changes

### Placement
Between the Legend section and the Reset button, separated by `<hr className="border-border-subtle" />`.

### Render condition
`!collapsed && detection.isAgent`

### Panel HTML structure

```tsx
<section className="mb-4">
  {/* Badge header */}
  <div className="mb-2 flex items-center gap-1.5 rounded-md border border-secondary/30 bg-secondary/10 px-2.5 py-1.5">
    <span className="text-sm">⚡</span>
    <span className="text-xs font-semibold text-secondary">Agent Mode Detected</span>
  </div>
  {/* Subtext */}
  <p className="mb-3 text-xs text-text-muted">
    AI agent code detected. Export context for your agent.
  </p>
  {/* Export button */}
  <button
    onClick={handleExport}
    className="w-full rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-xs text-secondary transition-colors hover:bg-secondary/20"
  >
    ⬇ Export Agent Context
  </button>
</section>
```

## Non-functional requirements

- Detection: < 200ms (pure regex/array iteration, no I/O)
- No new dependencies
- No changes to ingestion pipeline or worker
- Works for both SPA (zip upload) and server backend flows

## Testing notes

- Unit test `detectAgentCode` with mock graph + externalDeps covering true/false cases
- No UI test required (conditional render is straightforward)
