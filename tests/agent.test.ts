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
