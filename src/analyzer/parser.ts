import path from 'path'

export interface ParsedImports {
  relative: string[]
  external: string[]
}

const JS_TS_IMPORT = /(?:^|[\n;])\s*import\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm
const JS_TS_REEXPORT = /(?:^|[\n;])\s*export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/gm
const JS_REQUIRE = /(?:^|[\n;])\s*(?:const|let|var)\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm

const PY_FROM_RELATIVE = /^[ \t]*from\s+(\.+\w*)\s+import/gm
const PY_FROM_ABSOLUTE = /^[ \t]*from\s+(\w[\w.]*)\s+import/gm
const PY_IMPORT = /^[ \t]*import\s+([\w.]+)/gm

const PHP_REQUIRE = /(?:require|require_once|include|include_once)\s*['"(]\s*([^'")\s]+)/gm
const PHP_USE = /^[ \t]*use\s+([\w\\]+)/gm

function extractMatches(pattern: RegExp, content: string): string[] {
  pattern.lastIndex = 0
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(content)) !== null) {
    if (m[1]) results.push(m[1])
  }
  return results
}

export function parseImports(content: string, language: string): ParsedImports {
  const relative: string[] = []
  const external: string[] = []

  if (language === 'typescript' || language === 'javascript') {
    const all = [
      ...extractMatches(JS_TS_IMPORT, content),
      ...extractMatches(JS_TS_REEXPORT, content),
      ...extractMatches(JS_REQUIRE, content),
    ]
    for (const imp of all) {
      if (imp.startsWith('.')) {
        relative.push(imp)
      } else {
        const pkg = imp.startsWith('@')
          ? imp.split('/').slice(0, 2).join('/')
          : imp.split('/')[0]
        if (pkg) external.push(pkg)
      }
    }
  } else if (language === 'python') {
    relative.push(...extractMatches(PY_FROM_RELATIVE, content))
    external.push(
      ...extractMatches(PY_FROM_ABSOLUTE, content),
      ...extractMatches(PY_IMPORT, content),
    )
  } else if (language === 'php') {
    relative.push(...extractMatches(PHP_REQUIRE, content))
    external.push(...extractMatches(PHP_USE, content))
  }

  return {
    relative: [...new Set(relative)],
    external: [...new Set(external)],
  }
}

export function resolveRelativePath(importPath: string, fromFile: string): string | null {
  if (!importPath.startsWith('.')) return null
  return path.resolve(path.dirname(fromFile), importPath)
}
