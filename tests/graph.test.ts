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

  it('does not flag entry points or test files as dead code', async () => {
    const g = await buildGraph(TS)
    const m = computeMetrics(g)
    expect(m.deadCode).not.toContain('src/index.ts')
  })
})

describe('detectEntryPoints', () => {
  it('detects index.ts as entry point', async () => {
    const g = await buildGraph(TS)
    const entries = detectEntryPoints(g, TS)
    expect(entries.some(e => e.file.endsWith('index.ts'))).toBe(true)
  })
})
