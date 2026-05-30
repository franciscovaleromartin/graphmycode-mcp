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
