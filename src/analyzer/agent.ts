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

async function generateAgentsMdContent(
  rootPath: string,
  graph: DependencyGraph,
  stack: StackInfo,
  communities: Map<string, Community>
): Promise<string> {
  const base = generateClaudeMdContent(rootPath, graph, stack, communities)
  const tools = await detectMcpTools(rootPath)
  const toolsSection = tools.length > 0
    ? `\n## Available Tools\n${tools.map(t => `- ${t}`).join('\n')}\n`
    : '\n## Available Tools\n(none detected in .claude/)\n'
  return base.replace('# CLAUDE.md', '# AGENTS.md') + toolsSection
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
    results.push({ name: 'AGENTS.md', content: await generateAgentsMdContent(rootPath, graph, stack, communities) })
  }

  return results
}
