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
