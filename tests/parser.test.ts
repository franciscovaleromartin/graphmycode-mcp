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
