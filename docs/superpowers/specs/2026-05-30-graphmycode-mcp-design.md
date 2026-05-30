# Design: graphmycode-mcp

**Date:** 2026-05-30  
**Status:** Approved  
**Target path:** `/Users/franciscovalero/Desktop/proyectos/graphmycode-mcp`

---

## Propósito

MCP server Node.js + TypeScript que replica la lógica de análisis de GraphMyCode (sin la parte visual) para responder preguntas sobre estructura, dependencias y stack de codebases locales. Se integra en Claude Code como servidor MCP local vía stdio.

---

## Arquitectura

```
graphmycode-mcp/
├── src/
│   ├── index.ts               # Entry point: crea McpServer, registra tools, arranca stdio
│   ├── analyzer/
│   │   ├── parser.ts          # Parse imports/exports por lenguaje (regex)
│   │   ├── graph.ts           # Construcción del grafo en memoria
│   │   ├── stack.ts           # Detección de stack desde manifests + extensiones
│   │   ├── communities.ts     # Agrupación por directorio + refinamiento por edges
│   │   └── agent.ts           # Generación de CLAUDE.md / AGENTS.md
│   └── tools/
│       └── index.ts           # Definición de los 7 tools MCP
├── package.json
└── tsconfig.json
```

### Principios de diseño

- **Sin estado entre llamadas**: cada tool analiza desde cero, construye el grafo en memoria y lo descarta.
- **Sin WASM**: el graphmycode original usa tree-sitter (WASM) y Leiden (WASM). El MCP usa regex para parsing e heurísticas de directorio para comunidades.
- **Transporte stdio**: compatible con `claude.json` como `"type": "stdio"`.
- **ESM puro**: `"type": "module"` en package.json, `"module": "ES2022"` en tsconfig.

---

## Parser de imports (`analyzer/parser.ts`)

Regex por lenguaje para extraer dependencias entre archivos.

### JS / TS
```
import X from './foo'
import { X } from '../bar'
import * as X from './baz'
export { X } from './qux'
const X = require('./foo')
```

### Python
```
import foo
from foo.bar import baz
from . import foo
from .. import bar
```

### PHP
```
require 'foo.php'
require_once 'bar.php'
include 'baz.php'
use Foo\Bar\Baz
```

**Resolución de paths**: para imports relativos se resuelve a ruta absoluta. Para imports de paquetes externos se marca como dependencia externa (no se añade edge al grafo interno).

**Extensiones aceptadas**: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.php`

**Directorios ignorados**: `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `vendor`, `.venv`, `venv`, `out`, `coverage`, `.next`, `.nuxt`

---

## Grafo en memoria (`analyzer/graph.ts`)

```ts
interface FileNode {
  id: string          // ruta relativa al path analizado
  path: string        // ruta absoluta
  language: string    // 'typescript' | 'javascript' | 'python' | 'php'
  imports: string[]   // ids de archivos que importa (internos)
  importedBy: string[]// ids de archivos que lo importan
  externalDeps: string[] // paquetes externos
}

interface DependencyGraph {
  nodes: Map<string, FileNode>
  edges: Array<{ from: string; to: string }>
}
```

Métricas derivadas del grafo:
- **fanIn**: nº de importadores (importedBy.length)
- **fanOut**: nº de imports internos (imports.length)
- **hotspots**: archivos con fanIn > umbral (p. ej. >5)
- **dead code**: archivos con fanIn === 0 que no son entry points

---

## Detección de stack (`analyzer/stack.ts`)

Orden de detección:
1. Leer `package.json` → `dependencies` + `devDependencies`
2. Leer `requirements.txt` / `pyproject.toml` / `setup.py`
3. Leer `Cargo.toml`, `go.mod`, `composer.json`
4. Contar extensiones de archivos del grafo

**Clasificación de tipo de proyecto:**
- `frontend`: React, Vue, Svelte, Angular, Astro, etc.
- `backend`: Express, FastAPI, Django, Flask, NestJS, etc.
- `fullstack`: combinación de frontend + backend
- `agent`: presencia de `anthropic`, `openai`, `langchain`, `@anthropic-ai/sdk`
- `library`: sin framework de app detectado, con tests

**Gestor de paquetes:** detectado por lock files (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `package-lock.json`)

---

## Comunidades (`analyzer/communities.ts`)

Algoritmo en dos pasos:

**Paso 1 — Agrupación por directorio**: cada archivo pertenece a la comunidad de su directorio padre. Directorios con un solo archivo se fusionan con el padre.

**Paso 2 — Refinamiento por densidad de edges**: si dos grupos tienen muchas edges entre sí y pocas hacia fuera, se fusionan. Umbral: ratio de edges internas / edges totales > 0.6.

Output: `Map<communityId, { label: string; files: string[] }>`

El `label` de la comunidad es el nombre del directorio más representativo.

---

## Detección de entry points (`analyzer/graph.ts` o herramienta `find_entry_points`)

Heurísticas por orden de prioridad:
1. **Nombre de archivo**: `main`, `index`, `app`, `server`, `cli`, `entry`, `bootstrap`
2. **Patrón de path**: `/pages/`, `/routes/`, `/controllers/`, `/app/`, `page.tsx`, `route.ts`
3. **fanIn === 0**: nadie lo importa → posible raíz
4. **Scripts de package.json**: `main`, `bin`, `exports`

---

## Generación de contexto de agente (`analyzer/agent.ts`)

Replica la estructura de `src/lib/agent-context/` del proyecto graphmycode original.

### CLAUDE.md

```markdown
# CLAUDE.md

## Purpose
<propósito inferido del proyecto>

## Stack
- Language: <primario>
- Frameworks: <lista>
- Package manager: <npm|pnpm|yarn|pip|cargo>
- Type: <frontend|backend|fullstack|agent|library>

## Commands
- Install: <comando>
- Dev: <comando>
- Build: <comando>
- Test: <comando>

## Module Map
<comunidades con archivos clave>

## Key Symbols
<clases/funciones principales inferidas de nombres de archivo>

## Critical Edges
<dependencias más importantes entre módulos>
```

### AGENTS.md

Misma información pero con sección adicional de herramientas disponibles (si detecta MCP servers en `.claude/` o similar).

---

## Los 7 tools MCP

### `analyze_structure`
- **Input**: `{ path: string }`
- **Output**: `{ nodes: FileNode[], edges: Edge[], metrics: { fileCount, edgeCount, hotspots, deadCode, avgFanIn, avgFanOut } }`

### `detect_stack`
- **Input**: `{ path: string }`
- **Output**: `{ languages: string[], frameworks: string[], projectType: string, packageManager: string, runtimes: string[] }`

### `get_file_dependencies`
- **Input**: `{ path: string, file: string }`
- **Output**: `{ file: string, imports: string[], importedBy: string[], externalDeps: string[] }`

### `get_communities`
- **Input**: `{ path: string }`
- **Output**: `{ communities: Array<{ id, label, files: string[], size: number }> }`

### `find_entry_points`
- **Input**: `{ path: string }`
- **Output**: `{ entryPoints: Array<{ file: string, reason: string, confidence: 'high'|'medium'|'low' }> }`

### `query_graph`
- **Input**: `{ path: string, question: string }`
- **Output**: `{ answer: string, evidence: Array<{ file: string, metric: string, value: any }> }`
- Soporta preguntas como:
  - "¿quién importa X?"
  - "¿qué archivos tienen más dependencias?"
  - "¿qué módulo es más central?"
  - "¿hay ciclos de importación?"
  - "¿qué archivos son código muerto?"

### `export_agent_context`
- **Input**: `{ path: string, format: "CLAUDE.md" | "AGENTS.md" | "both" }`
- **Output**: `{ files: Array<{ name: string, content: string }> }`

---

## Configuración MCP en `~/.claude/claude.json`

```json
{
  "mcpServers": {
    "graphmycode": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/franciscovalero/Desktop/proyectos/graphmycode-mcp/dist/index.js"]
    }
  }
}
```

---

## Slash commands globales

7 archivos en `~/.claude/commands/graphmycode-*.md`:

| Comando | Tool(s) usadas | Propósito |
|---|---|---|
| `/graphmycode-analyze` | `analyze_structure` | Hotspots, código muerto, acoplamiento |
| `/graphmycode-structural` | `analyze_structure`, `get_file_dependencies` | Dependencias bidireccionales |
| `/graphmycode-semantic` | `query_graph`, `get_communities` | Duplicación lógica |
| `/graphmycode-debt` | `analyze_structure`, `get_communities`, `get_file_dependencies` | Technical debt priorizado |
| `/graphmycode-heatmap` | `analyze_structure`, `query_graph` | Ciclos y dependencias circulares |
| `/graphmycode-flow` | `find_entry_points`, `get_file_dependencies` | Flujo de ejecución |
| `/graphmycode-layers` | `detect_stack`, `get_communities`, `analyze_structure` | Capas arquitectónicas |

---

## Decisiones técnicas

| Decisión | Elección | Alternativa descartada | Motivo |
|---|---|---|---|
| Parser | Regex por lenguaje | tree-sitter WASM | WASM no portable en stdio server |
| Comunidades | Directorio + densidad edges | Leiden WASM | Igual que parser |
| Estado | Sin caché | Caché en memoria | Spec explícito del usuario |
| Transporte | stdio | HTTP/SSE | Claude Code requiere stdio local |
| Runtime | Node.js ESM | Bun | Compatibilidad máxima |
