# Code Flow View — Design Spec
**Date:** 2026-04-29  
**Project:** GraphMyCode  
**Status:** Approved

---

## Objetivo

Añadir una quinta vista llamada **Code Flow** que muestra el flujo de ejecución interno de un archivo seleccionado como flowchart interactivo, renderizado con Mermaid.js en el browser sin servicios externos.

---

## Enfoque elegido

**Enfoque B — `CodeFlowView.tsx` autónomo con `react-zoom-pan-pinch`.**

- Componente independiente, sin acoplamiento con `MermaidDiagram.tsx` (diseñado para el chat) ni `ProcessFlowModal.tsx` (modal overlay).
- Sigue el patrón de montaje/visibilidad de las vistas existentes (`hasCityBeenActivated`, `invisible pointer-events-none`).
- Reutiliza `parser-loader.ts` y el patrón de queries de `tree-sitter-queries.ts`.

---

## Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/components/CodeFlowView.tsx` | Vista principal: estados, renderizado Mermaid, pan/zoom, exportar SVG |
| `src/lib/codeflow/astToMermaid.ts` | Orquestador: detecta lenguaje, llama al parser, convierte a string Mermaid |
| `src/lib/codeflow/parsers/js-ts.ts` | Extractor para JS/TS/JSX/TSX |
| `src/lib/codeflow/parsers/python.ts` | Extractor para Python |
| `src/lib/codeflow/parsers/markup.ts` | Extractor para HTML, CSS, JSON, YAML |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/hooks/useAppState.tsx` | Añadir `'codeflow'` al union type `graphViewType` |
| `src/components/GraphCanvas.tsx` | Botón en toolbar, estado `hasCodeFlowBeenActivated`, montaje de `<CodeFlowView>`, zoom controls |
| `src/lib/lucide-icons.tsx` | Añadir `Share2` (no está en el archivo actualmente) |

**Sin modificar:** `SidePanel.tsx`, `MermaidDiagram.tsx`, `parser-loader.ts`, `tree-sitter-queries.ts`.

---

## Flujo de datos

```
selectedNode (label === 'File')
  → leer contenido con readFile(filePath) de 'services/backend-client'
    (mismo patrón que CodeReferencesPanel.tsx)
  → astToMermaid(filePath, content)
      → detectar lenguaje por extensión
      → loadParser() + loadLanguage()  [parser-loader.ts existente]
      → parser correspondiente → { nodes: FlowNode[], edges: FlowEdge[] }
      → serializar a string "flowchart TD …"
  → mermaid.render(id, mermaidString) → SVG string
  → DOMPurify.sanitize(svg)
  → TransformWrapper > TransformComponent > div[dangerouslySetInnerHTML]
```

---

## Estados de `CodeFlowView`

| Estado | Causa | UI |
|---|---|---|
| `idle` | Ningún nodo de tipo File seleccionado | Empty state centrado: *"Selecciona un archivo en el grafo para ver su flujo"* |
| `parsing` | tree-sitter procesando | Spinner con texto *"Analizando…"* |
| `unsupported` | Extensión no soportada | Mensaje: *"Code Flow no está disponible para archivos .ext"* |
| `error` | Fallo de parse o render Mermaid | Mensaje de error con detalle colapsable |
| `ready` | SVG generado | Diagrama con pan/zoom y botón exportar |

---

## Lenguajes soportados y qué extrae cada parser

### JS / TS / JSX / TSX
Extensiones: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`

| Elemento AST | Representación Mermaid |
|---|---|
| `function_declaration`, `arrow_function`, `method_definition` | Nodo rectangular `fn_N["nombre"]` |
| `call_expression` entre funciones internas | Arista `fn_a --> fn_b` |
| `if_statement` / `else` | Nodo rombo `{condición?}` con ramas `\|true\|` / `\|false\|` |
| `for_statement`, `while_statement`, `for_of/in` | Nodo rombo con prefijo `🔁` |
| `try_statement` / `catch_clause` | Nodo con prefijo `⚠️` y arista a catch |

### Python
Extensiones: `.py`

Equivalentes: `def`/`async def` → funciones; `if`/`elif`/`else` → decisiones; `for`/`while` → loops; `try`/`except` → errores.

### HTML
Extensiones: `.html`, `.htm`

Árbol de elementos anidados hasta profundidad 5. Scripts y links externos como nodos `((tipo))`.

### CSS
Extensiones: `.css`, `.scss`, `.less`

Selectores como nodos rectangulares. Sin aristas (inventario de reglas).

### JSON / YAML
Extensiones: `.json`, `.yaml`, `.yml`

Árbol de claves anidadas hasta profundidad 3. Valores primitivos omitidos (solo estructura).

### No soportados
Todos los demás: mostrar mensaje de no-soporte, sin error.

---

## Formato Mermaid generado

```
flowchart TD
  classDef fn fill:#1e293b,stroke:#22d3ee,stroke-width:2px,color:#f1f5f9
  classDef decision fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#f1f5f9
  classDef loop fill:#1e293b,stroke:#8b5cf6,stroke-width:2px,color:#f1f5f9
  classDef error fill:#1e293b,stroke:#f43f5e,stroke-width:2px,color:#f1f5f9

  fn_0["fetchData"]:::fn
  dec_0{"has result?"}:::decision
  fn_1["processResult"]:::fn
  fn_2["handleError"]:::error

  fn_0 --> dec_0
  dec_0 -->|true| fn_1
  dec_0 -->|false| fn_2
```

---

## Umbral de archivos grandes

Si el AST tiene **>500 nodos**, el parser solo extrae funciones top-level (sin descender a bloques internos `if`/`for`/`try`).  
`CodeFlowView` muestra un banner amarillo: *"Archivo grande: mostrando solo funciones principales"*.

---

## Integración en `GraphCanvas.tsx`

### Botón en toolbar (junto a los 4 existentes)
```tsx
<button
  onClick={() => { setGraphViewType('codeflow'); setHasCodeFlowBeenActivated(true); }}
  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
    graphViewType === 'codeflow'
      ? 'bg-elevated text-text-primary'
      : 'text-text-muted hover:bg-hover hover:text-text-secondary'
  }`}
  title="Flujo de ejecución del archivo seleccionado"
>
  <Share2 className="h-3 w-3" />
  Code Flow
</button>
```

### Montaje de la vista
```tsx
{hasCodeFlowBeenActivated && (
  <div className={`absolute inset-0 z-10 overflow-hidden${graphViewType !== 'codeflow' ? ' invisible pointer-events-none' : ''}`}>
    <CodeFlowView />
  </div>
)}
```

### Zoom controls
Los botones Zoom In / Zoom Out / Fit to Screen invocan `codeFlowRef.current?.zoomIn()` etc. cuando `graphViewType === 'codeflow'`, con el mismo patrón condicional que las otras vistas.

---

## Estilo visual

- **Fondo:** `bg-void` (mismo que el canvas principal)
- **Mermaid:** `theme: 'base'` con `themeVariables` oscuros (idénticos a `MermaidDiagram.tsx`)
- **Pan/zoom:** `react-zoom-pan-pinch` (`TransformWrapper` + `TransformComponent`)
- **Botón exportar SVG:** esquina superior derecha, mismo estilo que controles existentes (`border border-border-subtle bg-elevated text-text-secondary`)

---

## Gestión de memoria y rendimiento

- `useCallback` y `useMemo` en `CodeFlowView` para no re-parsear si `selectedNode` y su contenido no cambian
- Mermaid se importa con `import mermaid from 'mermaid'` (ya cargado en el bundle, no necesita lazy import adicional porque ya se usa en `MermaidDiagram.tsx`)
- El parser tree-sitter usa el `languageCache` del `parser-loader.ts` existente — si la gramática ya está cargada, no se vuelve a fetchar el WASM

---

## Tipos internos de `astToMermaid.ts`

```ts
interface FlowNode {
  id: string;
  label: string;
  kind: 'fn' | 'decision' | 'loop' | 'error';
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  truncated?: boolean; // true si se aplicó el umbral de 500 nodos
}
```

---

## Manejo de errores

- **Parser no disponible (WASM no cargado):** capturar con `try/catch`, mostrar estado `error`
- **Mermaid render falla:** capturar con `try/catch`, mostrar el string Mermaid en `<pre>` colapsable para debugging
- **Archivo no accesible (`readFile` falla):** estado `error` con mensaje descriptivo
- **Nodo seleccionado no es File:** estado `idle` (no es error, es el estado normal)
