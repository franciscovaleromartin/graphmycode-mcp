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
const TEST_DIRS = ['tests/', 'test/', '__tests__/', 'spec/', 'specs/']
const TEST_SUFFIXES = ['.test.', '.spec.', '_test.', '_spec.']

function isDeadCodeCandidate(id: string): boolean {
  const normalized = id.replace(/\\/g, '/')
  if (TEST_DIRS.some(d => normalized.includes(d))) return false
  if (TEST_SUFFIXES.some(s => normalized.includes(s))) return false
  const base = path.basename(normalized, path.extname(normalized)).toLowerCase()
  if (ENTRY_NAMES.has(base)) return false
  return true
}
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
  // Try appending extensions directly
  for (const ext of TRY_EXTENSIONS) {
    const candidate = rawId + ext
    if (nodes.has(candidate)) return nodes.get(candidate)
  }
  // Strip existing extension and try other extensions (handles .js -> .ts substitution)
  const strippedExt = path.extname(rawId)
  if (strippedExt) {
    const withoutExt = rawId.slice(0, rawId.length - strippedExt.length)
    if (nodes.has(withoutExt)) return nodes.get(withoutExt)
    for (const ext of TRY_EXTENSIONS) {
      const candidate = withoutExt + ext
      if (nodes.has(candidate)) return nodes.get(candidate)
    }
    for (const suffix of TRY_INDEX_SUFFIXES) {
      const candidate = withoutExt + suffix
      if (nodes.has(candidate)) return nodes.get(candidate)
    }
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
    .filter(n => n.importedBy.length === 0 && isDeadCodeCandidate(n.id))
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
