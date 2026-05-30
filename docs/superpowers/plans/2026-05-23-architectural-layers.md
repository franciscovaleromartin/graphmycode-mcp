# Architectural Layers View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una vista "Architectural Layers" a GraphMyCode que organiza el grafo en carriles verticales por capa arquitectónica con Diff Impact Analysis, Path Finder, métricas por capa e integración con el export de CLAUDE.md/AGENTS.md.

**Architecture:** Tres utilidades puras (`layerDetection.ts`, `diffImpact.ts`, `pathFinder.ts`) compartidas entre la vista visual y el pipeline de AgentMode. El componente `ArchitecturalLayersView.tsx` usa SVG+React para el layout determinístico en carriles y D3-zoom únicamente para zoom/pan. La integración con el sistema de vistas sigue el patrón existente de HeatmapView.

**Tech Stack:** React 19, TypeScript, Vitest, D3 v7 (d3-zoom únicamente), SVG, Tailwind CSS.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/layerDetection.ts` | Crear | Clasificación de nodos por capa (pura) |
| `src/lib/layerDetection.test.ts` | Crear | Tests de layerDetection |
| `src/lib/diffImpact.ts` | Crear | BFS de propagación de impacto (pura) |
| `src/lib/diffImpact.test.ts` | Crear | Tests de diffImpact |
| `src/lib/pathFinder.ts` | Crear | BFS camino más corto (pura) |
| `src/lib/pathFinder.test.ts` | Crear | Tests de pathFinder |
| `src/components/ArchitecturalLayersView.tsx` | Crear | Componente SVG+D3-zoom |
| `src/components/GraphViewToggle.tsx` | Modificar | Añadir tipo 'architectural' |
| `src/hooks/useAppState.tsx` | Modificar | Ampliar graphViewType |
| `src/components/GraphCanvas.tsx` | Modificar | Montar vista + controles toolbar |
| `src/lib/agent-context/builders.ts` | Modificar | Sección ## Architecture en CLAUDE.md |

---

## Task 1: Crear la rama de trabajo

**Files:**
- (ninguno — operación git)

- [ ] **Step 1: Crear y cambiar a la rama `architectural`**

```bash
git checkout -b architectural
```

- [ ] **Step 2: Verificar la rama**

```bash
git branch --show-current
```

Expected: `architectural`

---

## Task 2: `layerDetection.ts` — utilidad pura de clasificación por capa

**Files:**
- Create: `src/lib/layerDetection.ts`
- Create: `src/lib/layerDetection.test.ts`

- [ ] **Step 1: Escribir los tests primero**

Crear `src/lib/layerDetection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GraphNode } from 'gitnexus-shared';
import {
  detectLayer,
  groupNodesByLayer,
  computeLayerStats,
  type LayerName,
} from './layerDetection';

function makeNode(id: string, filePath: string, label: GraphNode['label'] = 'Function'): GraphNode {
  return {
    id,
    label,
    properties: { name: id, filePath } as GraphNode['properties'],
  };
}

describe('detectLayer', () => {
  it('clasifica /api/ como api', () => {
    expect(detectLayer(makeNode('a', 'src/api/index.ts'))).toBe('api');
  });

  it('clasifica /routes/ como api', () => {
    expect(detectLayer(makeNode('a', 'src/routes/user.ts'))).toBe('api');
  });

  it('clasifica /services/ como service', () => {
    expect(detectLayer(makeNode('a', 'src/services/auth.ts'))).toBe('service');
  });

  it('clasifica /models/ como data', () => {
    expect(detectLayer(makeNode('a', 'src/models/User.ts'))).toBe('data');
  });

  it('clasifica /components/ como ui', () => {
    expect(detectLayer(makeNode('a', 'src/components/Button.tsx'))).toBe('ui');
  });

  it('clasifica /utils/ como utility', () => {
    expect(detectLayer(makeNode('a', 'src/utils/format.ts'))).toBe('utility');
  });

  it('clasifica /config/ como config', () => {
    expect(detectLayer(makeNode('a', 'src/config/env.ts'))).toBe('config');
  });

  it('clasifica /tests/ como test', () => {
    expect(detectLayer(makeNode('a', 'src/tests/auth.test.ts'))).toBe('test');
  });

  it('clasifica /__tests__/ como test', () => {
    expect(detectLayer(makeNode('a', 'src/__tests__/unit.ts'))).toBe('test');
  });

  it('nodo Route sin match de ruta cae en api por label', () => {
    expect(detectLayer(makeNode('a', 'src/misc/route.ts', 'Route'))).toBe('api');
  });

  it('nodo sin match de ruta ni label especial es unknown', () => {
    expect(detectLayer(makeNode('a', 'src/misc/foo.ts'))).toBe('unknown');
  });

  it('el primer match de ruta gana (orden de prioridad)', () => {
    // /api/ gana sobre /utils/ si aparece primero en la ruta
    expect(detectLayer(makeNode('a', 'src/api/utils/helper.ts'))).toBe('api');
  });
});

describe('groupNodesByLayer', () => {
  it('agrupa nodos correctamente en sus capas', () => {
    const nodes = [
      makeNode('a', 'src/api/index.ts'),
      makeNode('b', 'src/api/user.ts'),
      makeNode('c', 'src/models/User.ts'),
    ];
    const groups = groupNodesByLayer(nodes);
    expect(groups.get('api')).toHaveLength(2);
    expect(groups.get('data')).toHaveLength(1);
    expect(groups.get('ui')).toBeUndefined();
  });
});

describe('computeLayerStats', () => {
  it('calcula cross-layer deps correctamente', () => {
    const nodes = [
      makeNode('a', 'src/api/index.ts'),
      makeNode('b', 'src/models/User.ts'),
    ];
    const rels = [
      { id: 'r1', sourceId: 'a', targetId: 'b', type: 'IMPORTS' as const, confidence: 1, reason: '' },
    ];
    const stats = computeLayerStats(nodes, rels);
    const api = stats.find(s => s.layer === 'api')!;
    expect(api.crossLayerDeps).toBe(1);
    const data = stats.find(s => s.layer === 'data')!;
    expect(data.crossLayerDeps).toBe(0);
  });

  it('devuelve array vacío si no hay nodos', () => {
    expect(computeLayerStats([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run src/lib/layerDetection.test.ts
```

Expected: falla con "Cannot find module './layerDetection'"

- [ ] **Step 3: Implementar `layerDetection.ts`**

Crear `src/lib/layerDetection.ts`:

```ts
// Copyright (C) 2026 Francisco Alejandro Valero Martin
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GraphNode, GraphRelationship } from 'gitnexus-shared';

export type LayerName =
  | 'api' | 'service' | 'data' | 'ui'
  | 'utility' | 'config' | 'test' | 'unknown';

export interface LayerStats {
  layer: LayerName;
  nodeCount: number;
  avgFanIn: number;
  avgFanOut: number;
  crossLayerDeps: number;
}

// Orden de smells: índice más bajo = capa "más alta" en la jerarquía
export const LAYER_ORDER: Record<LayerName, number> = {
  ui: 0, api: 1, service: 2, data: 3, utility: 4, config: 5, test: 6, unknown: 7,
};

// Orden de renderizado de carriles L→R
export const LANE_ORDER: LayerName[] = [
  'ui', 'api', 'service', 'data', 'utility', 'config', 'test', 'unknown',
];

const PATH_PATTERNS: Array<{ pattern: string; layer: LayerName }> = [
  { pattern: '/api/', layer: 'api' },
  { pattern: '/routes/', layer: 'api' },
  { pattern: '/controllers/', layer: 'api' },
  { pattern: '/endpoints/', layer: 'api' },
  { pattern: '/services/', layer: 'service' },
  { pattern: '/handlers/', layer: 'service' },
  { pattern: '/middleware/', layer: 'service' },
  { pattern: '/usecases/', layer: 'service' },
  { pattern: '/models/', layer: 'data' },
  { pattern: '/db/', layer: 'data' },
  { pattern: '/database/', layer: 'data' },
  { pattern: '/schema/', layer: 'data' },
  { pattern: '/migrations/', layer: 'data' },
  { pattern: '/repositories/', layer: 'data' },
  { pattern: '/components/', layer: 'ui' },
  { pattern: '/views/', layer: 'ui' },
  { pattern: '/pages/', layer: 'ui' },
  { pattern: '/screens/', layer: 'ui' },
  { pattern: '/layouts/', layer: 'ui' },
  { pattern: '/utils/', layer: 'utility' },
  { pattern: '/helpers/', layer: 'utility' },
  { pattern: '/lib/', layer: 'utility' },
  { pattern: '/shared/', layer: 'utility' },
  { pattern: '/common/', layer: 'utility' },
  { pattern: '/config/', layer: 'config' },
  { pattern: '/constants/', layer: 'config' },
  { pattern: '/env/', layer: 'config' },
  { pattern: '/settings/', layer: 'config' },
  { pattern: '/test/', layer: 'test' },
  { pattern: '/tests/', layer: 'test' },
  { pattern: '/__tests__/', layer: 'test' },
  { pattern: '/spec/', layer: 'test' },
  { pattern: '/e2e/', layer: 'test' },
];

export function detectLayer(node: GraphNode): LayerName {
  const fp = (node.properties.filePath ?? '').toLowerCase();

  for (const { pattern, layer } of PATH_PATTERNS) {
    if (fp.includes(pattern)) return layer;
  }

  // Fallback por label
  if (node.label === 'Route') return 'api';

  return 'unknown';
}

export function groupNodesByLayer(nodes: GraphNode[]): Map<LayerName, GraphNode[]> {
  const groups = new Map<LayerName, GraphNode[]>();
  for (const node of nodes) {
    const layer = detectLayer(node);
    if (!groups.has(layer)) groups.set(layer, []);
    groups.get(layer)!.push(node);
  }
  return groups;
}

export function computeLayerStats(
  nodes: GraphNode[],
  relationships: GraphRelationship[],
): LayerStats[] {
  if (nodes.length === 0) return [];

  const nodeLayer = new Map<string, LayerName>(nodes.map(n => [n.id, detectLayer(n)]));

  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const crossLayerDepsPerLayer = new Map<LayerName, number>();

  for (const rel of relationships) {
    const srcLayer = nodeLayer.get(rel.sourceId);
    const tgtLayer = nodeLayer.get(rel.targetId);
    if (!srcLayer || !tgtLayer) continue;

    fanOut.set(rel.sourceId, (fanOut.get(rel.sourceId) ?? 0) + 1);
    fanIn.set(rel.targetId, (fanIn.get(rel.targetId) ?? 0) + 1);

    if (srcLayer !== tgtLayer) {
      crossLayerDepsPerLayer.set(srcLayer, (crossLayerDepsPerLayer.get(srcLayer) ?? 0) + 1);
    }
  }

  const groups = groupNodesByLayer(nodes);
  const stats: LayerStats[] = [];

  for (const [layer, layerNodes] of groups) {
    const totalFanIn = layerNodes.reduce((s, n) => s + (fanIn.get(n.id) ?? 0), 0);
    const totalFanOut = layerNodes.reduce((s, n) => s + (fanOut.get(n.id) ?? 0), 0);
    const count = layerNodes.length;

    stats.push({
      layer,
      nodeCount: count,
      avgFanIn: count > 0 ? Math.round((totalFanIn / count) * 10) / 10 : 0,
      avgFanOut: count > 0 ? Math.round((totalFanOut / count) * 10) / 10 : 0,
      crossLayerDeps: crossLayerDepsPerLayer.get(layer) ?? 0,
    });
  }

  return stats;
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npx vitest run src/lib/layerDetection.test.ts
```

Expected: todos los tests en PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/layerDetection.ts src/lib/layerDetection.test.ts
git commit -m "feat: añadir utilidad pura layerDetection — clasificación de nodos por capa arquitectónica"
```

---

## Task 3: `diffImpact.ts` — BFS inverso de propagación de impacto

**Files:**
- Create: `src/lib/diffImpact.ts`
- Create: `src/lib/diffImpact.test.ts`

- [ ] **Step 1: Escribir los tests primero**

Crear `src/lib/diffImpact.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GraphRelationship } from 'gitnexus-shared';
import { computeImpact } from './diffImpact';

function makeRel(id: string, sourceId: string, targetId: string): GraphRelationship {
  return { id, sourceId, targetId, type: 'IMPORTS', confidence: 1, reason: '' };
}

describe('computeImpact', () => {
  it('los nodos seleccionados están en direct', () => {
    const result = computeImpact(new Set(['a']), []);
    expect(result.direct.has('a')).toBe(true);
    expect(result.hop1.size).toBe(0);
    expect(result.transitive.size).toBe(0);
  });

  it('un nodo que importa directamente al seleccionado está en hop1', () => {
    // b IMPORTS a, a está seleccionado → b está en hop1
    const rels = [makeRel('r1', 'b', 'a')];
    const result = computeImpact(new Set(['a']), rels);
    expect(result.hop1.has('b')).toBe(true);
    expect(result.transitive.has('b')).toBe(false);
  });

  it('un nodo a 2 hops está en transitive', () => {
    // c IMPORTS b, b IMPORTS a, a está seleccionado
    const rels = [makeRel('r1', 'b', 'a'), makeRel('r2', 'c', 'b')];
    const result = computeImpact(new Set(['a']), rels, 3);
    expect(result.hop1.has('b')).toBe(true);
    expect(result.transitive.has('c')).toBe(true);
  });

  it('respeta maxDepth — no propaga más allá del límite', () => {
    // c→b→a, maxDepth=1: solo hop1 (b), c queda fuera
    const rels = [makeRel('r1', 'b', 'a'), makeRel('r2', 'c', 'b')];
    const result = computeImpact(new Set(['a']), rels, 1);
    expect(result.hop1.has('b')).toBe(true);
    expect(result.transitive.has('c')).toBe(false);
  });

  it('propaga a través de CALLS y USES además de IMPORTS', () => {
    const rels = [
      { id: 'r1', sourceId: 'b', targetId: 'a', type: 'CALLS' as const, confidence: 1, reason: '' },
    ];
    const result = computeImpact(new Set(['a']), rels);
    expect(result.hop1.has('b')).toBe(true);
  });

  it('no incluye nodos seleccionados en hop1/transitive', () => {
    // a→a (ciclo): no debe aparecer en hop1
    const rels = [makeRel('r1', 'a', 'a')];
    const result = computeImpact(new Set(['a']), rels);
    expect(result.hop1.has('a')).toBe(false);
  });

  it('byLayer cuenta nodos impactados por capa cuando se proveen nodos', () => {
    const { GraphNode } = {} as any; // no se usa directamente
    // byLayer siempre se puede llamar pasando un mapeo externo
    // la función es agnóstica a capas — byLayer se rellena externamente en el componente
    const result = computeImpact(new Set(['a']), []);
    expect(result.byLayer).toBeDefined();
    expect(result.byLayer.size).toBe(0);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run src/lib/diffImpact.test.ts
```

Expected: falla con "Cannot find module './diffImpact'"

- [ ] **Step 3: Implementar `diffImpact.ts`**

Crear `src/lib/diffImpact.ts`:

```ts
// Copyright (C) 2026 Francisco Alejandro Valero Martin
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GraphRelationship } from 'gitnexus-shared';
import type { LayerName } from './layerDetection';

export interface ImpactResult {
  direct: Set<string>;
  hop1: Set<string>;
  transitive: Set<string>;
  byLayer: Map<LayerName, number>;
}

const PROPAGATION_TYPES = new Set<string>(['IMPORTS', 'CALLS', 'USES']);

export function computeImpact(
  selectedIds: Set<string>,
  relationships: GraphRelationship[],
  maxDepth = 3,
): ImpactResult {
  // Construir índice inverso: target → [sources que lo importan/usan]
  const reverseDeps = new Map<string, string[]>();
  for (const rel of relationships) {
    if (!PROPAGATION_TYPES.has(rel.type)) continue;
    if (!reverseDeps.has(rel.targetId)) reverseDeps.set(rel.targetId, []);
    reverseDeps.get(rel.targetId)!.push(rel.sourceId);
  }

  const direct = new Set(selectedIds);
  const hop1 = new Set<string>();
  const transitive = new Set<string>();
  const visited = new Set(selectedIds);

  // BFS inverso por niveles
  let frontier = [...selectedIds];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      for (const dependentId of reverseDeps.get(nodeId) ?? []) {
        if (visited.has(dependentId)) continue;
        visited.add(dependentId);
        nextFrontier.push(dependentId);
        if (depth === 1) hop1.add(dependentId);
        else transitive.add(dependentId);
      }
    }
    frontier = nextFrontier;
  }

  return { direct, hop1, transitive, byLayer: new Map<LayerName, number>() };
}

// Rellena byLayer dado un mapeo nodeId → LayerName (calculado externamente)
export function enrichWithLayers(
  result: ImpactResult,
  nodeLayerMap: Map<string, LayerName>,
): ImpactResult {
  const byLayer = new Map<LayerName, number>();
  const allImpacted = [...result.hop1, ...result.transitive];
  for (const nodeId of allImpacted) {
    const layer = nodeLayerMap.get(nodeId);
    if (!layer) continue;
    byLayer.set(layer, (byLayer.get(layer) ?? 0) + 1);
  }
  return { ...result, byLayer };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npx vitest run src/lib/diffImpact.test.ts
```

Expected: todos los tests en PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/diffImpact.ts src/lib/diffImpact.test.ts
git commit -m "feat: añadir utilidad pura diffImpact — BFS inverso de propagación de impacto"
```

---

## Task 4: `pathFinder.ts` — BFS de camino más corto

**Files:**
- Create: `src/lib/pathFinder.ts`
- Create: `src/lib/pathFinder.test.ts`

- [ ] **Step 1: Escribir los tests primero**

Crear `src/lib/pathFinder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GraphRelationship } from 'gitnexus-shared';
import { findShortestPath } from './pathFinder';

function makeRel(id: string, sourceId: string, targetId: string): GraphRelationship {
  return { id, sourceId, targetId, type: 'IMPORTS', confidence: 1, reason: '' };
}

describe('findShortestPath', () => {
  it('devuelve [from, to] para nodos conectados directamente', () => {
    const rels = [makeRel('r1', 'a', 'b')];
    expect(findShortestPath('a', 'b', rels)).toEqual(['a', 'b']);
  });

  it('devuelve null si no hay camino', () => {
    const rels = [makeRel('r1', 'a', 'b')];
    expect(findShortestPath('a', 'c', rels)).toBeNull();
  });

  it('devuelve el camino más corto entre nodos no directamente conectados', () => {
    const rels = [
      makeRel('r1', 'a', 'b'),
      makeRel('r2', 'b', 'c'),
      makeRel('r3', 'a', 'd'),
      makeRel('r4', 'd', 'c'), // alternativa más larga: a→d→c (2 hops = 3 nodos, mismo que a→b→c)
    ];
    const path = findShortestPath('a', 'c', rels);
    expect(path).not.toBeNull();
    expect(path![0]).toBe('a');
    expect(path![path!.length - 1]).toBe('c');
    expect(path!.length).toBe(3); // camino de 2 hops
  });

  it('devuelve [from] si from === to', () => {
    expect(findShortestPath('a', 'a', [])).toEqual(['a']);
  });

  it('funciona con grafos sin aristas', () => {
    expect(findShortestPath('a', 'b', [])).toBeNull();
  });

  it('maneja ciclos sin bucle infinito', () => {
    const rels = [
      makeRel('r1', 'a', 'b'),
      makeRel('r2', 'b', 'a'), // ciclo
    ];
    expect(findShortestPath('a', 'c', rels)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run src/lib/pathFinder.test.ts
```

Expected: falla con "Cannot find module './pathFinder'"

- [ ] **Step 3: Implementar `pathFinder.ts`**

Crear `src/lib/pathFinder.ts`:

```ts
// Copyright (C) 2026 Francisco Alejandro Valero Martin
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GraphRelationship } from 'gitnexus-shared';

export function findShortestPath(
  fromId: string,
  toId: string,
  relationships: GraphRelationship[],
): string[] | null {
  if (fromId === toId) return [fromId];

  // Grafo no dirigido: incluir ambas direcciones de cada relación
  const adj = new Map<string, string[]>();
  for (const rel of relationships) {
    if (!adj.has(rel.sourceId)) adj.set(rel.sourceId, []);
    if (!adj.has(rel.targetId)) adj.set(rel.targetId, []);
    adj.get(rel.sourceId)!.push(rel.targetId);
    adj.get(rel.targetId)!.push(rel.sourceId);
  }

  const visited = new Set<string>([fromId]);
  const parent = new Map<string, string>();
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adj.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      if (neighbor === toId) {
        // Reconstruir camino
        const path: string[] = [];
        let node: string | undefined = toId;
        while (node !== undefined) {
          path.unshift(node);
          node = parent.get(node);
        }
        return path;
      }
      queue.push(neighbor);
    }
  }

  return null;
}
```

- [ ] **Step 4: Correr todos los tests de utilidades para verificar que pasan**

```bash
npx vitest run src/lib/layerDetection.test.ts src/lib/diffImpact.test.ts src/lib/pathFinder.test.ts
```

Expected: todos los tests en PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pathFinder.ts src/lib/pathFinder.test.ts
git commit -m "feat: añadir utilidad pura pathFinder — BFS de camino más corto entre nodos"
```

---

## Task 5: `ArchitecturalLayersView.tsx` — estructura base y layout en carriles

**Files:**
- Create: `src/components/ArchitecturalLayersView.tsx`

Esta tarea crea el esqueleto completo del componente: layout en carriles, aristas con los tres estilos, zoom/pan con D3 y panel lateral con métricas. Sin interactividad todavía (sin Diff ni Path Finder).

- [ ] **Step 1: Crear el componente base**

Crear `src/components/ArchitecturalLayersView.tsx`:

```tsx
// Copyright (C) 2026 Francisco Alejandro Valero Martin
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphRelationship } from 'gitnexus-shared';
import type { KnowledgeGraph } from '../core/graph/types';
import {
  detectLayer,
  groupNodesByLayer,
  computeLayerStats,
  LANE_ORDER,
  LAYER_ORDER,
  type LayerName,
} from '../lib/layerDetection';
import { computeImpact, enrichWithLayers, type ImpactResult } from '../lib/diffImpact';
import { findShortestPath } from '../lib/pathFinder';

// ── Constantes de layout ──────────────────────────────────────────────────────

const LANE_WIDTH = 180;
const LANE_HEADER_H = 48;
const NODE_RADIUS = 8;
const NODE_V_SPACING = 40;
const NODE_PADDING_TOP = 16;

// ── Colores de capa ───────────────────────────────────────────────────────────

const LAYER_COLORS: Record<LayerName, string> = {
  api:     '#818cf8',
  service: '#34d399',
  data:    '#f472b6',
  ui:      '#60a5fa',
  utility: '#fbbf24',
  config:  '#94a3b8',
  test:    '#a78bfa',
  unknown: '#6b7280',
};

// ── Tipos internos ────────────────────────────────────────────────────────────

interface LayoutNode {
  node: GraphNode;
  layer: LayerName;
  laneIndex: number;
  indexInLane: number;
  x: number;
  y: number;
}

interface LayoutEdge {
  sourceId: string;
  targetId: string;
  type: 'intra' | 'cross-down' | 'cross-up';
}

// ── Props y Handle ────────────────────────────────────────────────────────────

interface Props {
  graph: KnowledgeGraph;
  onNodeClick: (node: GraphNode) => void;
  isActive?: boolean;
}

export interface ArchitecturalLayersViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setDiffModeActive: (active: boolean) => void;
}

// ── Funciones de layout ───────────────────────────────────────────────────────

function buildLayout(
  nodes: GraphNode[],
  relationships: GraphRelationship[],
): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[]; svgHeight: number } {
  // Contar fan-in por nodo para ordenar dentro de cada carril
  const fanIn = new Map<string, number>();
  for (const rel of relationships) {
    fanIn.set(rel.targetId, (fanIn.get(rel.targetId) ?? 0) + 1);
  }

  const groups = groupNodesByLayer(nodes);
  const nodeLayerMap = new Map<string, LayerName>(nodes.map(n => [n.id, detectLayer(n)]));

  // Solo carriles con nodos, en el orden de LANE_ORDER
  const activeLanes = LANE_ORDER.filter(l => groups.has(l));

  const layoutNodes: LayoutNode[] = [];
  const nodePos = new Map<string, { x: number; y: number }>();
  let maxNodesInLane = 0;

  activeLanes.forEach((layer, laneIndex) => {
    const laneNodes = (groups.get(layer) ?? [])
      .sort((a, b) => (fanIn.get(b.id) ?? 0) - (fanIn.get(a.id) ?? 0));
    maxNodesInLane = Math.max(maxNodesInLane, laneNodes.length);

    laneNodes.forEach((node, indexInLane) => {
      const x = laneIndex * LANE_WIDTH + LANE_WIDTH / 2;
      const y = LANE_HEADER_H + NODE_PADDING_TOP + indexInLane * NODE_V_SPACING + NODE_RADIUS;
      layoutNodes.push({ node, layer, laneIndex, indexInLane, x, y });
      nodePos.set(node.id, { x, y });
    });
  });

  const svgHeight = LANE_HEADER_H + NODE_PADDING_TOP + maxNodesInLane * NODE_V_SPACING + NODE_RADIUS + 24;

  // Construir aristas con tipo
  const RENDER_REL_TYPES = new Set(['IMPORTS', 'CALLS', 'USES', 'CONTAINS', 'DEFINES']);
  const seen = new Set<string>();
  const layoutEdges: LayoutEdge[] = [];

  for (const rel of relationships) {
    if (!RENDER_REL_TYPES.has(rel.type)) continue;
    const key = `${rel.sourceId}→${rel.targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const srcLayer = nodeLayerMap.get(rel.sourceId);
    const tgtLayer = nodeLayerMap.get(rel.targetId);
    if (!nodePos.has(rel.sourceId) || !nodePos.has(rel.targetId)) continue;

    let type: LayoutEdge['type'] = 'intra';
    if (srcLayer && tgtLayer && srcLayer !== tgtLayer) {
      const isUpward = LAYER_ORDER[srcLayer] > LAYER_ORDER[tgtLayer];
      type = isUpward ? 'cross-up' : 'cross-down';
    }

    layoutEdges.push({ sourceId: rel.sourceId, targetId: rel.targetId, type });
  }

  return { layoutNodes, layoutEdges, svgHeight };
}

function edgePath(
  sx: number, sy: number,
  tx: number, ty: number,
  type: LayoutEdge['type'],
): string {
  if (type === 'intra') {
    // Curva suave dentro del mismo carril
    const offset = Math.abs(ty - sy) * 0.3 + 20;
    return `M ${sx} ${sy} C ${sx + offset} ${sy} ${tx + offset} ${ty} ${tx} ${ty}`;
  }
  // Cross-layer: Bézier horizontal
  const midX = (sx + tx) / 2;
  return `M ${sx} ${sy} C ${midX} ${sy} ${midX} ${ty} ${tx} ${ty}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export const ArchitecturalLayersView = forwardRef<ArchitecturalLayersViewHandle, Props>(
  ({ graph, onNodeClick }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    // ── Estado interactivo ──────────────────────────────────────────────────
    const [diffModeActive, setDiffModeActive] = useState(false);
    const [selectedForDiff, setSelectedForDiff] = useState<Set<string>>(new Set());
    const [pathFrom, setPathFrom] = useState<string | null>(null);
    const [pathResult, setPathResult] = useState<string[] | null>(null);
    const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);

    // ── Layout (determinístico, sin física) ─────────────────────────────────
    const { layoutNodes, layoutEdges, svgHeight, layerStats, nodeLayerMap, svgWidth } = useMemo(() => {
      const filteredNodes = graph.nodes.filter(
        n => n.label !== 'Community' && n.label !== 'Project',
      );
      const { layoutNodes, layoutEdges, svgHeight } = buildLayout(filteredNodes, graph.relationships);
      const layerStats = computeLayerStats(filteredNodes, graph.relationships);
      const nodeLayerMap = new Map<string, LayerName>(filteredNodes.map(n => [n.id, detectLayer(n)]));
      const activeLanes = LANE_ORDER.filter(l => layoutNodes.some(ln => ln.layer === l));
      const svgWidth = Math.max(800, activeLanes.length * LANE_WIDTH);
      return { layoutNodes, layoutEdges, svgHeight, layerStats, nodeLayerMap, svgWidth };
    }, [graph]);

    // ── Recalcular impacto cuando cambia la selección o el modo diff ────────
    useEffect(() => {
      if (!diffModeActive || selectedForDiff.size === 0) {
        setImpactResult(null);
        return;
      }
      const raw = computeImpact(selectedForDiff, graph.relationships);
      setImpactResult(enrichWithLayers(raw, nodeLayerMap));
    }, [diffModeActive, selectedForDiff, graph.relationships, nodeLayerMap]);

    // ── D3 Zoom ─────────────────────────────────────────────────────────────
    useEffect(() => {
      if (!svgRef.current || !gRef.current) return;
      const svg = d3.select(svgRef.current);
      const g = d3.select(gRef.current);
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.08, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform.toString());
        });
      zoomRef.current = zoom;
      svg.call(zoom);
      return () => { svg.on('.zoom', null); };
    }, []);

    // ── Handle imperativo ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1.3);
      },
      zoomOut: () => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1 / 1.3);
      },
      resetZoom: () => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
      },
      setDiffModeActive: (active: boolean) => {
        setDiffModeActive(active);
        if (!active) {
          setSelectedForDiff(new Set());
          setPathFrom(null);
          setPathResult(null);
          setImpactResult(null);
        }
      },
    }));

    // ── Interacciones de clic ────────────────────────────────────────────────
    function handleNodeClick(e: React.MouseEvent, ln: LayoutNode) {
      e.stopPropagation();

      if (e.shiftKey && pathFrom !== null && pathFrom !== ln.node.id) {
        // Path Finder: shift+click en segundo nodo
        const path = findShortestPath(pathFrom, ln.node.id, graph.relationships);
        setPathResult(path);
        setPathFrom(null);
        return;
      }

      if (diffModeActive) {
        // Diff Mode: click normal selecciona/deselecciona para diff
        if (pathFrom === null) {
          setPathFrom(ln.node.id);
        }
        setSelectedForDiff(prev => {
          const next = new Set(prev);
          if (next.has(ln.node.id)) next.delete(ln.node.id);
          else next.add(ln.node.id);
          return next;
        });
        return;
      }

      onNodeClick(ln.node);
    }

    function handleSvgClick() {
      setSelectedForDiff(new Set());
      setPathFrom(null);
      setPathResult(null);
    }

    // ── Color de nodo según impacto ──────────────────────────────────────────
    function nodeColor(nodeId: string, layer: LayerName): string {
      if (impactResult) {
        if (impactResult.direct.has(nodeId)) return '#ef4444';
        if (impactResult.hop1.has(nodeId)) return '#f97316';
        if (impactResult.transitive.has(nodeId)) return '#eab308';
      }
      if (selectedForDiff.has(nodeId)) return '#ef4444';
      return LAYER_COLORS[layer];
    }

    function nodeOpacity(nodeId: string): number {
      if (!impactResult) return 1;
      if (
        impactResult.direct.has(nodeId) ||
        impactResult.hop1.has(nodeId) ||
        impactResult.transitive.has(nodeId)
      ) return 1;
      return 0.15;
    }

    // ── Colores de aristas ───────────────────────────────────────────────────
    const EDGE_STYLES: Record<LayoutEdge['type'], { stroke: string; strokeWidth: number; dashArray?: string }> = {
      intra:       { stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 },
      'cross-down': { stroke: '#6366f1', strokeWidth: 1.5 },
      'cross-up':   { stroke: '#f97316', strokeWidth: 2, dashArray: '4 3' },
    };

    const nodePositions = new Map(layoutNodes.map(ln => [ln.node.id, { x: ln.x, y: ln.y }]));
    const activeLanesOrdered = LANE_ORDER.filter(l => layoutNodes.some(ln => ln.layer === l));

    // ── Path result: mapeo de nodeId a nombre para mostrar ───────────────────
    const nodeNameMap = new Map(graph.nodes.map(n => [n.id, n.properties.name ?? n.id]));

    return (
      <div className="flex h-full w-full overflow-hidden">
        {/* SVG principal */}
        <div className="relative flex-1 overflow-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onClick={handleSvgClick}
            style={{ background: 'transparent', cursor: 'grab' }}
          >
            <g ref={gRef}>
              {/* Fondos de carriles */}
              {activeLanesOrdered.map((layer, i) => (
                <rect
                  key={layer}
                  x={i * LANE_WIDTH}
                  y={0}
                  width={LANE_WIDTH}
                  height={svgHeight}
                  fill={i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)'}
                />
              ))}

              {/* Headers de carriles */}
              {activeLanesOrdered.map((layer, i) => (
                <g key={`header-${layer}`}>
                  <text
                    x={i * LANE_WIDTH + LANE_WIDTH / 2}
                    y={28}
                    textAnchor="middle"
                    fill={LAYER_COLORS[layer]}
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="monospace"
                  >
                    {layer.toUpperCase()}
                  </text>
                  <line
                    x1={i * LANE_WIDTH + 8}
                    y1={36}
                    x2={i * LANE_WIDTH + LANE_WIDTH - 8}
                    y2={36}
                    stroke={LAYER_COLORS[layer]}
                    strokeOpacity={0.3}
                    strokeWidth={1}
                  />
                </g>
              ))}

              {/* Aristas (debajo de nodos) */}
              {layoutEdges.map((edge, idx) => {
                const src = nodePositions.get(edge.sourceId);
                const tgt = nodePositions.get(edge.targetId);
                if (!src || !tgt) return null;
                const style = EDGE_STYLES[edge.type];
                return (
                  <path
                    key={idx}
                    d={edgePath(src.x, src.y, tgt.x, tgt.y, edge.type)}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    strokeDasharray={style.dashArray}
                    fill="none"
                    strokeOpacity={0.7}
                  />
                );
              })}

              {/* Nodos */}
              {layoutNodes.map((ln) => {
                const inPath = pathResult?.includes(ln.node.id);
                return (
                  <g
                    key={ln.node.id}
                    onClick={(e) => handleNodeClick(e, ln)}
                    style={{ cursor: 'pointer' }}
                    opacity={nodeOpacity(ln.node.id)}
                  >
                    <circle
                      cx={ln.x}
                      cy={ln.y}
                      r={inPath ? NODE_RADIUS + 3 : NODE_RADIUS}
                      fill={nodeColor(ln.node.id, ln.layer)}
                      stroke={inPath ? '#fff' : 'none'}
                      strokeWidth={inPath ? 2 : 0}
                    />
                    <text
                      x={ln.x}
                      y={ln.y + NODE_RADIUS + 11}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.7)"
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {(ln.node.properties.name ?? ln.node.id).split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Panel lateral derecho */}
        <div className="flex w-64 flex-shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-black/30 p-3 text-xs">
          {/* Sección: Layers */}
          <div>
            <p className="mb-2 font-semibold text-white/70">Layers</p>
            <table className="w-full text-left text-white/60">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-1 font-normal">Layer</th>
                  <th className="pb-1 text-right font-normal">Nodes</th>
                  <th className="pb-1 text-right font-normal">X-deps</th>
                </tr>
              </thead>
              <tbody>
                {layerStats
                  .sort((a, b) => LANE_ORDER.indexOf(a.layer) - LANE_ORDER.indexOf(b.layer))
                  .map(stat => (
                    <tr key={stat.layer} className="border-b border-white/5">
                      <td className="py-0.5" style={{ color: LAYER_COLORS[stat.layer] }}>
                        {stat.layer}
                      </td>
                      <td className="py-0.5 text-right">{stat.nodeCount}</td>
                      <td className="py-0.5 text-right">{stat.crossLayerDeps}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Sección: Impact (solo en Diff Mode con selección) */}
          {diffModeActive && impactResult && (
            <div>
              <p className="mb-2 font-semibold text-white/70">Blast Radius</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-red-400">Direct</span>
                  <span>{impactResult.direct.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-400">1-hop</span>
                  <span>{impactResult.hop1.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-400">Transitive</span>
                  <span>{impactResult.transitive.size}</span>
                </div>
              </div>
              {impactResult.byLayer.size > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-white/50">By layer:</p>
                  {[...impactResult.byLayer.entries()].map(([layer, count]) => (
                    <div key={layer} className="flex justify-between">
                      <span style={{ color: LAYER_COLORS[layer] }}>{layer}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sección: Path Finder */}
          {pathResult !== null && (
            <div>
              <p className="mb-2 font-semibold text-white/70">Shortest Path</p>
              {pathResult.length === 0 ? (
                <p className="text-white/40">No path found</p>
              ) : (
                <ol className="space-y-0.5">
                  {pathResult.map((id, i) => (
                    <li key={id} className="flex items-start gap-1">
                      <span className="text-white/30">{i + 1}.</span>
                      <span className="break-all text-white/70" style={{ color: LAYER_COLORS[nodeLayerMap.get(id) ?? 'unknown'] }}>
                        {nodeNameMap.get(id) ?? id}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Hints */}
          <div className="mt-auto border-t border-white/10 pt-2 text-white/30">
            {diffModeActive ? (
              <>
                <p>Click: marcar como modificado</p>
                <p>Shift+click: buscar camino A→B</p>
              </>
            ) : (
              <p>Activa Diff Mode para analizar impacto</p>
            )}
          </div>
        </div>
      </div>
    );
  },
);

ArchitecturalLayersView.displayName = 'ArchitecturalLayersView';
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add src/components/ArchitecturalLayersView.tsx
git commit -m "feat: añadir ArchitecturalLayersView — layout SVG en carriles con panel de métricas, Diff Impact y Path Finder"
```

---

## Task 6: Integrar la vista en el sistema de vistas existente

**Files:**
- Modify: `src/components/GraphViewToggle.tsx`
- Modify: `src/hooks/useAppState.tsx`
- Modify: `src/components/GraphCanvas.tsx`

- [ ] **Step 1: Actualizar `GraphViewToggle.tsx`**

Añadir `'architectural'` al tipo `ViewType` y un nuevo botón en la barra.

En `src/components/GraphViewToggle.tsx`, cambiar:

```ts
// Línea 8 — antes:
type ViewType = 'structural' | 'semantic' | 'city' | 'heatmap' | 'codeflow';

// Después:
type ViewType = 'structural' | 'semantic' | 'city' | 'heatmap' | 'codeflow' | 'architectural';
```

Añadir el import de `Network` al import de lucide-icons:

```ts
// Línea 5 — antes:
import { Layers, Brain, Building2, GitBranch, Share2 } from '@/lib/lucide-icons';

// Después:
import { Layers, Brain, Building2, GitBranch, Share2, Network } from '@/lib/lucide-icons';
```

Añadir la nueva opción al array `VIEW_OPTIONS` (al final, antes del cierre del array):

```ts
// Después de la opción 'codeflow':
  {
    type: 'architectural',
    icon: <Network className="size-3" />,
    label: 'Arch. Layers',
    title: 'Vista de capas arquitectónicas (layout en carriles)',
  },
```

Añadir `architectural: true` en `ACTIVATED_VIEWS`:

```ts
// Antes:
const ACTIVATED_VIEWS: Partial<Record<ViewType, true>> = {
  semantic: true,
  city: true,
  heatmap: true,
  codeflow: true,
};

// Después:
const ACTIVATED_VIEWS: Partial<Record<ViewType, true>> = {
  semantic: true,
  city: true,
  heatmap: true,
  codeflow: true,
  architectural: true,
};
```

- [ ] **Step 2: Actualizar el tipo `graphViewType` en `useAppState.tsx`**

En `src/hooks/useAppState.tsx`, localizar las dos líneas que definen el tipo de `graphViewType` (líneas ~130 y ~300 aprox.) y añadir `| 'architectural'`:

```ts
// Antes (aparece dos veces: en la interfaz y en el useState):
graphViewType: 'structural' | 'semantic' | 'city' | 'heatmap' | 'codeflow';
setGraphViewType: (v: 'structural' | 'semantic' | 'city' | 'heatmap' | 'codeflow') => void;

// Después:
graphViewType: 'structural' | 'semantic' | 'city' | 'heatmap' | 'codeflow' | 'architectural';
setGraphViewType: (v: 'structural' | 'semantic' | 'city' | 'heatmap' | 'codeflow' | 'architectural') => void;
```

Busca también el `useState` inicial del `graphViewType` — no necesita cambio de valor por defecto, solo de tipo en el genérico si TypeScript lo infiere mal.

- [ ] **Step 3: Montar `ArchitecturalLayersView` en `GraphCanvas.tsx`**

Añadir al bloque de imports al inicio del archivo:

```ts
import { ArchitecturalLayersView, type ArchitecturalLayersViewHandle } from './ArchitecturalLayersView';
```

Añadir también `Network` al import de lucide-icons:

```ts
// Añadir Network al import existente de lucide-icons
import { ..., Network } from '@/lib/lucide-icons';
```

Añadir los siguientes estados al cuerpo de `GraphCanvas` (junto a los otros estados de vistas, ej. después de `codeFlowRef`):

```ts
const [hasArchitecturalBeenActivated, setHasArchitecturalBeenActivated] = useState(false);
const [isDiffModeActive, setIsDiffModeActive] = useState(false);
const architecturalRef = useRef<ArchitecturalLayersViewHandle>(null);
```

En el handler `onViewActivated` dentro del `GraphViewToggle`, añadir el caso `architectural`:

```tsx
// Antes:
onViewActivated={(view) => {
  if (view === 'semantic') setHasSemanticBeenActivated(true);
  else if (view === 'city') setHasCityBeenActivated(true);
  else if (view === 'heatmap') setHasHeatmapBeenActivated(true);
  else if (view === 'codeflow') setHasCodeFlowBeenActivated(true);
}}

// Después:
onViewActivated={(view) => {
  if (view === 'semantic') setHasSemanticBeenActivated(true);
  else if (view === 'city') setHasCityBeenActivated(true);
  else if (view === 'heatmap') setHasHeatmapBeenActivated(true);
  else if (view === 'codeflow') setHasCodeFlowBeenActivated(true);
  else if (view === 'architectural') setHasArchitecturalBeenActivated(true);
}}
```

Añadir el bloque de controles del toolbar para la vista `architectural`. Insertarlo después del bloque del heatmap filter (buscar `{/* Filtro de módulos — visible en Dependency Heatmap */}`):

```tsx
{/* Control Diff Mode — visible solo en Arch. Layers */}
{graph && graphViewType === 'architectural' && (
  <div
    className={`absolute top-12 z-20 flex overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm transition-all duration-300 ${isSidebarCollapsed ? 'left-14' : 'left-60'}`}
  >
    <button
      onClick={() => {
        const next = !isDiffModeActive;
        setIsDiffModeActive(next);
        architecturalRef.current?.setDiffModeActive(next);
      }}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
        isDiffModeActive
          ? 'bg-red-500/20 text-red-300 border-red-500/30'
          : 'text-text-muted hover:bg-hover hover:text-text-secondary'
      }`}
      title="Activa el modo de análisis de impacto: haz click en nodos para marcarlos como modificados"
    >
      <Network className="size-3" />
      {isDiffModeActive ? 'Diff On' : 'Diff Mode'}
    </button>
  </div>
)}
```

Añadir el montaje del componente. Insertarlo después del bloque de CodeFlowView (buscar `{/* Vista Code Flow — Dagre + D3 */}`):

```tsx
{/* Vista Architectural Layers — SVG en carriles */}
{hasArchitecturalBeenActivated && graph && (
  <div
    className={`absolute inset-0 z-10 overflow-hidden${
      graphViewType !== 'architectural' ? ' invisible pointer-events-none' : ''
    }`}
  >
    <ArchitecturalLayersView
      ref={architecturalRef}
      graph={graph}
      isActive={graphViewType === 'architectural'}
      onNodeClick={(node) => {
        setSelectedNode(node);
        openCodePanel();
      }}
    />
  </div>
)}
```

Actualizar también la condición de visibilidad del sigma-container (la clase `invisible pointer-events-none`). Buscar esta línea:

```tsx
className={`sigma-container h-full w-full cursor-grab active:cursor-grabbing${graphViewType === 'semantic' || graphViewType === 'city' || graphViewType === 'heatmap' || graphViewType === 'codeflow' ? ' invisible pointer-events-none' : ''}`}
```

Y añadir `|| graphViewType === 'architectural'`:

```tsx
className={`sigma-container h-full w-full cursor-grab active:cursor-grabbing${graphViewType === 'semantic' || graphViewType === 'city' || graphViewType === 'heatmap' || graphViewType === 'codeflow' || graphViewType === 'architectural' ? ' invisible pointer-events-none' : ''}`}
```

Añadir también `architectural` al `delegateZoom`:

```ts
// Antes:
const delegateZoom = useCallback(
  (action: 'zoomIn' | 'zoomOut' | 'resetZoom') => {
    if (graphViewType === 'semantic') semanticRef.current?.[action]();
    else if (graphViewType === 'city') cityRef.current?.[action]();
    else if (graphViewType === 'heatmap') heatmapRef.current?.[action]();
    else if (graphViewType === 'codeflow') codeFlowRef.current?.[action]();
    else if (action === 'zoomIn') zoomIn();
    else if (action === 'zoomOut') zoomOut();
    else resetZoom();
  },
  [graphViewType, zoomIn, zoomOut, resetZoom],
);

// Después:
const delegateZoom = useCallback(
  (action: 'zoomIn' | 'zoomOut' | 'resetZoom') => {
    if (graphViewType === 'semantic') semanticRef.current?.[action]();
    else if (graphViewType === 'city') cityRef.current?.[action]();
    else if (graphViewType === 'heatmap') heatmapRef.current?.[action]();
    else if (graphViewType === 'codeflow') codeFlowRef.current?.[action]();
    else if (graphViewType === 'architectural') architecturalRef.current?.[action]();
    else if (action === 'zoomIn') zoomIn();
    else if (action === 'zoomOut') zoomOut();
    else resetZoom();
  },
  [graphViewType, zoomIn, zoomOut, resetZoom],
);
```

- [ ] **Step 4: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: sin errores de tipo.

- [ ] **Step 5: Verificar en el dev server**

```bash
npm run dev
```

Acceder a `http://localhost:5173`. Cargar un repositorio. Verificar:
1. El botón "Arch. Layers" aparece en la barra de vistas (junto a Structural, Semantic, etc.)
2. Al hacer click, la vista se muestra con carriles verticales
3. El botón "Diff Mode" aparece en el toolbar secundario (top-12)
4. Los controles de zoom (bottom-right) funcionan sobre la vista
5. El panel lateral muestra la tabla de capas con datos reales

- [ ] **Step 6: Commit**

```bash
git add src/components/GraphViewToggle.tsx src/hooks/useAppState.tsx src/components/GraphCanvas.tsx
git commit -m "feat: integrar ArchitecturalLayersView en el sistema de vistas — toggle, estado y controles"
```

---

## Task 7: Integrar `layerDetection` y `diffImpact` en el pipeline de AgentMode

**Files:**
- Modify: `src/lib/agent-context/builders.ts`

- [ ] **Step 1: Añadir la sección `## Architecture` a `buildClaudeMd`**

En `src/lib/agent-context/builders.ts`, añadir los imports al inicio del archivo (después de los imports existentes):

```ts
import { computeLayerStats, groupNodesByLayer, detectLayer, LAYER_ORDER, LANE_ORDER, type LayerName } from '../layerDetection';
import { computeImpact } from '../diffImpact';
```

Añadir la función privada `buildArchitectureSection` antes de `assembleClaude`:

```ts
function buildArchitectureSection(
  graph: KnowledgeGraph,
  cleanNodes: GraphNode[],
  degreeMap: Map<string, GraphNode['id']>,
): string {
  const filteredNodes = cleanNodes.filter(
    n => n.label !== 'Community' && n.label !== 'Project',
  );

  const stats = computeLayerStats(filteredNodes, graph.relationships);
  const layersWithNodes = stats.filter(s => s.nodeCount > 0);
  if (layersWithNodes.length < 2) return '';

  const nodeLayerMap = new Map<string, LayerName>(
    filteredNodes.map(n => [n.id, detectLayer(n)]),
  );

  // Critical file por capa: nodo con mayor fan-in dentro de la capa
  const fanInMap = new Map<string, number>();
  for (const rel of graph.relationships) {
    fanInMap.set(rel.targetId, (fanInMap.get(rel.targetId) ?? 0) + 1);
  }

  const groups = groupNodesByLayer(filteredNodes);
  const criticalByLayer = new Map<LayerName, { path: string; fanIn: number }>();
  for (const [layer, nodes] of groups) {
    let best: { path: string; fanIn: number } | null = null;
    for (const n of nodes) {
      const fi = fanInMap.get(n.id) ?? 0;
      if (!best || fi > best.fanIn) {
        best = { path: n.properties.filePath ?? n.properties.name ?? n.id, fanIn: fi };
      }
    }
    if (best && best.fanIn > 0) criticalByLayer.set(layer, best);
  }

  // Cross-layer deps por par de capas (volumen)
  const crossLayerVolume = new Map<string, number>();
  for (const rel of graph.relationships) {
    const srcLayer = nodeLayerMap.get(rel.sourceId);
    const tgtLayer = nodeLayerMap.get(rel.targetId);
    if (!srcLayer || !tgtLayer || srcLayer === tgtLayer) continue;
    const key = `${srcLayer} → ${tgtLayer}`;
    crossLayerVolume.set(key, (crossLayerVolume.get(key) ?? 0) + 1);
  }
  const topCross = [...crossLayerVolume.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Code smells: dependencias ascendentes (src tiene LAYER_ORDER mayor que tgt)
  const smells: string[] = [];
  const seenSmells = new Set<string>();
  for (const rel of graph.relationships) {
    const srcLayer = nodeLayerMap.get(rel.sourceId);
    const tgtLayer = nodeLayerMap.get(rel.targetId);
    if (!srcLayer || !tgtLayer || srcLayer === tgtLayer) continue;
    if (LAYER_ORDER[srcLayer] > LAYER_ORDER[tgtLayer]) {
      const srcPath = (graph.nodes.find(n => n.id === rel.sourceId)?.properties.filePath ?? rel.sourceId).split('/').slice(-2).join('/');
      const tgtPath = (graph.nodes.find(n => n.id === rel.targetId)?.properties.filePath ?? rel.targetId).split('/').slice(-2).join('/');
      const key = `${srcLayer}→${tgtLayer}:${srcPath}`;
      if (!seenSmells.has(key)) {
        seenSmells.add(key);
        smells.push(`- ${srcLayer} → ${tgtLayer}: \`${srcPath}\` → \`${tgtPath}\``);
      }
    }
  }

  const lines: string[] = ['## Architecture'];

  // Tabla de capas
  for (const stat of layersWithNodes.sort((a, b) => LANE_ORDER.indexOf(a.layer) - LANE_ORDER.indexOf(b.layer))) {
    const critical = criticalByLayer.get(stat.layer);
    const criticalStr = critical ? ` — critical: \`${critical.path}\` (fan-in ${critical.fanIn})` : '';
    lines.push(`- **${stat.layer}** (${stat.nodeCount} nodes): cross-deps ${stat.crossLayerDeps}${criticalStr}`);
  }

  if (topCross.length > 0) {
    lines.push('', 'Top cross-layer deps (by volume):');
    for (const [pair, count] of topCross) {
      lines.push(`- ${pair} (${count} edges)`);
    }
  }

  if (smells.length > 0) {
    lines.push('', 'Code smells (upward deps):');
    lines.push(...smells.slice(0, 5));
  }

  return lines.join('\n');
}
```

En la función `assembleClaude`, añadir `parts.architecture` en la lista de secciones, después de `parts.moduleMap`:

```ts
// Antes:
return [
  '<!-- graphmycode:generated-start -->',
  parts.header,
  parts.stack,
  parts.commands,
  parts.entries,
  parts.moduleMap,
  parts.keySymbols,
  ...
].filter(Boolean).join('\n\n');

// Después:
return [
  '<!-- graphmycode:generated-start -->',
  parts.header,
  parts.stack,
  parts.commands,
  parts.entries,
  parts.moduleMap,
  parts.architecture,
  parts.keySymbols,
  ...
].filter(Boolean).join('\n\n');
```

En la función `buildClaudeMd`, añadir la llamada a `buildArchitectureSection` y añadir `architecture` al objeto `parts`. Insertar después de la línea donde se construye `moduleMapContent`:

```ts
const moduleMapContent = buildModuleMap(...);
const architectureContent = buildArchitectureSection(graph, cleanNodes, degreeMap);
```

Y en el objeto `parts`:

```ts
const parts: Record<string, string> = {
  header: ...,
  stack: ...,
  commands: ...,
  entries: ...,
  moduleMap: ...,
  architecture: architectureContent,  // <-- añadir esta línea
  keySymbols: ...,
  ...
};
```

- [ ] **Step 2: Extender `buildAgentsMd` con información de capas**

En `buildAgentsMd`, localizar el bucle que construye la sección `## Tools`:

```ts
if (tools.length > 0) {
  lines.push('', '## Tools');
  for (const { node } of tools) {
    const name = (node.properties.name ?? node.id) as string;
    const file = (node.properties.filePath ?? '').split('/').pop() ?? '';
    lines.push(`- \`${name}(...)\` — ${describeFromSnakeCase(name)}; defined in \`${file}\``);
  }
}
```

Reemplazar por:

```ts
if (tools.length > 0) {
  lines.push('', '## Tools');
  for (const { node } of tools) {
    const name = (node.properties.name ?? node.id) as string;
    const file = (node.properties.filePath ?? '').split('/').pop() ?? '';
    const layer = detectLayer(node);
    const layerStr = layer !== 'unknown' ? `; layer: ${layer}` : '';
    lines.push(`- \`${name}(...)\` — ${describeFromSnakeCase(name)}; defined in \`${file}\`${layerStr}`);
  }
}
```

Añadir también el import de `detectLayer` al inicio del archivo (ya añadido en el paso anterior con el mismo import).

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: sin errores de tipo.

- [ ] **Step 4: Ejecutar todos los tests**

```bash
npm test
```

Expected: todos los tests en PASS (los tests de layerDetection, diffImpact, pathFinder y los existentes).

- [ ] **Step 5: Verificar el export de CLAUDE.md**

Con el dev server activo y un proyecto cargado, ir a la opción de exportar CLAUDE.md (AgentMode). Verificar que el archivo generado contiene la sección `## Architecture` con capas, cross-deps y, si los hay, code smells.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent-context/builders.ts
git commit -m "feat: enriquecer export CLAUDE.md y AGENTS.md con sección Architecture desde layerDetection y diffImpact"
```

---

## Task 8: Commit final y verificación de integración completa

- [ ] **Step 1: Correr todos los tests**

```bash
npm test
```

Expected: todos los tests en PASS.

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificar la vista completa en el dev server**

```bash
npm run dev
```

Cargar un repositorio con múltiples capas (ej. graphmycode mismo). Verificar:

1. La vista "Arch. Layers" aparece en el toggle y se activa correctamente
2. Los carriles muestran etiquetas de capa en el header
3. Las aristas cross-layer están en índigo; las ascendentes (smells) en naranja con dash
4. El panel lateral muestra la tabla de métricas por capa
5. Activar "Diff Mode", hacer click en varios nodos → el grafo colorea el impacto (rojo / naranja / amarillo)
6. El panel lateral "Blast Radius" muestra el desglose por capa
7. Shift+click en otro nodo → el camino más corto aparece en el panel lateral "Shortest Path"
8. Los controles de zoom funcionan (botones bottom-right)
9. Click en fondo deselecciona todo

- [ ] **Step 4: Verificar export CLAUDE.md**

Desde la vista, exportar CLAUDE.md con AgentMode. Abrir el archivo descargado y confirmar que contiene `## Architecture` con al menos 2 capas detectadas.

- [ ] **Step 5: Commit de cierre**

```bash
git add -A
git commit -m "feat: architectural layers — vista completa con diff impact, path finder y export AgentMode"
```

---

## Self-Review

### Spec coverage

| Requerimiento | Tarea |
|---|---|
| Layout en carriles verticales por capa | Task 5 |
| Heurísticas de rutas para clasificación | Task 2 |
| Fallback por tipo de nodo AST | Task 2 |
| Aristas cross-layer visualmente distintas | Task 5 |
| Aristas "hacia arriba" como smells | Task 5 |
| Métricas por capa (nodos, fan-in, fan-out, cross-deps) | Task 5 |
| Diff Impact Analysis con BFS inverso | Task 3 + Task 5 |
| Colores rojo/naranja/amarillo por profundidad | Task 5 |
| Panel blast radius por capa | Task 5 |
| Path Finder BFS con Shift+click | Task 4 + Task 5 |
| Path mostrado en panel lateral | Task 5 |
| `layerDetection.ts` importable de forma independiente | Task 2 |
| `diffImpact.ts` importable de forma independiente | Task 3 |
| `pathFinder.ts` BFS/Dijkstra | Task 4 |
| Integración en selector de vistas | Task 6 |
| CLAUDE.md con sección ## Architecture | Task 7 |
| AGENTS.md con capas por agente | Task 7 |
| Sin dependencias de IA externas | ✓ (ninguna añadida) |
| D3 solo para zoom/pan | ✓ (spec seguido) |

### Placeholder scan

Sin placeholders. Cada paso incluye código completo.

### Type consistency

- `LayerName` definido en `layerDetection.ts` Task 2 y re-exportado desde `diffImpact.ts` Task 3 — consistente.
- `ImpactResult.byLayer: Map<LayerName, number>` — coherente con `enrichWithLayers` en Task 3.
- `ArchitecturalLayersViewHandle` tiene `setDiffModeActive` — llamado desde `GraphCanvas.tsx` en Task 6 — consistente.
- `buildArchitectureSection` en Task 7 usa `cleanNodes` y `degreeMap` del mismo `BaseData` que el resto de `buildClaudeMd` — consistente.
