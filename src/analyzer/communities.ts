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
