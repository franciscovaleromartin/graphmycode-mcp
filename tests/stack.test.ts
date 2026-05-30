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
