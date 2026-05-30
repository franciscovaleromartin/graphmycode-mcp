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
