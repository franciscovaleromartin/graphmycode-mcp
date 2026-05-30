# Agent Mode Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect AI agent codebases automatically and show a sidebar panel with a one-click export of agent context as `.md`.

**Architecture:** Two new pure utility files (`agent-detection.ts`, `agent-context-export.ts`) and one modified component (`SidePanel.tsx`). Detection runs as a `useMemo` inside SidePanel; no new AppState fields needed.

**Tech Stack:** TypeScript, React 19, Vitest (tests), existing AppState/graph types from `gitnexus-shared`.

---

## File Map

| Action | File |
|---|---|
| Create | `src/lib/agent-detection.ts` |
| Create | `src/lib/agent-context-export.ts` |
| Modify | `src/screens/SidePanel.tsx` |
| Create | `test/unit/agent-detection.test.ts` |
| Create | `test/unit/agent-context-export.test.ts` |

---

### Task 1: Create `agent-detection.ts` with failing tests first

**Files:**
- Create: `src/lib/agent-detection.ts`
- Create: `test/unit/agent-detection.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/agent-detection.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createKnowledgeGraph } from '../../src/core/graph/graph';
import { createFileNode, createFunctionNode } from '../fixtures/graph';
import { detectAgentCode } from '../../src/lib/agent-detection';

describe('detectAgentCode', () => {
  it('returns false for an empty graph with no deps', () => {
    const g = createKnowledgeGraph();
    const result = detectAgentCode(g, {});
    expect(result.isAgent).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('detects anthropic import as agent (confidence >= 0.35)', () => {
    const g = createKnowledgeGraph();
    const fileNode = createFileNode('agent.py', 'src/agent.py');
    g.addNode(fileNode);
    const result = detectAgentCode(g, { [fileNode.id]: ['anthropic'] });
    expect(result.isAgent).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.35);
  });

  it('detects openai import as agent', () => {
    const g = createKnowledgeGraph();
    const fileNode = createFileNode('main.py', 'main.py');
    g.addNode(fileNode);
    const result = detectAgentCode(g, { [fileNode.id]: ['openai'] });
    expect(result.isAgent).toBe(true);
  });

  it('detects @anthropic-ai/sdk (JS SDK)', () => {
    const g = createKnowledgeGraph();
    const fileNode = createFileNode('agent.ts', 'src/agent.ts');
    g.addNode(fileNode);
    const result = detectAgentCode(g, { [fileNode.id]: ['@anthropic-ai/sdk'] });
    expect(result.isAgent).toBe(true);
  });

  it('increases confidence for multiple AI frameworks', () => {
    const g = createKnowledgeGraph();
    const fileA = createFileNode('a.py', 'src/a.py');
    const fileB = createFileNode('b.py', 'src/b.py');
    g.addNode(fileA);
    g.addNode(fileB);
    const single = detectAgentCode(g, { [fileA.id]: ['anthropic'] });
    const multi = detectAgentCode(g, { [fileA.id]: ['anthropic'], [fileB.id]: ['openai'] });
    expect(multi.confidence).toBeGreaterThan(single.confidence);
  });

  it('detects CLAUDE.md as partial signal (not enough alone)', () => {
    const g = createKnowledgeGraph();
    g.addNode(createFileNode('CLAUDE.md', 'CLAUDE.md'));
    const result = detectAgentCode(g, {});
    expect(result.isAgent).toBe(false);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(0.35);
  });

  it('detects AGENTS.md as partial signal', () => {
    const g = createKnowledgeGraph();
    g.addNode(createFileNode('AGENTS.md', 'AGENTS.md'));
    const result = detectAgentCode(g, {});
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects CLAUDE.md + run_agent function as agent', () => {
    const g = createKnowledgeGraph();
    g.addNode(createFileNode('CLAUDE.md', 'CLAUDE.md'));
    g.addNode(createFunctionNode('run_agent', 'src/agent.py'));
    const result = detectAgentCode(g, {});
    expect(result.isAgent).toBe(true);
  });

  it('detects subagent pattern in function name', () => {
    const g = createKnowledgeGraph();
    g.addNode(createFunctionNode('spawn_subagent', 'src/orchestrator.py'));
    g.addNode(createFunctionNode('spawn_subagent2', 'src/orchestrator.py', 20));
    const result = detectAgentCode(g, {});
    // Two subagent hits (0.20 + 0.20, capped 0.30) → 0.30 < 0.35 alone
    expect(result.confidence).toBeGreaterThanOrEqual(0.30);
  });

  it('caps confidence at 1.0', () => {
    const g = createKnowledgeGraph();
    g.addNode(createFileNode('CLAUDE.md', 'CLAUDE.md'));
    g.addNode(createFileNode('AGENTS.md', 'AGENTS.md'));
    g.addNode(createFileNode('.mcp.json', '.mcp.json'));
    g.addNode(createFunctionNode('run_agent', 'src/a.py'));
    const fileNode = createFileNode('main.py', 'main.py');
    g.addNode(fileNode);
    const result = detectAgentCode(g, {
      [fileNode.id]: ['anthropic', 'openai', 'langchain'],
    });
    expect(result.confidence).toBeLessThanOrEqual(1.0);
    expect(result.isAgent).toBe(true);
  });

  it('plain React app returns false', () => {
    const g = createKnowledgeGraph();
    g.addNode(createFileNode('App.tsx', 'src/App.tsx'));
    g.addNode(createFunctionNode('render', 'src/App.tsx'));
    const result = detectAgentCode(g, {
      'File:src/App.tsx': ['react', 'react-dom'],
    });
    expect(result.isAgent).toBe(false);
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/franciscovalero/Desktop/proyectos/graphmycode
npx vitest run test/unit/agent-detection.test.ts
```

Expected: All tests FAIL with `Cannot find module '../../src/lib/agent-detection'`

- [ ] **Step 3: Implement `src/lib/agent-detection.ts`**

```typescript
// Copyright (C) 2026 Francisco Alejandro Valero Martin
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { KnowledgeGraph } from '../core/graph/types';

export interface AgentDetectionResult {
  isAgent: boolean;
  confidence: number;
}

const AI_FRAMEWORKS = new Set([
  'anthropic', 'openai', 'langchain', 'litellm', 'autogen', 'crewai',
  'pydantic_ai', 'pydantic-ai', 'openai-agents', 'google-generativeai',
  'google-genai', 'groq', 'cohere', 'mistralai', 'together',
  '@anthropic-ai/sdk', '@langchain/core', '@langchain/openai', '@langchain/anthropic',
  'ai',
]);

const AGENT_CONFIG_FILES = new Set([
  'CLAUDE.md', 'AGENTS.md', '.mcp.json', 'system_prompt.txt',
]);

const AGENT_FUNCTION_PATTERNS = [
  'run_agent', 'execute_tool', 'run_tool', 'dispatch', 'invoke_tool',
];

const SUBAGENT_PATTERNS = [
  'subagent', 'sub_agent', 'multi_agent', 'orchestrat', 'spawn',
];

export function detectAgentCode(
  graph: KnowledgeGraph,
  externalDeps: Record<string, string[]>,
): AgentDetectionResult {
  let confidence = 0;

  // 1. AI framework imports (alto: +0.35 first, +0.10 each additional)
  const foundFrameworks = new Set<string>();
  for (const pkgs of Object.values(externalDeps)) {
    for (const pkg of pkgs) {
      if (AI_FRAMEWORKS.has(pkg)) foundFrameworks.add(pkg);
    }
  }
  if (foundFrameworks.size > 0) {
    confidence += 0.35 + (foundFrameworks.size - 1) * 0.10;
  }

  // 2. Agent config files (alto: +0.30 per file)
  for (const node of graph.nodes) {
    if (node.label !== 'File') continue;
    const basename = (node.properties.filePath ?? node.properties.name ?? '')
      .split('/')
      .pop() ?? '';
    if (AGENT_CONFIG_FILES.has(basename)) {
      confidence += 0.30;
    }
  }

  // 3. Agent function/method names (medio: +0.12 each, max 0.25)
  let functionScore = 0;
  for (const node of graph.nodes) {
    if (node.label !== 'Function' && node.label !== 'Method') continue;
    const name = (node.properties.name ?? '').toLowerCase();
    if (AGENT_FUNCTION_PATTERNS.some((p) => name.includes(p))) {
      functionScore = Math.min(functionScore + 0.12, 0.25);
    }
  }
  confidence += functionScore;

  // 4. Subagent patterns in names/paths (alto: +0.20 each, max 0.30)
  let subagentScore = 0;
  for (const node of graph.nodes) {
    const name = (node.properties.name ?? '').toLowerCase();
    const path = (node.properties.filePath ?? '').toLowerCase();
    const text = `${name} ${path}`;
    if (SUBAGENT_PATTERNS.some((p) => text.includes(p))) {
      subagentScore = Math.min(subagentScore + 0.20, 0.30);
    }
  }
  confidence += subagentScore;

  return {
    isAgent: confidence >= 0.35,
    confidence: Math.min(confidence, 1.0),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/unit/agent-detection.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-detection.ts test/unit/agent-detection.test.ts
git commit -m "feat: añadir detectAgentCode con tests"
```

---

### Task 2: Create `agent-context-export.ts` with tests

**Files:**
- Create: `src/lib/agent-context-export.ts`
- Create: `test/unit/agent-context-export.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/agent-context-export.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createKnowledgeGraph } from '../../src/core/graph/graph';
import { createFileNode, createFunctionNode, createClassNode } from '../fixtures/graph';
import { buildAgentContext } from '../../src/lib/agent-context-export';
import type { GraphRelationship } from 'gitnexus-shared';

function importsRel(from: string, to: string): GraphRelationship {
  return { id: `${from}_IMPORTS_${to}`, sourceId: from, targetId: to, type: 'IMPORTS', confidence: 1, reason: '' };
}

describe('buildAgentContext', () => {
  it('returns a string with all five sections', () => {
    const g = createKnowledgeGraph();
    const content = buildAgentContext(g, 'my-project', {});
    expect(content).toContain('# GraphMyCode — Agent Context Export');
    expect(content).toContain('## Context Prompt');
    expect(content).toContain('## Project Structure');
    expect(content).toContain('## Key Nodes');
    expect(content).toContain('## Main Dependencies');
    expect(content).toContain('## Detected Communities');
  });

  it('includes project name in header', () => {
    const g = createKnowledgeGraph();
    const content = buildAgentContext(g, 'awesome-agent', {});
    expect(content).toContain('Project: awesome-agent');
  });

  it('includes today\'s date in header', () => {
    const g = createKnowledgeGraph();
    const content = buildAgentContext(g, 'p', {});
    const today = new Date().toISOString().slice(0, 10);
    expect(content).toContain(`Generated: ${today}`);
  });

  it('lists top nodes by degree', () => {
    const g = createKnowledgeGraph();
    const a = createFileNode('a.ts', 'src/a.ts');
    const b = createFileNode('b.ts', 'src/b.ts');
    const c = createFileNode('c.ts', 'src/c.ts');
    g.addNode(a); g.addNode(b); g.addNode(c);
    // a has 2 connections, b has 1, c has 1
    g.addRelationship(importsRel(a.id, b.id));
    g.addRelationship(importsRel(a.id, c.id));
    const content = buildAgentContext(g, 'p', {});
    const keyNodesSection = content.split('## Key Nodes')[1].split('##')[0];
    // a.ts should appear first (highest degree)
    expect(keyNodesSection.indexOf('a.ts')).toBeLessThan(keyNodesSection.indexOf('b.ts'));
  });

  it('lists external dependencies', () => {
    const g = createKnowledgeGraph();
    const fileNode = createFileNode('agent.py', 'src/agent.py');
    g.addNode(fileNode);
    const content = buildAgentContext(g, 'p', { [fileNode.id]: ['anthropic', 'openai'] });
    const depsSection = content.split('## Main Dependencies')[1].split('##')[0];
    expect(depsSection).toContain('anthropic');
    expect(depsSection).toContain('openai');
  });

  it('deduplicates external dependencies across files', () => {
    const g = createKnowledgeGraph();
    const a = createFileNode('a.py', 'a.py');
    const b = createFileNode('b.py', 'b.py');
    g.addNode(a); g.addNode(b);
    const content = buildAgentContext(g, 'p', {
      [a.id]: ['anthropic'],
      [b.id]: ['anthropic', 'openai'],
    });
    const depsSection = content.split('## Main Dependencies')[1].split('##')[0];
    const matches = (depsSection.match(/anthropic/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it('shows no communities message when graph has none', () => {
    const g = createKnowledgeGraph();
    const content = buildAgentContext(g, 'p', {});
    expect(content).toContain('No communities detected.');
  });

  it('lists community nodes when present', () => {
    const g = createKnowledgeGraph();
    g.addNode({
      id: 'comm_0',
      label: 'Community',
      properties: { name: 'Orchestration', heuristicLabel: 'Orchestration' },
    });
    const content = buildAgentContext(g, 'p', {});
    expect(content).toContain('Orchestration');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/unit/agent-context-export.test.ts
```

Expected: All tests FAIL with `Cannot find module '../../src/lib/agent-context-export'`

- [ ] **Step 3: Implement `src/lib/agent-context-export.ts`**

```typescript
// Copyright (C) 2026 Francisco Alejandro Valero Martin
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { KnowledgeGraph } from '../core/graph/types';

export function exportAgentContext(
  graph: KnowledgeGraph,
  projectName: string,
  externalDeps: Record<string, string[]>,
): void {
  const content = buildAgentContext(graph, projectName, externalDeps);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agent-context.md';
  a.click();
  URL.revokeObjectURL(url);
}

export function buildAgentContext(
  graph: KnowledgeGraph,
  projectName: string,
  externalDeps: Record<string, string[]>,
): string {
  const date = new Date().toISOString().slice(0, 10);

  // Degree map
  const degreeMap = new Map<string, number>();
  for (const rel of graph.relationships) {
    degreeMap.set(rel.sourceId, (degreeMap.get(rel.sourceId) ?? 0) + 1);
    degreeMap.set(rel.targetId, (degreeMap.get(rel.targetId) ?? 0) + 1);
  }

  // Top 10 nodes by degree (skip Community/Process/Folder meta-nodes)
  const SKIP_LABELS = new Set(['Community', 'Process', 'Folder']);
  const keyNodes = graph.nodes
    .filter((n) => !SKIP_LABELS.has(n.label as string))
    .map((n) => ({ node: n, degree: degreeMap.get(n.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 10);

  // Directory structure (files only)
  const dirCounts = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.label !== 'File') continue;
    const parts = (node.properties.filePath ?? '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      const dir =
        parts[0] === 'src' && parts.length >= 3 ? `src/${parts[1]}` : parts[0];
      dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
    }
  }
  const topDirs = [...dirCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // External deps (deduplicated)
  const allDeps = [...new Set(Object.values(externalDeps).flat())].sort();

  // Stats
  const fileCount = graph.nodes.filter((n) => n.label === 'File').length;
  const fnCount = graph.nodes.filter(
    (n) => n.label === 'Function' || n.label === 'Method',
  ).length;
  const classCount = graph.nodes.filter((n) => n.label === 'Class').length;

  // Context Prompt (compact, deterministic)
  const archLayers = topDirs
    .slice(0, 3)
    .map(([d]) => d)
    .join(', ');
  const topStack = allDeps.slice(0, 8).join(', ') || 'unknown';
  const topEntries = keyNodes
    .slice(0, 5)
    .map(
      ({ node, degree }) =>
        `${node.properties.name ?? node.id} (${node.label}, ${degree} connections)`,
    )
    .join('; ');

  const contextPrompt = [
    `Project: ${projectName}`,
    `Stack: ${topStack}`,
    `Size: ${fileCount} files, ${fnCount} functions/methods, ${classCount} classes, ${graph.relationshipCount} edges`,
    archLayers ? `Architecture layers: ${archLayers}` : '',
    topEntries ? `Key entry points: ${topEntries}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Project structure
  const structureLines =
    topDirs.map(([dir, count]) => `  ${dir}/  (${count} files)`).join('\n') ||
    '  (no files detected)';

  // Key nodes table
  const keyNodesLines =
    keyNodes
      .map(({ node, degree }, i) => {
        const file = (node.properties.filePath ?? '').split('/').pop() ?? '';
        return `${i + 1}. ${node.properties.name ?? node.id} | ${node.label} | ${file} | ${degree} connections`;
      })
      .join('\n') || '(no nodes)';

  // Communities
  const communities = graph.nodes.filter((n) => n.label === 'Community');
  const communitiesLines =
    communities.length > 0
      ? communities.map((c) => `- ${c.properties.name ?? c.id}`).join('\n')
      : 'No communities detected.';

  return [
    `# GraphMyCode — Agent Context Export`,
    `Generated: ${date} | Project: ${projectName}`,
    '',
    `## Context Prompt`,
    '',
    contextPrompt,
    '',
    `## Project Structure`,
    '',
    structureLines,
    '',
    `## Key Nodes`,
    '',
    keyNodesLines,
    '',
    `## Main Dependencies`,
    '',
    allDeps.length > 0 ? allDeps.join('\n') : '(none detected)',
    '',
    `## Detected Communities`,
    '',
    communitiesLines,
  ].join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/unit/agent-context-export.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-context-export.ts test/unit/agent-context-export.test.ts
git commit -m "feat: añadir buildAgentContext y exportAgentContext con tests"
```

---

### Task 3: Integrate Agent Mode panel in SidePanel

**Files:**
- Modify: `src/screens/SidePanel.tsx`

- [ ] **Step 1: Add imports and useMemo**

At the top of `SidePanel.tsx`, add these two imports after the existing ones:

```typescript
import { useMemo } from 'react';
import { detectAgentCode } from '../lib/agent-detection';
import { exportAgentContext } from '../lib/agent-context-export';
```

- [ ] **Step 2: Destructure `externalDeps` from `useAppState`**

Change the existing destructuring:

```typescript
// Before:
const {
  graph, setViewMode, setGraph, projectName,
  isSidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed,
  graphViewType, semanticClusterData,
} = useAppState();

// After:
const {
  graph, setViewMode, setGraph, projectName,
  isSidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed,
  graphViewType, semanticClusterData, externalDeps,
} = useAppState();
```

- [ ] **Step 3: Add the detection useMemo**

Add this after the `stats` object declaration (after the `handleReset` function):

```typescript
const agentDetection = useMemo(() => {
  if (!graph) return { isAgent: false, confidence: 0 };
  return detectAgentCode(graph, externalDeps);
}, [graph, externalDeps]);

const handleExportAgentContext = () => {
  if (!graph) return;
  exportAgentContext(graph, projectName, externalDeps);
};
```

- [ ] **Step 4: Add the Agent Mode panel in JSX**

Find the `{/* Reset button */}` block and insert the Agent Mode panel BEFORE it:

```tsx
{/* Agent Mode panel — only shown when agent code is detected */}
{agentDetection.isAgent && (
  <>
    <hr className="mb-4 border-border-subtle" />
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 rounded-md border border-secondary/30 bg-secondary/10 px-2.5 py-1.5">
        <span className="text-sm">⚡</span>
        <span className="text-xs font-semibold text-secondary">Agent Mode Detected</span>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        AI agent code detected. Export context for your agent.
      </p>
      <button
        onClick={handleExportAgentContext}
        className="w-full rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-xs text-secondary transition-colors hover:bg-secondary/20"
      >
        ⬇ Export Agent Context
      </button>
    </section>
  </>
)}
```

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: All existing tests PASS + new tests PASS. No regressions.

- [ ] **Step 6: Commit**

```bash
git add src/screens/SidePanel.tsx
git commit -m "feat: mostrar panel Agent Mode en sidebar cuando se detecta agente"
```

---

### Task 4: Final check and push

- [ ] **Step 1: Run full test suite one more time**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 2: Build to catch TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Push branch**

```bash
git push -u origin AgentMode
```
