# Architectural Layers View — Design Spec

**Date:** 2026-05-23  
**Status:** Approved  
**Branch:** architectural

---

## Overview

Nueva vista "Architectural Layers" para GraphMyCode que organiza el grafo de dependencias en carriles verticales según la capa arquitectónica de cada nodo, detectada mediante heurísticas de rutas y nombres. Sin IA, todo algorítmico.

---

## Architecture

### Módulos nuevos

```
src/lib/layerDetection.ts         — utilidad pura de clasificación por capa
src/lib/diffImpact.ts             — utilidad pura de BFS de propagación de impacto
src/lib/pathFinder.ts             — utilidad pura de BFS camino más corto
src/components/ArchitecturalLayersView.tsx — componente SVG+D3-zoom
```

### Archivos existentes modificados

```
src/components/GraphViewToggle.tsx    — añadir 'architectural' al ViewType
src/hooks/useAppState.tsx             — ampliar graphViewType
src/components/GraphCanvas.tsx        — montar la vista + controles toolbar
src/lib/agent-context/builders.ts    — consumir layerDetection + diffImpact
```

**Principio clave:** las tres utilidades son funciones puras sin imports de React, importables desde AgentMode sin arrastrar código de UI.

---

## Renderer

SVG renderizado con React para los carriles. D3 (`d3-zoom`) únicamente para zoom/pan. Las posiciones de nodos se calculan en `useMemo` con lógica determinista (sin simulación de física). No usar Canvas ni D3 para el layout.

---

## 1. `layerDetection.ts`

### Tipos

```ts
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
```

### API

```ts
export function detectLayer(node: GraphNode): LayerName
export function groupNodesByLayer(nodes: GraphNode[]): Map<LayerName, GraphNode[]>
export function computeLayerStats(
  nodes: GraphNode[],
  relationships: GraphRelationship[]
): LayerStats[]
```

### Heurística de detección (en orden de prioridad)

1. **Match de `filePath`** contra patrones de carpeta:
   - `api`: `/api/`, `/routes/`, `/controllers/`, `/endpoints/`
   - `service`: `/services/`, `/handlers/`, `/middleware/`, `/usecases/`
   - `data`: `/models/`, `/db/`, `/database/`, `/schema/`, `/migrations/`, `/repositories/`
   - `ui`: `/components/`, `/views/`, `/pages/`, `/screens/`, `/layouts/`
   - `utility`: `/utils/`, `/helpers/`, `/lib/`, `/shared/`, `/common/`
   - `config`: `/config/`, `/constants/`, `/env/`, `/settings/`
   - `test`: `/test/`, `/tests/`, `/__tests__/`, `/spec/`, `/e2e/`
2. **Fallback por `label`** si no hay match de ruta:
   - `Route` → `api`
   - `Class | Function | Method` sin match → `unknown`

---

## 2. `diffImpact.ts`

### Tipos

```ts
export interface ImpactResult {
  direct: Set<string>           // rojo   — nodos seleccionados
  hop1: Set<string>             // naranja — importan directamente los seleccionados
  transitive: Set<string>       // amarillo — 2+ hops
  byLayer: Map<LayerName, number> // para el blast radius panel
}
```

### API

```ts
export function computeImpact(
  selectedIds: Set<string>,
  relationships: GraphRelationship[],
  maxDepth?: number  // default: 3
): ImpactResult
```

### Comportamiento

BFS inverso sobre relaciones de tipo `IMPORTS | CALLS | USES`. Propaga desde `selectedIds` hacia los nodos que dependen de ellos (dirección inversa: quién los importa). El nivel BFS determina el color: nivel 0 = direct, nivel 1 = hop1, nivel ≥ 2 = transitive.

---

## 3. `pathFinder.ts`

### API

```ts
export function findShortestPath(
  fromId: string,
  toId: string,
  relationships: GraphRelationship[]
): string[] | null  // array de nodeIds en orden (A → ... → B), null si no hay camino
```

BFS sobre todas las relaciones del grafo sin distinción de tipo.

---

## 4. `ArchitecturalLayersView.tsx`

### Props

```ts
interface Props {
  graph: KnowledgeGraph;
  onNodeClick: (node: GraphNode) => void;
  isActive?: boolean;
}
```

### Layout (useMemo)

- Un carril por cada capa que tenga al menos 1 nodo
- Orden de carriles de izquierda a derecha: ui → api → service → data → utility → config → test → unknown
- Dentro de cada carril: nodos ordenados por fan-in descendente
- Ancho de carril fijo (180px) con padding interno
- Altura de nodo: círculo de radio 8, separación vertical de 40px

### SVG + D3-zoom

```
<div overflow-hidden>
  <svg ref={svgRef}> ← d3-zoom aplicado aquí
    <g ref={gRef}>   ← transform actualizado por zoom
      <g>aristas</g>
      <g>carriles + nodos</g>
    </g>
  </svg>
  <div panel lateral 250px derecha />
</div>
```

### Estilos de aristas

| Tipo | Color | Grosor | Dash |
|---|---|---|---|
| Intra-layer | `rgba(255,255,255,0.12)` | 1 | ninguno |
| Cross-layer descendente | `#6366f1` (índigo) | 1.5 | ninguno |
| Cross-layer ascendente (smell) | `#f97316` (naranja) | 2 | `4,3` |

"Ascendente" = la arista va desde una capa de abstracción más baja hacia una más alta en el orden: data → service → api → ui (ej. Data → UI). El orden de prioridad para detectar smells: ui(0) > api(1) > service(2) > data(3) > utility(4) > config(5).

Las aristas se renderizan como paths SVG con curvas cúbicas Bézier.

### Colores de impacto (Diff Mode)

| Estado | Color | Opacidad |
|---|---|---|
| Seleccionado (direct) | `#ef4444` | 1 |
| 1-hop | `#f97316` | 1 |
| Transitivo | `#eab308` | 1 |
| No impactado | gris | 0.15 |

### Interacciones

- **Click en nodo**: marca como seleccionado para diff
- **Shift+click en segundo nodo**: activa Path Finder BFS (nodo A → nodo B)
- **Click en fondo SVG**: deselecciona todo
- **Botón "Diff Mode"** (en toolbar de GraphCanvas): activa/desactiva propagación de impacto

### Estado local del componente

```ts
const [selectedForDiff, setSelectedForDiff] = useState<Set<string>>(new Set())
const [diffModeActive, setDiffModeActive] = useState(false)
const [pathFrom, setPathFrom] = useState<string | null>(null)
const [pathTo, setPathTo] = useState<string | null>(null)
const [impactResult, setImpactResult] = useState<ImpactResult | null>(null)
const [pathResult, setPathResult] = useState<string[] | null>(null)
```

### Panel lateral (250px fijo, derecha)

Tres secciones:

1. **"Layers"** (siempre visible): tabla con columnas Capa / Nodos / Fan-in / Fan-out / Cross-deps
2. **"Impact"** (solo si `diffModeActive`): blast radius por capa desde `ImpactResult.byLayer`
3. **"Path"** (solo si `pathResult !== null`): lista ordenada de nodeIds del camino A→B

### Handle expuesto (para controles de GraphCanvas)

```ts
export interface ArchitecturalLayersViewHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  setDiffModeActive: (active: boolean) => void
}
```

---

## 5. Integración en `GraphViewToggle.tsx`

- Añadir `'architectural'` al tipo `ViewType`
- Nuevo `ViewOption`: icono `Network`, label `"Arch. Layers"`, title `"Vista de capas arquitectónicas"`
- Añadir `architectural: true` en `ACTIVATED_VIEWS`

---

## 6. Integración en `useAppState.tsx`

- Ampliar el tipo de `graphViewType` añadiendo `| 'architectural'`

---

## 7. Integración en `GraphCanvas.tsx`

### Estado nuevo

```ts
const [hasArchitecturalBeenActivated, setHasArchitecturalBeenActivated] = useState(false)
const [isDiffModeActive, setIsDiffModeActive] = useState(false)
const architecturalRef = useRef<ArchitecturalLayersViewHandle>(null)
```

### Toolbar (visible solo cuando `graphViewType === 'architectural'`)

```tsx
{graph && graphViewType === 'architectural' && (
  <div className={`absolute top-12 z-20 ...`}>
    <button onClick={() => {
      const next = !isDiffModeActive;
      setIsDiffModeActive(next);
      architecturalRef.current?.setDiffModeActive(next);
    }}>
      <GitFork className="size-3" />
      {isDiffModeActive ? 'Diff On' : 'Diff Off'}
    </button>
  </div>
)}
```

### Montaje del componente

```tsx
{hasArchitecturalBeenActivated && graph && (
  <div className={`absolute inset-0 z-10 overflow-hidden${
    graphViewType !== 'architectural' ? ' invisible pointer-events-none' : ''
  }`}>
    <ArchitecturalLayersView
      ref={architecturalRef}
      graph={graph}
      isActive={graphViewType === 'architectural'}
      onNodeClick={(node) => { setSelectedNode(node); openCodePanel(); }}
    />
  </div>
)}
```

En `onViewActivated`: añadir `else if (view === 'architectural') setHasArchitecturalBeenActivated(true)`.

---

## 8. Integración en `builders.ts`

### Sección `## Architecture` en CLAUDE.md

Se añade **después de `## Module Map`** (antes de `## Key Symbols`) y **sólo si** `computeLayerStats()` detecta al menos 2 capas con nodos.

Formato:

```md
## Architecture
- **API** (12 nodes): cross-deps 3 — critical: `src/routes/index.ts` (fan-in 8)
- **Service** (8 nodes): cross-deps 5 — critical: `src/services/auth.ts` (fan-in 12)
- **Data** (6 nodes): cross-deps 1 — critical: `src/models/User.ts` (fan-in 6)
- **UI** (15 nodes): cross-deps 2 — critical: `src/components/App.tsx` (fan-in 10)

Top cross-layer deps (by volume):
- service → data (8 edges)
- api → service (6 edges)
- ui → service (4 edges)

Code smells (upward deps):
- data → ui: `src/models/User.ts` → `src/components/UserCard.tsx`
```

El "critical file" por capa es el nodo con mayor fan-in dentro de esa capa, calculado con el `degreeMap` ya existente en `buildBase()`.

Los "code smells" son relaciones donde `detectLayer(source)` tiene índice de capa mayor que `detectLayer(target)` en el orden: ui > api > service > data > utility > config.

### Extensión en `buildAgentsMd()`

Para cada tool detectado, si `detectLayer()` puede clasificar su `filePath`, añadir al final de la línea:
```
; layers: service, api
```

---

## Criterios de éxito

1. `layerDetection.ts`, `diffImpact.ts` y `pathFinder.ts` son utilidades puras sin imports de React, testables de forma aislada.
2. La vista se integra en el toggle de vistas existente siguiendo el patrón de las demás.
3. El export de CLAUDE.md incluye la sección `## Architecture` cuando hay capas detectadas.
4. No se introducen nuevas dependencias de IA ni llamadas a APIs externas.
5. D3 se usa únicamente para zoom/pan (`d3-zoom`), nunca para layout.

---

## Exclusiones explícitas

- No copiar código del repositorio Understand-Anything (sólo inspiración conceptual).
- No introducir dependencias npm nuevas (D3 ya está disponible).
- No crear archivos de documentación adicionales más allá de este spec.
- No reorganizar la estructura de archivos existente.
