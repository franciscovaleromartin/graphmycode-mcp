# graphmycode-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un MCP server Node.js + TypeScript que analiza codebases locales y responde preguntas sobre estructura, dependencias y stack via 7 herramientas MCP.

**Architecture:** Servidor stdio MCP sin estado donde cada tool call construye un grafo de dependencias en memoria desde cero usando regex, lo usa, y lo descarta. Cubre análisis estructural, detección de stack, comunidades, entry points, consultas en lenguaje natural y generación de contexto para agentes.

**Tech Stack:** Node.js ESM, TypeScript 5.7, @modelcontextprotocol/sdk, zod, vitest

---

## File Map

```
graphmycode-mcp/
├── src/
│   ├── index.ts                    # Entry point: crea McpServer, registra tools, arranca stdio
│   ├── analyzer/
│   │   ├── parser.ts               # Regex import parsing para TS/JS/Python/PHP
│   │   ├── graph.ts                # File walker, construcción del grafo, métricas, entry points
│   │   ├── stack.ts                # Detección de stack desde manifests + extensiones
│   │   ├── communities.ts          # Comunidades por directorio + refinamiento por densidad
│   │   └── agent.ts                # Generación de CLAUDE.md y AGENTS.md
│   └── tools/
│       └── index.ts                # Los 7 tools MCP con schemas zod
├── tests/
│   ├── fixtures/
│   │   ├── ts-project/             # Fixture TypeScript pequeño para tests de integración
│   │   │   ├── src/
│   │   │   │   ├── index.ts        # importa utils y api/client
│   │   │   │   ├── utils.ts        # no importa nada
│   │   │   │   └── api/
│   │   │   │       └── client.ts   # importa utils
│   │   │   └── package.json
│   │   └── py-project/             # Fixture Python pequeño
│   │       ├── main.py             # from utils import helper
│   │       └── utils.py            # sin imports
│   ├── parser.test.ts
│   ├── graph.test.ts
│   ├── stack.test.ts
│   ├── communities.test.ts
│   └── agent.test.ts
├── package.json
└── tsconfig.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `tests/fixtures/ts-project/`
- Create: `tests/fixtures/py-project/`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "graphmycode-mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run --reporter=verbose"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
*.js.map
.DS_Store
```

- [ ] **Step 4: Instalar dependencias**

```bash
cd /Users/franciscovalero/Desktop/proyectos/graphmycode-mcp
npm install
```

Expected: `node_modules/` creado, sin errores.

- [ ] **Step 5: Crear fixtures de tests**

```bash
mkdir -p tests/fixtures/ts-project/src/api
mkdir -p tests/fixtures/py-project
```

`tests/fixtures/ts-project/package.json`:
```json
{ "name": "ts-fixture", "type": "module" }
```

`tests/fixtures/ts-project/src/index.ts`:
```typescript
import { helper } from './utils.js'
import { apiClient } from './api/client.js'
export { helper, apiClient }
```

`tests/fixtures/ts-project/src/utils.ts`:
```typescript
export function helper(x: string): string {
  return x.toUpperCase()
}
```

`tests/fixtures/ts-project/src/api/client.ts`:
```typescript
import { helper } from '../utils.js'
export const apiClient = { call: (s: string) => helper(s) }
```

`tests/fixtures/py-project/main.py`:
```python
from utils import helper
import os
result = helper("hello")
```

`tests/fixtures/py-project/utils.py`:
```python
def helper(x):
    return x.upper()
```

- [ ] **Step 6: Inicializar git y commitear scaffold**

```bash
git init
git add package.json tsconfig.json .gitignore tests/
git commit -m "feat: scaffold proyecto graphmycode-mcp"
```

---

### Task 2: Parser (`src/analyzer/parser.ts`)

**Files:**
- Create: `src/analyzer/parser.ts`
- Create: `tests/parser.test.ts`

- [ ] **Step 1: Crear test**

`tests/parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseImports, resolveRelativePath } from '../src/analyzer/parser.js'

describe('parseImports - TypeScript', () => {
  it('parses named import', () => {
    const r = parseImports("import { foo } from './bar'", 'typescript')
    expect(r.relative).toContain('./bar')
    expect(r.external).toHaveLength(0)
  })

  it('parses default import', () => {
    const r = parseImports("import foo from './utils'", 'typescript')
    expect(r.relative).toContain('./utils')
  })

  it('parses star import', () => {
    const r = parseImports("import * as all from '../lib'", 'typescript')
    expect(r.relative).toContain('../lib')
  })

  it('parses re-export', () => {
    const r = parseImports("export { x } from './types'", 'typescript')
    expect(r.relative).toContain('./types')
  })

  it('parses require', () => {
    const r = parseImports("const x = require('./config')", 'javascript')
    expect(r.relative).toContain('./config')
  })

  it('marks npm packages as external', () => {
    const r = parseImports("import React from 'react'", 'typescript')
    expect(r.external).toContain('react')
    expect(r.relative).toHaveLength(0)
  })

  it('handles scoped packages', () => {
    const r = parseImports("import { z } from '@anthropic-ai/sdk'", 'typescript')
    expect(r.external).toContain('@anthropic-ai/sdk')
  })
})

describe('parseImports - Python', () => {
  it('parses from-import as external', () => {
    const r = parseImports("from utils import helper", 'python')
    expect(r.external).toContain('utils')
  })

  it('parses relative dot import', () => {
    const r = parseImports("from . import foo", 'python')
    expect(r.relative).toContain('.')
  })

  it('parses relative parent import', () => {
    const r = parseImports("from .. import bar", 'python')
    expect(r.relative).toContain('..')
  })

  it('parses bare import', () => {
    const r = parseImports("import os", 'python')
    expect(r.external).toContain('os')
  })
})

describe('parseImports - PHP', () => {
  it('parses require', () => {
    const r = parseImports("require 'foo.php'", 'php')
    expect(r.relative).toContain('foo.php')
  })

  it('parses require_once', () => {
    const r = parseImports("require_once 'bar.php'", 'php')
    expect(r.relative).toContain('bar.php')
  })

  it('parses use statement as external', () => {
    const r = parseImports("use Foo\\Bar\\Baz", 'php')
    expect(r.external).toContain('Foo\\Bar\\Baz')
  })
})

describe('resolveRelativePath', () => {
  it('resolves sibling file', () => {
    const r = resolveRelativePath('./utils', '/project/src/index.ts')
    expect(r).toBe('/project/src/utils')
  })

  it('resolves parent directory', () => {
    const r = resolveRelativePath('../lib', '/project/src/api/client.ts')
    expect(r).toBe('/project/src/lib')
  })

  it('returns null for external packages', () => {
    const r = resolveRelativePath('react', '/project/src/index.ts')
    expect(r).toBeNull()
  })
})
```

- [ ] **Step 2: Verificar que falla**

```bash
npx vitest run tests/parser.test.ts 2>&1 | head -20
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Crear `src/analyzer/parser.ts`**

```typescript
import path from 'path'

export interface ParsedImports {
  relative: string[]
  external: string[]
}

const JS_TS_IMPORT = /(?:^|[\n;])\s*import\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm
const JS_TS_REEXPORT = /(?:^|[\n;])\s*export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/gm
const JS_REQUIRE = /(?:^|[\n;])\s*(?:const|let|var)\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm

const PY_FROM_RELATIVE = /^[ \t]*from\s+(\.+\w*)\s+import/gm
const PY_FROM_ABSOLUTE = /^[ \t]*from\s+(\w[\w.]*)\s+import/gm
const PY_IMPORT = /^[ \t]*import\s+([\w.]+)/gm

const PHP_REQUIRE = /(?:require|require_once|include|include_once)\s*['"(]\s*([^'")\s]+)/gm
const PHP_USE = /^[ \t]*use\s+([\w\\]+)/gm

function extractMatches(pattern: RegExp, content: string): string[] {
  pattern.lastIndex = 0
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(content)) !== null) {
    if (m[1]) results.push(m[1])
  }
  return results
}

export function parseImports(content: string, language: string): ParsedImports {
  const relative: string[] = []
  const external: string[] = []

  if (language === 'typescript' || language === 'javascript') {
    const all = [
      ...extractMatches(JS_TS_IMPORT, content),
      ...extractMatches(JS_TS_REEXPORT, content),
      ...extractMatches(JS_REQUIRE, content),
    ]
    for (const imp of all) {
      if (imp.startsWith('.')) {
        relative.push(imp)
      } else {
        const pkg = imp.startsWith('@')
          ? imp.split('/').slice(0, 2).join('/')
          : imp.split('/')[0]
        if (pkg) external.push(pkg)
      }
    }
  } else if (language === 'python') {
    relative.push(...extractMatches(PY_FROM_RELATIVE, content))
    external.push(
      ...extractMatches(PY_FROM_ABSOLUTE, content),
      ...extractMatches(PY_IMPORT, content),
    )
  } else if (language === 'php') {
    relative.push(...extractMatches(PHP_REQUIRE, content))
    external.push(...extractMatches(PHP_USE, content))
  }

  return {
    relative: [...new Set(relative)],
    external: [...new Set(external)],
  }
}

export function resolveRelativePath(importPath: string, fromFile: string): string | null {
  if (!importPath.startsWith('.')) return null
  return path.resolve(path.dirname(fromFile), importPath)
}
```

- [ ] **Step 4: Verificar que pasan**

```bash
npx vitest run tests/parser.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyzer/parser.ts tests/parser.test.ts
git commit -m "feat: parser de imports regex para TS/JS/Python/PHP"
```

---

### Task 3: Graph Builder (`src/analyzer/graph.ts`)

**Files:**
- Create: `src/analyzer/graph.ts`
- Create: `tests/graph.test.ts`

- [ ] **Step 1: Crear test**

`tests/graph.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import path from 'path'
import { buildGraph, computeMetrics, detectEntryPoints } from '../src/analyzer/graph.js'

const TS = path.resolve('tests/fixtures/ts-project')
const PY = path.resolve('tests/fixtures/py-project')

describe('buildGraph - TypeScript fixture', () => {
  it('finds 3 source files', async () => {
    const g = await buildGraph(TS)
    expect(g.nodes.size).toBe(3)
  })

  it('creates edges', async () => {
    const g = await buildGraph(TS)
    expect(g.edges.length).toBeGreaterThan(0)
  })

  it('index.ts imports 2 files', async () => {
    const g = await buildGraph(TS)
    const node = [...g.nodes.values()].find(n => n.id === 'src/index.ts')
    expect(node).toBeDefined()
    expect(node!.imports.length).toBe(2)
  })

  it('utils.ts has fanIn 2 (index + client)', async () => {
    const g = await buildGraph(TS)
    const node = [...g.nodes.values()].find(n => n.id === 'src/utils.ts')
    expect(node!.importedBy.length).toBe(2)
  })
})

describe('buildGraph - Python fixture', () => {
  it('finds main.py and utils.py', async () => {
    const g = await buildGraph(PY)
    expect(g.nodes.size).toBe(2)
  })
})

describe('computeMetrics', () => {
  it('returns all metric fields', async () => {
    const g = await buildGraph(TS)
    const m = computeMetrics(g)
    expect(m.fileCount).toBe(3)
    expect(m.edgeCount).toBeGreaterThan(0)
    expect(Array.isArray(m.hotspots)).toBe(true)
    expect(Array.isArray(m.deadCode)).toBe(true)
    expect(typeof m.avgFanIn).toBe('number')
    expect(typeof m.avgFanOut).toBe('number')
  })

  it('detects utils.ts as hotspot with low threshold', async () => {
    const g = await buildGraph(TS)
    const m = computeMetrics(g, { hotspotThreshold: 1 })
    expect(m.hotspots.map(h => h.file)).toContain('src/utils.ts')
  })
})

describe('detectEntryPoints', () => {
  it('detects index.ts as entry point', async () => {
    const g = await buildGraph(TS)
    const entries = detectEntryPoints(g, TS)
    expect(entries.some(e => e.file.endsWith('index.ts'))).toBe(true)
  })
})
```

- [ ] **Step 2: Verificar que falla**

```bash
npx vitest run tests/graph.test.ts 2>&1 | head -20
```

Expected: FAIL.

- [ ] **Step 3: Crear `src/analyzer/graph.ts`**

```typescript
import fs from 'fs/promises'
import path from 'path'
import { parseImports, resolveRelativePath } from './parser.js'

export interface FileNode {
  id: string
  path: string
  language: string
  imports: string[]
  importedBy: string[]
  externalDeps: string[]
}

export interface DependencyGraph {
  nodes: Map<string, FileNode>
  edges: Array<{ from: string; to: string }>
}

export interface GraphMetrics {
  fileCount: number
  edgeCount: number
  hotspots: Array<{ file: string; fanIn: number }>
  deadCode: string[]
  avgFanIn: number
  avgFanOut: number
}

export interface EntryPoint {
  file: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  'vendor', '.venv', 'venv', 'out', 'coverage', '.next', '.nuxt',
])

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python',
  '.php': 'php',
}

const ENTRY_NAMES = new Set(['main', 'index', 'app', 'server', 'cli', 'entry', 'bootstrap'])
const ENTRY_PATH_PATTERNS = ['/pages/', '/routes/', '/controllers/', '/app/']
const TRY_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.php']
const TRY_INDEX_SUFFIXES = [
  '/index.ts', '/index.js', '/index.tsx', '/index.jsx', '/__init__.py',
]

async function collectFiles(rootPath: string): Promise<string[]> {
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) await walk(full)
        } else if (entry.isFile() && LANG_MAP[path.extname(entry.name)]) {
          results.push(full)
        }
      }
    } catch {
      // skip unreadable directories
    }
  }

  await walk(rootPath)
  return results
}

function resolveToNode(rawId: string, nodes: Map<string, FileNode>): FileNode | undefined {
  if (nodes.has(rawId)) return nodes.get(rawId)
  for (const ext of TRY_EXTENSIONS) {
    const candidate = rawId + ext
    if (nodes.has(candidate)) return nodes.get(candidate)
  }
  for (const suffix of TRY_INDEX_SUFFIXES) {
    const candidate = rawId + suffix
    if (nodes.has(candidate)) return nodes.get(candidate)
  }
  return undefined
}

export async function buildGraph(rootPath: string): Promise<DependencyGraph> {
  const absRoot = path.resolve(rootPath)
  const files = await collectFiles(absRoot)
  const nodes = new Map<string, FileNode>()

  for (const filePath of files) {
    const id = path.relative(absRoot, filePath)
    nodes.set(id, {
      id,
      path: filePath,
      language: LANG_MAP[path.extname(filePath)]!,
      imports: [],
      importedBy: [],
      externalDeps: [],
    })
  }

  const edges: Array<{ from: string; to: string }> = []

  for (const [id, node] of nodes) {
    let content: string
    try {
      content = await fs.readFile(node.path, 'utf-8')
    } catch {
      continue
    }

    const { relative, external } = parseImports(content, node.language)
    node.externalDeps = external

    for (const rel of relative) {
      const resolved = resolveRelativePath(rel, node.path)
      if (!resolved) continue
      const rawId = path.relative(absRoot, resolved)
      const target = resolveToNode(rawId, nodes)
      if (target) {
        node.imports.push(target.id)
        target.importedBy.push(id)
        edges.push({ from: id, to: target.id })
      }
    }
  }

  return { nodes, edges }
}

export function computeMetrics(
  graph: DependencyGraph,
  options: { hotspotThreshold?: number } = {}
): GraphMetrics {
  const threshold = options.hotspotThreshold ?? 5
  const nodeList = [...graph.nodes.values()]
  const fileCount = nodeList.length
  const edgeCount = graph.edges.length

  const hotspots = nodeList
    .filter(n => n.importedBy.length > threshold)
    .map(n => ({ file: n.id, fanIn: n.importedBy.length }))
    .sort((a, b) => b.fanIn - a.fanIn)

  const deadCode = nodeList
    .filter(n => n.importedBy.length === 0)
    .map(n => n.id)

  const avgFanIn = fileCount > 0
    ? nodeList.reduce((s, n) => s + n.importedBy.length, 0) / fileCount : 0
  const avgFanOut = fileCount > 0
    ? nodeList.reduce((s, n) => s + n.imports.length, 0) / fileCount : 0

  return { fileCount, edgeCount, hotspots, deadCode, avgFanIn, avgFanOut }
}

export function detectEntryPoints(graph: DependencyGraph, rootPath: string): EntryPoint[] {
  const entries: EntryPoint[] = []
  const seen = new Set<string>()

  for (const node of graph.nodes.values()) {
    const base = path.basename(node.id, path.extname(node.id)).toLowerCase()
    if (ENTRY_NAMES.has(base)) {
      entries.push({ file: node.id, reason: `filename: ${base}`, confidence: 'high' })
      seen.add(node.id)
    }
  }

  for (const node of graph.nodes.values()) {
    if (seen.has(node.id)) continue
    if (ENTRY_PATH_PATTERNS.some(p => node.path.includes(p))) {
      entries.push({ file: node.id, reason: 'path matches routing pattern', confidence: 'medium' })
      seen.add(node.id)
    }
  }

  for (const node of graph.nodes.values()) {
    if (!seen.has(node.id) && node.importedBy.length === 0) {
      entries.push({ file: node.id, reason: 'fanIn=0, no other file imports it', confidence: 'low' })
      seen.add(node.id)
    }
  }

  return entries
}
```

- [ ] **Step 4: Verificar que pasan**

```bash
npx vitest run tests/graph.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyzer/graph.ts tests/graph.test.ts
git commit -m "feat: graph builder con métricas y detección de entry points"
```

---

### Task 4: Stack Detector (`src/analyzer/stack.ts`)

**Files:**
- Create: `src/analyzer/stack.ts`
- Create: `tests/stack.test.ts`

- [ ] **Step 1: Crear test**

`tests/stack.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import path from 'path'
import { detectStack } from '../src/analyzer/stack.js'

const TS = path.resolve('tests/fixtures/ts-project')
const PY = path.resolve('tests/fixtures/py-project')

describe('detectStack', () => {
  it('detecta typescript para ts-project', async () => {
    const s = await detectStack(TS)
    expect(s.languages).toContain('typescript')
  })

  it('detecta python para py-project', async () => {
    const s = await detectStack(PY)
    expect(s.languages).toContain('python')
  })

  it('devuelve projectType válido', async () => {
    const s = await detectStack(TS)
    expect(['frontend','backend','fullstack','agent','library']).toContain(s.projectType)
  })

  it('devuelve packageManager string', async () => {
    const s = await detectStack(TS)
    expect(typeof s.packageManager).toBe('string')
  })
})
```

- [ ] **Step 2: Verificar que falla**

```bash
npx vitest run tests/stack.test.ts 2>&1 | head -20
```

Expected: FAIL.

- [ ] **Step 3: Crear `src/analyzer/stack.ts`**

```typescript
import fs from 'fs/promises'
import path from 'path'

export interface StackInfo {
  languages: string[]
  frameworks: string[]
  projectType: 'frontend' | 'backend' | 'fullstack' | 'agent' | 'library'
  packageManager: string
  runtimes: string[]
}

const FRONTEND = new Set(['react','vue','svelte','@angular/core','astro','next','nuxt','preact','solid-js'])
const BACKEND = new Set(['express','fastify','koa','hapi','@nestjs/core','nestjs','django','flask','fastapi','aiohttp','tornado'])
const AGENT = new Set(['anthropic','@anthropic-ai/sdk','openai','langchain','@langchain/core','llamaindex','groq'])
const IGNORED = new Set(['node_modules','.git','dist','build','__pycache__','vendor'])

async function tryReadJson(p: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await fs.readFile(p, 'utf-8')) as Record<string, unknown> }
  catch { return null }
}

async function tryReadText(p: string): Promise<string | null> {
  try { return await fs.readFile(p, 'utf-8') }
  catch { return null }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true }
  catch { return false }
}

async function countExts(rootPath: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  async function walk(dir: string) {
    try {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        if (e.isDirectory() && !IGNORED.has(e.name)) await walk(path.join(dir, e.name))
        else if (e.isFile()) {
          const ext = path.extname(e.name)
          counts.set(ext, (counts.get(ext) ?? 0) + 1)
        }
      }
    } catch { /* skip */ }
  }
  await walk(rootPath)
  return counts
}

export async function detectStack(rootPath: string): Promise<StackInfo> {
  const abs = path.resolve(rootPath)
  const allDeps: string[] = []
  const runtimes: string[] = []
  let packageManager = 'unknown'

  const pkg = await tryReadJson(path.join(abs, 'package.json'))
  if (pkg) {
    const d = pkg.dependencies as Record<string,string> | undefined
    const dd = pkg.devDependencies as Record<string,string> | undefined
    allDeps.push(...Object.keys(d ?? {}), ...Object.keys(dd ?? {}))
  }

  const req = await tryReadText(path.join(abs, 'requirements.txt'))
  if (req) {
    allDeps.push(...req.split('\n').map(l => l.split(/[>=<!]/)[0].trim().toLowerCase()).filter(Boolean))
  }

  if (await exists(path.join(abs, 'Cargo.toml'))) runtimes.push('rust')
  if (await exists(path.join(abs, 'go.mod'))) runtimes.push('go')
  if (await exists(path.join(abs, 'composer.json'))) runtimes.push('php')

  if (await exists(path.join(abs, 'pnpm-lock.yaml'))) packageManager = 'pnpm'
  else if (await exists(path.join(abs, 'bun.lock'))) packageManager = 'bun'
  else if (await exists(path.join(abs, 'yarn.lock'))) packageManager = 'yarn'
  else if (await exists(path.join(abs, 'package-lock.json'))) packageManager = 'npm'
  else if (pkg) packageManager = 'npm'

  const extCounts = await countExts(abs)
  const languages: string[] = []
  if ((extCounts.get('.ts') ?? 0) + (extCounts.get('.tsx') ?? 0) > 0) languages.push('typescript')
  if ((extCounts.get('.js') ?? 0) + (extCounts.get('.jsx') ?? 0) > 0) languages.push('javascript')
  if ((extCounts.get('.py') ?? 0) > 0) languages.push('python')
  if ((extCounts.get('.php') ?? 0) > 0) languages.push('php')
  if ((extCounts.get('.rs') ?? 0) > 0) languages.push('rust')
  if ((extCounts.get('.go') ?? 0) > 0) languages.push('go')

  const depsLow = allDeps.map(d => d.toLowerCase())
  const frameworks = [...new Set([
    ...depsLow.filter(d => FRONTEND.has(d)),
    ...depsLow.filter(d => BACKEND.has(d)),
    ...depsLow.filter(d => AGENT.has(d)),
  ])]

  const isFrontend = depsLow.some(d => FRONTEND.has(d))
  const isBackend = depsLow.some(d => BACKEND.has(d))
  const isAgent = depsLow.some(d => AGENT.has(d))

  let projectType: StackInfo['projectType'] = 'library'
  if (isAgent) projectType = 'agent'
  else if (isFrontend && isBackend) projectType = 'fullstack'
  else if (isFrontend) projectType = 'frontend'
  else if (isBackend) projectType = 'backend'

  return { languages, frameworks, projectType, packageManager, runtimes }
}
```

- [ ] **Step 4: Verificar que pasan**

```bash
npx vitest run tests/stack.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyzer/stack.ts tests/stack.test.ts
git commit -m "feat: detección de stack desde manifests y extensiones"
```

---

### Task 5: Communities (`src/analyzer/communities.ts`)

**Files:**
- Create: `src/analyzer/communities.ts`
- Create: `tests/communities.test.ts`

- [ ] **Step 1: Crear test**

`tests/communities.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import path from 'path'
import { buildCommunities } from '../src/analyzer/communities.js'
import { buildGraph } from '../src/analyzer/graph.js'

const TS = path.resolve('tests/fixtures/ts-project')

describe('buildCommunities', () => {
  it('devuelve al menos una comunidad', async () => {
    const g = await buildGraph(TS)
    const c = buildCommunities(g)
    expect(c.size).toBeGreaterThan(0)
  })

  it('cada archivo aparece exactamente en una comunidad', async () => {
    const g = await buildGraph(TS)
    const c = buildCommunities(g)
    const all: string[] = []
    for (const comm of c.values()) all.push(...comm.files)
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(g.nodes.size)
  })

  it('comunidades tienen label y size correcto', async () => {
    const g = await buildGraph(TS)
    const c = buildCommunities(g)
    for (const comm of c.values()) {
      expect(typeof comm.label).toBe('string')
      expect(comm.size).toBe(comm.files.length)
    }
  })
})
```

- [ ] **Step 2: Verificar que falla**

```bash
npx vitest run tests/communities.test.ts 2>&1 | head -20
```

Expected: FAIL.

- [ ] **Step 3: Crear `src/analyzer/communities.ts`**

```typescript
import path from 'path'
import type { DependencyGraph } from './graph.js'

export interface Community {
  id: string
  label: string
  files: string[]
  size: number
}

const DENSITY_THRESHOLD = 0.6

export function buildCommunities(graph: DependencyGraph): Map<string, Community> {
  // Paso 1: agrupar por directorio padre
  const dirGroups = new Map<string, Set<string>>()
  for (const node of graph.nodes.values()) {
    const dir = path.dirname(node.id)
    const key = dir === '.' ? '(root)' : dir
    const s = dirGroups.get(key) ?? new Set<string>()
    s.add(node.id)
    dirGroups.set(key, s)
  }

  // Fusionar directorios con un solo archivo con su padre
  const groups: Array<{ dir: string; files: Set<string> }> = []
  for (const [dir, files] of dirGroups) {
    if (files.size === 1 && dir !== '(root)') {
      const parent = path.dirname(dir)
      const parentKey = parent === '.' ? '(root)' : parent
      const existing = groups.find(g => g.dir === parentKey)
      if (existing) {
        for (const f of files) existing.files.add(f)
      } else {
        groups.push({ dir: parentKey, files: new Set(files) })
      }
    } else {
      const existing = groups.find(g => g.dir === dir)
      if (existing) {
        for (const f of files) existing.files.add(f)
      } else {
        groups.push({ dir, files: new Set(files) })
      }
    }
  }

  // Paso 2: refinamiento por densidad de edges
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]
        const b = groups[j]
        const merged = new Set([...a.files, ...b.files])

        let crossEdges = 0
        let externalEdges = 0
        for (const edge of graph.edges) {
          const fromMerged = merged.has(edge.from)
          const toMerged = merged.has(edge.to)
          if (fromMerged !== toMerged) externalEdges++
          if ((a.files.has(edge.from) && b.files.has(edge.to)) ||
              (b.files.has(edge.from) && a.files.has(edge.to))) crossEdges++
        }

        const total = crossEdges + externalEdges
        if (total > 0 && crossEdges / total > DENSITY_THRESHOLD) {
          for (const f of b.files) a.files.add(f)
          groups.splice(j, 1)
          changed = true
          break outer
        }
      }
    }
  }

  const result = new Map<string, Community>()
  groups.forEach(({ dir, files }, i) => {
    const id = `community-${i}`
    const label = dir === '(root)' ? 'root' : path.basename(dir)
    const fileList = [...files]
    result.set(id, { id, label, files: fileList, size: fileList.length })
  })
  return result
}
```

- [ ] **Step 4: Verificar que pasan**

```bash
npx vitest run tests/communities.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyzer/communities.ts tests/communities.test.ts
git commit -m "feat: comunidades por directorio con refinamiento por densidad de edges"
```

---

### Task 6: Agent Context Generator (`src/analyzer/agent.ts`)

**Files:**
- Create: `src/analyzer/agent.ts`
- Create: `tests/agent.test.ts`

- [ ] **Step 1: Crear test**

`tests/agent.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import path from 'path'
import { generateAgentContext } from '../src/analyzer/agent.js'
import { buildGraph } from '../src/analyzer/graph.js'
import { detectStack } from '../src/analyzer/stack.js'
import { buildCommunities } from '../src/analyzer/communities.js'

const TS = path.resolve('tests/fixtures/ts-project')

async function setup() {
  const graph = await buildGraph(TS)
  const stack = await detectStack(TS)
  const communities = buildCommunities(graph)
  return { graph, stack, communities }
}

describe('generateAgentContext', () => {
  it('genera CLAUDE.md con secciones obligatorias', async () => {
    const { graph, stack, communities } = await setup()
    const files = await generateAgentContext(TS, graph, stack, communities, 'CLAUDE.md')
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('CLAUDE.md')
    expect(files[0].content).toContain('## Stack')
    expect(files[0].content).toContain('## Module Map')
    expect(files[0].content).toContain('## Critical Edges')
  })

  it('genera AGENTS.md', async () => {
    const { graph, stack, communities } = await setup()
    const files = await generateAgentContext(TS, graph, stack, communities, 'AGENTS.md')
    expect(files[0].name).toBe('AGENTS.md')
    expect(files[0].content).toContain('## Available Tools')
  })

  it('genera ambos con format "both"', async () => {
    const { graph, stack, communities } = await setup()
    const files = await generateAgentContext(TS, graph, stack, communities, 'both')
    expect(files).toHaveLength(2)
    expect(files.map(f => f.name)).toContain('CLAUDE.md')
    expect(files.map(f => f.name)).toContain('AGENTS.md')
  })
})
```

- [ ] **Step 2: Verificar que falla**

```bash
npx vitest run tests/agent.test.ts 2>&1 | head -20
```

Expected: FAIL.

- [ ] **Step 3: Crear `src/analyzer/agent.ts`**

```typescript
import fs from 'fs/promises'
import path from 'path'
import type { DependencyGraph } from './graph.js'
import type { StackInfo } from './stack.js'
import type { Community } from './communities.js'

function inferCommands(stack: StackInfo): { install: string; dev: string; build: string; test: string } {
  const pm = stack.packageManager
  const run = pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : pm === 'bun' ? 'bun' : 'npm run'
  if (stack.languages.includes('python')) {
    return { install: 'pip install -r requirements.txt', dev: 'python main.py', build: '# N/A', test: 'pytest' }
  }
  if (stack.languages.includes('php')) {
    return { install: 'composer install', dev: 'php artisan serve', build: '# N/A', test: 'phpunit' }
  }
  return {
    install: pm === 'npm' ? 'npm install' : `${pm} install`,
    dev: `${run} dev`,
    build: `${run} build`,
    test: `${run} test`,
  }
}

function buildModuleMap(communities: Map<string, Community>): string {
  return [...communities.values()].map(c => {
    const files = c.files.slice(0, 3).map(f => `  - ${f}`).join('\n')
    const more = c.files.length > 3 ? `\n  - ...and ${c.files.length - 3} more` : ''
    return `- **${c.label}** (${c.size} files)\n${files}${more}`
  }).join('\n')
}

function buildCriticalEdges(graph: DependencyGraph): string {
  const top = [...graph.nodes.values()]
    .filter(n => n.importedBy.length > 0)
    .sort((a, b) => b.importedBy.length - a.importedBy.length)
    .slice(0, 5)
  return top.length > 0
    ? top.map(n => `- \`${n.id}\` importado por ${n.importedBy.length} archivo(s)`).join('\n')
    : '(none detected)'
}

function buildKeySymbols(graph: DependencyGraph): string {
  return [...graph.nodes.values()]
    .sort((a, b) => b.importedBy.length - a.importedBy.length)
    .slice(0, 8)
    .map(n => `- \`${path.basename(n.id, path.extname(n.id))}\` (${n.id})`)
    .join('\n') || '(none detected)'
}

async function detectMcpTools(rootPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(rootPath, '.claude'), { withFileTypes: true })
    return entries.map(e => e.name)
  } catch {
    return []
  }
}

function generateClaudeMdContent(
  rootPath: string,
  graph: DependencyGraph,
  stack: StackInfo,
  communities: Map<string, Community>
): string {
  const name = path.basename(rootPath)
  const cmds = inferCommands(stack)
  return `# CLAUDE.md

## Purpose
${name} — ${stack.projectType} project in ${stack.languages[0] ?? 'unknown'}${stack.frameworks.length ? ` using ${stack.frameworks.slice(0, 2).join(', ')}` : ''}

## Stack
- Language: ${stack.languages[0] ?? 'unknown'}
- Frameworks: ${stack.frameworks.join(', ') || 'none detected'}
- Package manager: ${stack.packageManager}
- Type: ${stack.projectType}

## Commands
- Install: \`${cmds.install}\`
- Dev: \`${cmds.dev}\`
- Build: \`${cmds.build}\`
- Test: \`${cmds.test}\`

## Module Map
${buildModuleMap(communities)}

## Key Symbols
${buildKeySymbols(graph)}

## Critical Edges
${buildCriticalEdges(graph)}
`
}

export async function generateAgentContext(
  rootPath: string,
  graph: DependencyGraph,
  stack: StackInfo,
  communities: Map<string, Community>,
  format: 'CLAUDE.md' | 'AGENTS.md' | 'both'
): Promise<Array<{ name: string; content: string }>> {
  const results: Array<{ name: string; content: string }> = []

  if (format === 'CLAUDE.md' || format === 'both') {
    results.push({ name: 'CLAUDE.md', content: generateClaudeMdContent(rootPath, graph, stack, communities) })
  }

  if (format === 'AGENTS.md' || format === 'both') {
    const base = generateClaudeMdContent(rootPath, graph, stack, communities)
    const tools = await detectMcpTools(rootPath)
    const toolsSection = tools.length > 0
      ? `\n## Available Tools\n${tools.map(t => `- ${t}`).join('\n')}\n`
      : '\n## Available Tools\n(none detected in .claude/)\n'
    results.push({ name: 'AGENTS.md', content: base.replace('# CLAUDE.md', '# AGENTS.md') + toolsSection })
  }

  return results
}
```

- [ ] **Step 4: Verificar que pasan**

```bash
npx vitest run tests/agent.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analyzer/agent.ts tests/agent.test.ts
git commit -m "feat: generador de CLAUDE.md y AGENTS.md"
```

---

### Task 7: MCP Tools (`src/tools/index.ts`)

**Files:**
- Create: `src/tools/index.ts`

- [ ] **Step 1: Crear `src/tools/index.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { buildGraph, computeMetrics, detectEntryPoints, type DependencyGraph } from '../analyzer/graph.js'
import { detectStack } from '../analyzer/stack.js'
import { buildCommunities } from '../analyzer/communities.js'
import { generateAgentContext } from '../analyzer/agent.js'

function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const stack = new Set<string>()
  const currentPath: string[] = []

  function dfs(id: string): void {
    if (stack.has(id)) {
      const start = currentPath.indexOf(id)
      cycles.push(currentPath.slice(start))
      return
    }
    if (visited.has(id)) return
    visited.add(id)
    stack.add(id)
    currentPath.push(id)
    for (const imp of (graph.nodes.get(id)?.imports ?? [])) dfs(imp)
    stack.delete(id)
    currentPath.pop()
  }

  for (const id of graph.nodes.keys()) {
    if (!visited.has(id)) dfs(id)
  }
  return cycles
}

export function registerTools(server: McpServer): void {
  server.tool(
    'analyze_structure',
    { path: z.string().describe('Absolute path to the codebase root') },
    async ({ path }) => {
      const graph = await buildGraph(path)
      const metrics = computeMetrics(graph)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            nodes: [...graph.nodes.values()].map(n => ({
              id: n.id, language: n.language,
              fanIn: n.importedBy.length, fanOut: n.imports.length,
              externalDeps: n.externalDeps,
            })),
            edges: graph.edges,
            metrics: {
              fileCount: metrics.fileCount,
              edgeCount: metrics.edgeCount,
              hotspots: metrics.hotspots,
              deadCode: metrics.deadCode,
              avgFanIn: Math.round(metrics.avgFanIn * 100) / 100,
              avgFanOut: Math.round(metrics.avgFanOut * 100) / 100,
            },
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'detect_stack',
    { path: z.string().describe('Absolute path to the codebase root') },
    async ({ path }) => {
      const stack = await detectStack(path)
      return { content: [{ type: 'text' as const, text: JSON.stringify(stack, null, 2) }] }
    }
  )

  server.tool(
    'get_file_dependencies',
    {
      path: z.string().describe('Absolute path to the codebase root'),
      file: z.string().describe('Relative file path within the codebase (e.g. src/utils.ts)'),
    },
    async ({ path, file }) => {
      const graph = await buildGraph(path)
      const node = graph.nodes.get(file)
      if (!node) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: `File not found: ${file}`, available: [...graph.nodes.keys()] }),
          }],
        }
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            file: node.id,
            imports: node.imports,
            importedBy: node.importedBy,
            externalDeps: node.externalDeps,
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'get_communities',
    { path: z.string().describe('Absolute path to the codebase root') },
    async ({ path }) => {
      const graph = await buildGraph(path)
      const communities = buildCommunities(graph)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ communities: [...communities.values()] }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'find_entry_points',
    { path: z.string().describe('Absolute path to the codebase root') },
    async ({ path }) => {
      const graph = await buildGraph(path)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ entryPoints: detectEntryPoints(graph, path) }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'query_graph',
    {
      path: z.string().describe('Absolute path to the codebase root'),
      question: z.string().describe('Natural language question about the codebase'),
    },
    async ({ path, question }) => {
      const graph = await buildGraph(path)
      const q = question.toLowerCase()
      let answer = ''
      const evidence: Array<{ file: string; metric: string; value: unknown }> = []

      const importerMatch = q.match(/(?:qui[eé]n importa|who imports?|importa)\s+['"]?([^\s'"?]+)['"]?/)
      if (importerMatch) {
        const target = importerMatch[1]
        const found = [...graph.nodes.entries()].find(([id]) => id.includes(target))
        if (found) {
          const [id, node] = found
          answer = `${node.importedBy.length} file(s) import \`${id}\`: ${node.importedBy.join(', ') || 'none'}`
          evidence.push({ file: id, metric: 'fanIn', value: node.importedBy.length })
        } else {
          answer = `No file matching "${target}" found.`
        }
      } else if (q.includes('ciclo') || q.includes('cycle') || q.includes('circular')) {
        const cycles = detectCycles(graph)
        answer = cycles.length === 0
          ? 'No circular import cycles detected.'
          : `Found ${cycles.length} cycle(s):\n${cycles.map(c => c.join(' → ')).join('\n')}`
        cycles.forEach(c => evidence.push({ file: c[0], metric: 'cycle', value: c }))
      } else if (q.includes('muerto') || q.includes('dead') || q.includes('unused')) {
        const m = computeMetrics(graph)
        answer = m.deadCode.length > 0
          ? `${m.deadCode.length} possibly unused file(s): ${m.deadCode.slice(0, 10).join(', ')}`
          : 'No dead code detected.'
        m.deadCode.forEach(f => evidence.push({ file: f, metric: 'fanIn', value: 0 }))
      } else if (q.includes('central') || q.includes('importado') || q.includes('fanin')) {
        const sorted = [...graph.nodes.values()].sort((a, b) => b.importedBy.length - a.importedBy.length).slice(0, 5)
        answer = 'Most central files:\n' + sorted.map(n => `${n.id}: fanIn=${n.importedBy.length}`).join('\n')
        sorted.forEach(n => evidence.push({ file: n.id, metric: 'fanIn', value: n.importedBy.length }))
      } else if (q.includes('dependencia') || q.includes('dependencies') || q.includes('fanout')) {
        const sorted = [...graph.nodes.values()].sort((a, b) => b.imports.length - a.imports.length).slice(0, 5)
        answer = 'Files with most dependencies:\n' + sorted.map(n => `${n.id}: fanOut=${n.imports.length}`).join('\n')
        sorted.forEach(n => evidence.push({ file: n.id, metric: 'fanOut', value: n.imports.length }))
      } else {
        const m = computeMetrics(graph)
        answer = `Graph: ${m.fileCount} files, ${m.edgeCount} edges, avgFanIn=${m.avgFanIn.toFixed(2)}, avgFanOut=${m.avgFanOut.toFixed(2)}`
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ answer, evidence }, null, 2) }] }
    }
  )

  server.tool(
    'export_agent_context',
    {
      path: z.string().describe('Absolute path to the codebase root'),
      format: z.enum(['CLAUDE.md', 'AGENTS.md', 'both']).describe('Output format'),
    },
    async ({ path, format }) => {
      const [graph, stack] = await Promise.all([buildGraph(path), detectStack(path)])
      const communities = buildCommunities(graph)
      const files = await generateAgentContext(path, graph, stack, communities, format)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ files }, null, 2) }] }
    }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat: 7 herramientas MCP con esquemas zod"
```

---

### Task 8: Entry Point + Build (`src/index.ts`)

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Crear `src/index.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools/index.js'

const server = new McpServer({
  name: 'graphmycode',
  version: '0.1.0',
})

registerTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
```

- [ ] **Step 2: Compilar**

```bash
npx tsc
```

Expected: `dist/` creado, sin errores TypeScript.

- [ ] **Step 3: Correr todos los tests**

```bash
npx vitest run
```

Expected: Todos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts dist/
git commit -m "feat: entry point MCP server stdio"
```

---

### Task 9: Slash Commands Globales

**Files:**
- Create: `~/.claude/commands/graphmycode-analyze.md`
- Create: `~/.claude/commands/graphmycode-structural.md`
- Create: `~/.claude/commands/graphmycode-semantic.md`
- Create: `~/.claude/commands/graphmycode-debt.md`
- Create: `~/.claude/commands/graphmycode-heatmap.md`
- Create: `~/.claude/commands/graphmycode-flow.md`
- Create: `~/.claude/commands/graphmycode-layers.md`

Nota: estos archivos van en `~/.claude/commands/` (fuera del repo), no se commitean.

- [ ] **Step 1: Crear directorio si no existe**

```bash
mkdir -p ~/.claude/commands
```

- [ ] **Step 2: Crear `~/.claude/commands/graphmycode-analyze.md`**

```markdown
Analyze the structure of the current codebase using graphmycode MCP.

Use the `analyze_structure` tool with `path` set to the current working directory.

Report:
1. **Hotspots** — files with highest fanIn, with count
2. **Dead code candidates** — files with fanIn=0 that are not entry points
3. **Coupling summary** — avgFanIn, avgFanOut, total edges
4. **Top recommendations** — refactoring priorities based on metrics
```

- [ ] **Step 3: Crear `~/.claude/commands/graphmycode-structural.md`**

```markdown
Perform structural dependency analysis of the current codebase.

1. Call `analyze_structure` with `path` = current working directory
2. For the top 3 files by fanIn, call `get_file_dependencies`

Report:
- **Most depended-on files** with full import/importedBy lists
- **Bidirectional dependencies** — files that import each other
- **Structural recommendations** — how to reduce coupling
```

- [ ] **Step 4: Crear `~/.claude/commands/graphmycode-semantic.md`**

```markdown
Analyze logical duplication and semantic clustering in the current codebase.

1. Call `get_communities` with `path` = current working directory
2. Call `query_graph` asking "what files have the most dependencies?"

Report:
- **Module communities** — each community with its files and inferred purpose
- **Potential duplication** — communities with similar names or overlapping deps
- **Semantic recommendations** — suggest consolidations or renames
```

- [ ] **Step 5: Crear `~/.claude/commands/graphmycode-debt.md`**

```markdown
Produce a prioritized technical debt report for the current codebase.

1. Call `analyze_structure` with `path` = current working directory
2. Call `get_communities` with `path` = current working directory
3. For each hotspot (top 5 by fanIn), call `get_file_dependencies`

Debt backlog:
- **P1 (Critical)** — files with fanIn > 10 or involved in cycles
- **P2 (High)** — files with fanIn 5-10 or communities > 20 files
- **P3 (Medium)** — dead code candidates, large unfocused communities
- Include T-shirt size estimates (S/M/L/XL) per item
```

- [ ] **Step 6: Crear `~/.claude/commands/graphmycode-heatmap.md`**

```markdown
Detect circular dependencies and dependency hotspots in the current codebase.

1. Call `analyze_structure` with `path` = current working directory
2. Call `query_graph` asking "¿hay ciclos de importación?"
3. Call `query_graph` asking "¿qué archivos tienen más dependencias?"

Report:
- **Circular imports** — each cycle with full file chain
- **Hotspot heatmap** — top 10 files by fanIn as ranked list
- **Risk assessment** — which cycles are most dangerous
- **Fix recommendations** — concrete steps to break each cycle
```

- [ ] **Step 7: Crear `~/.claude/commands/graphmycode-flow.md`**

```markdown
Trace execution flow from entry points through the current codebase.

1. Call `find_entry_points` with `path` = current working directory
2. For each high-confidence entry point, call `get_file_dependencies`

Report:
- **Entry points** — with confidence level and reason
- **Execution flow** — file chain from each entry point (one level deep)
- **Dead ends** — entry points that lead to dead code
- **Flow recommendations** — how to simplify the execution path
```

- [ ] **Step 8: Crear `~/.claude/commands/graphmycode-layers.md`**

```markdown
Analyze the architectural layers of the current codebase.

1. Call `detect_stack` with `path` = current working directory
2. Call `get_communities` with `path` = current working directory
3. Call `analyze_structure` with `path` = current working directory

Report:
- **Stack summary** — languages, frameworks, project type
- **Architectural layers** — map communities to layers (presentation/business/data/infrastructure)
- **Layer violations** — edges crossing architectural boundaries in the wrong direction
- **Architecture recommendations** — improvements to layering
```

---

### Task 10: MCP Config

- [ ] **Step 1: Verificar estado actual de `~/.claude/claude.json`**

```bash
cat ~/.claude/claude.json 2>/dev/null || echo "no existe"
```

- [ ] **Step 2: Añadir entrada graphmycode al objeto `mcpServers`**

Editar `~/.claude/claude.json` añadiendo (o fusionando si ya existe `mcpServers`):

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

- [ ] **Step 3: Reiniciar Claude Code**

MCP servers se cargan al arrancar. Reiniciar Claude Code para registrar el servidor.

- [ ] **Step 4: Verificar que el servidor responde**

Abrir una nueva sesión y ejecutar:
```
/graphmycode-analyze
```

Expected: El tool `analyze_structure` se invoca y devuelve métricas del codebase actual.

- [ ] **Step 5: Final commit del proyecto**

```bash
git add .
git commit -m "feat: graphmycode-mcp completo — 7 tools MCP + slash commands"
```

---

## Self-Review

### Spec Coverage

| Requisito spec | Task |
|---|---|
| Parser TS/JS/Python/PHP con regex | Task 2 |
| Directorios ignorados | Task 3 (`IGNORED_DIRS`) |
| `FileNode` + `DependencyGraph` en memoria | Task 3 |
| Métricas fanIn, fanOut, hotspots, dead code | Task 3 (`computeMetrics`) |
| Resolución de paths relativos | Task 2 (`resolveRelativePath`) |
| Extensiones aceptadas | Task 3 (`LANG_MAP`) |
| Detección de stack desde manifests | Task 4 |
| Tipo de proyecto frontend/backend/fullstack/agent/library | Task 4 |
| Gestor de paquetes por lock files | Task 4 |
| Comunidades paso 1: agrupación por directorio | Task 5 |
| Comunidades paso 2: refinamiento por densidad edges | Task 5 |
| Entry points heurísticos (nombre, path, fanIn=0, package.json) | Task 3 (`detectEntryPoints`) |
| CLAUDE.md con todas las secciones | Task 6 |
| AGENTS.md con sección `Available Tools` | Task 6 |
| `analyze_structure` tool | Task 7 |
| `detect_stack` tool | Task 7 |
| `get_file_dependencies` tool | Task 7 |
| `get_communities` tool | Task 7 |
| `find_entry_points` tool | Task 7 |
| `query_graph` con 5 patrones de pregunta | Task 7 |
| `export_agent_context` tool | Task 7 |
| Transporte stdio | Task 8 |
| ESM puro (`"type": "module"`) | Task 1 |
| Sin estado entre llamadas | Task 7 (cada tool hace `buildGraph` fresh) |
| Config MCP en `~/.claude/claude.json` | Task 10 |
| 7 slash commands globales | Task 9 |

Todos los requisitos de la spec están cubiertos.

### Verificación de tipos

- `DependencyGraph` definido en `graph.ts`, importado por `agent.ts`, `communities.ts`, `tools/index.ts` ✓
- `StackInfo` definido en `stack.ts`, importado por `agent.ts`, `tools/index.ts` ✓  
- `Community` definido en `communities.ts`, importado por `agent.ts`, `tools/index.ts` ✓
- `EntryPoint` definido y exportado desde `graph.ts`, usado en `tools/index.ts` ✓
- `FileNode` definido y exportado desde `graph.ts` ✓
