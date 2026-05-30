# Code Flow — Toggle Alto nivel / Bajo nivel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un toggle "Alto nivel / Bajo nivel" a la vista Code Flow que permita elegir entre la vista estructural actual y una vista detallada que recursiona dentro de los bloques de control.

**Architecture:** El estado `codeFlowDepth` vive en GraphCanvas como local state y se pasa como prop a CodeFlowView. CodeFlowView re-dispara el parseo al cambiar el prop. Los parsers reciben un flag `deep` que activa la recursión en bloques y el handling de switch/case y funciones anidadas.

**Tech Stack:** React 19, TypeScript, web-tree-sitter, Vitest

---

## Mapa de archivos

| Archivo | Cambio |
|---|---|
| `src/components/GraphCanvas.tsx` | Añadir estado `codeFlowDepth`, toggle flotante, `List` a imports, prop `depth` a `<CodeFlowView>` |
| `src/components/CodeFlowView.tsx` | Añadir prop `depth: 'high' \| 'low'`, useEffect para re-parsear al cambiar depth |
| `src/lib/codeflow/buildDagreGraph.ts` | Añadir parámetro `deep?: boolean`, pasarlo a parsers |
| `src/lib/codeflow/parsers/js.ts` | Añadir parámetro `deep`, recursión en bloques, switch/case, funciones anidadas |
| `src/lib/codeflow/parsers/python.ts` | Añadir parámetro `deep`, recursión en bloques |
| `test/unit/codeflow-parsers.test.ts` | Tests nuevos para los parsers en ambos modos |

---

## Task 1: Tests para los parsers (TDD)

**Files:**
- Create: `test/unit/codeflow-parsers.test.ts`

- [ ] **Step 1.1: Crear el archivo de tests con helper de mock nodes**

```typescript
// test/unit/codeflow-parsers.test.ts
import { describe, it, expect } from 'vitest';
import { parseJsTs } from '../../src/lib/codeflow/parsers/js';
import { parsePython } from '../../src/lib/codeflow/parsers/python';
import type { Node as TSNode, Tree } from 'web-tree-sitter';

type MockFields = Record<string, MockNode | null>;
interface MockNode {
  type: string;
  text: string;
  namedChildren: MockNode[];
  childForFieldName(name: string): MockNode | null;
}

function n(
  type: string,
  text = '',
  namedChildren: MockNode[] = [],
  fields: MockFields = {},
): MockNode {
  return {
    type,
    text,
    namedChildren,
    childForFieldName: (name: string) => fields[name] ?? null,
  };
}

function tree(rootChildren: MockNode[]): Tree {
  const root = n('program', '', rootChildren);
  return { rootNode: root } as unknown as Tree;
}
```

- [ ] **Step 1.2: Añadir tests de alto nivel para parseJsTs**

```typescript
describe('parseJsTs — alto nivel (deep=false)', () => {
  it('emite nodo START siempre', () => {
    const result = parseJsTs(tree([]), false);
    expect(result.nodes.some(nd => nd.type === 'start')).toBe(true);
  });

  it('detecta una function_declaration', () => {
    const body = n('statement_block', '{}');
    const fn = n('function_declaration', 'function foo() {}', [body], {
      name: n('identifier', 'foo'),
      body,
    });
    const result = parseJsTs(tree([fn]), false);
    expect(result.nodes.some(nd => nd.label === 'foo' && nd.type === 'function')).toBe(true);
  });

  it('detecta un if_statement dentro de una función', () => {
    const cond = n('parenthesized_expression', '(x > 0)');
    const ifNode = n('if_statement', 'if (x > 0) {}', [], {
      condition: cond,
      consequence: n('statement_block', '{}'),
    });
    const body = n('statement_block', '', [ifNode]);
    const fn = n('function_declaration', 'function foo() {}', [], {
      name: n('identifier', 'foo'),
      body,
    });
    const result = parseJsTs(tree([fn]), false);
    expect(result.nodes.some(nd => nd.type === 'decision')).toBe(true);
  });

  it('NO recursiona dentro del if en modo alto nivel', () => {
    const innerFor = n('for_statement', 'for(...) {}', [], {
      body: n('statement_block', '{}'),
    });
    const cond = n('parenthesized_expression', '(x)');
    const ifNode = n('if_statement', 'if (x) {}', [], {
      condition: cond,
      consequence: n('statement_block', '', [innerFor]),
    });
    const body = n('statement_block', '', [ifNode]);
    const fn = n('function_declaration', '', [], {
      name: n('identifier', 'outer'),
      body,
    });
    const result = parseJsTs(tree([fn]), false);
    // El for dentro del if NO debe aparecer en modo alto nivel
    expect(result.nodes.filter(nd => nd.type === 'loop')).toHaveLength(0);
  });
});
```

- [ ] **Step 1.3: Añadir tests de bajo nivel para parseJsTs**

```typescript
describe('parseJsTs — bajo nivel (deep=true)', () => {
  it('recursiona dentro del if y encuentra el for anidado', () => {
    const innerFor = n('for_statement', 'for(...) {}', [], {
      body: n('statement_block', '{}'),
    });
    const cond = n('parenthesized_expression', '(x)');
    const ifNode = n('if_statement', 'if (x) {}', [], {
      condition: cond,
      consequence: n('statement_block', '', [innerFor]),
    });
    const body = n('statement_block', '', [ifNode]);
    const fn = n('function_declaration', '', [], {
      name: n('identifier', 'outer'),
      body,
    });
    const result = parseJsTs(tree([fn]), true);
    expect(result.nodes.some(nd => nd.type === 'loop')).toBe(true);
  });

  it('recursiona dentro del for y encuentra el if anidado', () => {
    const cond = n('parenthesized_expression', '(y)');
    const innerIf = n('if_statement', 'if (y) {}', [], {
      condition: cond,
      consequence: n('statement_block', '{}'),
    });
    const forBody = n('statement_block', '', [innerIf]);
    const forNode = n('for_statement', 'for(...) {}', [], { body: forBody });
    const body = n('statement_block', '', [forNode]);
    const fn = n('function_declaration', '', [], {
      name: n('identifier', 'fn'),
      body,
    });
    const result = parseJsTs(tree([fn]), true);
    expect(result.nodes.some(nd => nd.type === 'decision')).toBe(true);
  });

  it('detecta switch_statement en bajo nivel', () => {
    const switchNode = n('switch_statement', 'switch(x) {}', [
      n('switch_body', '', [
        n('switch_case', 'case 1:', [], { value: n('number', '1') }),
      ]),
    ], { value: n('parenthesized_expression', '(x)') });
    const body = n('statement_block', '', [switchNode]);
    const fn = n('function_declaration', '', [], {
      name: n('identifier', 'fn'),
      body,
    });
    const result = parseJsTs(tree([fn]), true);
    expect(result.nodes.some(nd => nd.label.startsWith('switch'))).toBe(true);
  });
});
```

- [ ] **Step 1.4: Añadir tests para parsePython**

```typescript
describe('parsePython — bajo nivel (deep=true)', () => {
  it('recursiona dentro del if de Python', () => {
    const innerWhile = n('while_statement', 'while True:', [], {
      condition: n('true', 'True'),
      body: n('block', ''),
    });
    const ifBody = n('block', '', [innerWhile]);
    const ifNode = n('if_statement', 'if x:', [], {
      condition: n('identifier', 'x'),
      consequence: ifBody,
    });
    const fnBody = n('block', '', [ifNode]);
    const fn = n('function_definition', 'def foo():', [], {
      name: n('identifier', 'foo'),
      body: fnBody,
    });
    const result = parsePython(tree([fn]), true);
    expect(result.nodes.some(nd => nd.type === 'loop')).toBe(true);
  });
});
```

- [ ] **Step 1.5: Ejecutar los tests y verificar que FALLAN (la firma actual no acepta segundo argumento)**

```bash
cd /Users/franciscovalero/Desktop/proyectos/graphmycode
npm test -- --reporter=verbose test/unit/codeflow-parsers.test.ts
```
Expected: errores de TypeScript o test failures porque `parseJsTs` y `parsePython` aún no tienen el parámetro `deep`.

---

## Task 2: Extender parseJsTs con modo deep

**Files:**
- Modify: `src/lib/codeflow/parsers/js.ts`

- [ ] **Step 2.1: Añadir parámetro `deep` y propagar a las funciones internas**

Reemplazar la firma de `parseJsTs` y las funciones internas `walk`, `walkClassBody`, `walkBody`:

```typescript
export function parseJsTs(tree: Tree, deep = false): CodeFlowGraph {
  // ... mismas declaraciones iniciales
  function walk(node: TSNode, parentId: string) { ... }        // sin cambio
  function walkClassBody(node: TSNode, classId: string) { ... } // sin cambio
  function walkBody(node: TSNode, parentId: string) { ... }    // ver steps siguientes
```

- [ ] **Step 2.2: Añadir recursión en `if_statement` dentro de `walkBody`**

En el case `'if_statement'` de `walkBody`, añadir después de crear el nodo:

```typescript
case 'if_statement': {
  const cond = child.childForFieldName('condition')?.text ?? 'condition';
  const label = cond.length > 28 ? cond.slice(0, 27) + '…' : cond;
  const id = uid('if');
  nodes.push({ id, label, type: 'decision' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const consequence = child.childForFieldName('consequence');
    if (consequence?.type === 'statement_block') walkBody(consequence, id);
    const alt = child.childForFieldName('alternative');
    if (alt) {
      if (alt.type === 'statement_block') {
        walkBody(alt, id);
      } else if (alt.type === 'if_statement') {
        walkBody({ namedChildren: [alt] } as unknown as TSNode, id);
      }
    }
  }
  break;
}
```

- [ ] **Step 2.3: Añadir recursión en los bucles dentro de `walkBody`**

Reemplazar los cuatro cases de bucles con versiones que recursan si `deep`:

```typescript
case 'for_statement': {
  const id = uid('loop');
  nodes.push({ id, label: 'for (...)', type: 'loop' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
  }
  break;
}
case 'for_in_statement': {
  const id = uid('loop');
  nodes.push({ id, label: 'for...in', type: 'loop' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
  }
  break;
}
case 'for_of_statement': {
  const id = uid('loop');
  nodes.push({ id, label: 'for...of', type: 'loop' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
  }
  break;
}
case 'while_statement': {
  const cond = child.childForFieldName('condition')?.text ?? '';
  const label = cond.length > 20 ? 'while (…)' : `while ${cond}`;
  const id = uid('loop');
  nodes.push({ id, label, type: 'loop' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
  }
  break;
}
case 'do_statement': {
  const id = uid('loop');
  nodes.push({ id, label: 'do...while', type: 'loop' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
  }
  break;
}
```

- [ ] **Step 2.4: Añadir recursión en `try_statement` y nuevo `switch_statement` en `walkBody`**

En el case `'try_statement'`:

```typescript
case 'try_statement': {
  const id = uid('try');
  nodes.push({ id, label: 'try / catch', type: 'error' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
    const handler = child.childForFieldName('handler');
    if (handler) {
      const catchBody = handler.childForFieldName('body');
      if (catchBody) walkBody(catchBody, id);
    }
  }
  break;
}
```

Añadir NUEVO case para `switch_statement` (solo en modo deep):

```typescript
case 'switch_statement': {
  if (!deep) break;
  const val = child.childForFieldName('value')?.text ?? 'expr';
  const raw = val.replace(/^\(|\)$/g, ''); // quitar paréntesis externos
  const label = 'switch ' + (raw.length > 18 ? raw.slice(0, 17) + '…' : raw);
  const id = uid('sw');
  nodes.push({ id, label, type: 'decision' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  const switchBody = child.namedChildren.find((c: TSNode) => c.type === 'switch_body');
  if (switchBody) {
    for (const caseNode of switchBody.namedChildren) {
      if (caseNode.type === 'switch_case') {
        const caseVal = caseNode.childForFieldName('value')?.text ?? '';
        const caseLabel = 'case ' + (caseVal.length > 16 ? caseVal.slice(0, 15) + '…' : caseVal);
        const caseId = uid('case');
        nodes.push({ id: caseId, label: caseLabel, type: 'decision' });
        edges.push({ id: uid('e'), source: id, target: caseId });
        walkBody(caseNode, caseId);
      } else if (caseNode.type === 'switch_default') {
        const defaultId = uid('default');
        nodes.push({ id: defaultId, label: 'default', type: 'decision' });
        edges.push({ id: uid('e'), source: id, target: defaultId });
        walkBody(caseNode, defaultId);
      }
    }
  }
  break;
}
```

Añadir NUEVO case para funciones anidadas en bodies (solo en modo deep):

```typescript
case 'function_declaration': {
  if (!deep) break;
  const name = child.childForFieldName('name')?.text ?? `fn${counter}`;
  const id = uid('fn');
  fnNameToId.set(name, id);
  nodes.push({ id, label: name, type: 'function' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  const body = child.childForFieldName('body');
  if (body) walkBody(body, id);
  break;
}
```

- [ ] **Step 2.5: Ejecutar los tests y verificar que pasan**

```bash
npm test -- --reporter=verbose test/unit/codeflow-parsers.test.ts
```
Expected: todos los tests de `parseJsTs` en verde. Los de Python aún pueden fallar.

---

## Task 3: Extender parsePython con modo deep

**Files:**
- Modify: `src/lib/codeflow/parsers/python.ts`

- [ ] **Step 3.1: Añadir parámetro `deep` a `parsePython`**

Cambiar la firma:

```typescript
export function parsePython(tree: Tree, deep = false): CodeFlowGraph {
```

- [ ] **Step 3.2: Añadir recursión en `if_statement`, `for_statement`, `while_statement`**

En el case `'if_statement'` de `walkBody`, añadir después de crear el nodo:

```typescript
case 'if_statement': {
  const cond = child.childForFieldName('condition')?.text ?? 'condition';
  const label = cond.length > 28 ? cond.slice(0, 27) + '…' : cond;
  const id = uid('if');
  nodes.push({ id, label, type: 'decision' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const consequence = child.childForFieldName('consequence');
    if (consequence) walkBody(consequence, id);
    // elif / else como hijos directos
    for (const sibling of child.namedChildren) {
      if (sibling.type === 'elif_clause') {
        const elifCond = sibling.childForFieldName('condition')?.text ?? 'elif';
        const elifLabel = 'elif ' + (elifCond.length > 22 ? elifCond.slice(0, 21) + '…' : elifCond);
        const elifId = uid('elif');
        nodes.push({ id: elifId, label: elifLabel, type: 'decision' });
        edges.push({ id: uid('e'), source: id, target: elifId });
        const elifBody = sibling.childForFieldName('consequence') ?? sibling.namedChildren.find(c => c.type === 'block');
        if (elifBody) walkBody(elifBody, elifId);
      } else if (sibling.type === 'else_clause') {
        const elseBody = sibling.namedChildren.find(c => c.type === 'block');
        if (elseBody) walkBody(elseBody, id);
      }
    }
  }
  break;
}
```

```typescript
case 'for_statement': {
  const left = child.childForFieldName('left')?.text ?? '';
  const right = child.childForFieldName('right')?.text ?? '';
  const raw = `${left} in ${right}`;
  const label = 'for ' + (raw.length > 22 ? raw.slice(0, 21) + '…' : raw);
  const id = uid('loop');
  nodes.push({ id, label, type: 'loop' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
  }
  break;
}
```

```typescript
case 'while_statement': {
  const cond = child.childForFieldName('condition')?.text ?? '';
  const label = cond.length > 22 ? 'while (…)' : `while ${cond}`;
  const id = uid('loop');
  nodes.push({ id, label, type: 'loop' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
  }
  break;
}
```

- [ ] **Step 3.3: Añadir recursión en `try_statement` y funciones anidadas**

```typescript
case 'try_statement': {
  const id = uid('try');
  nodes.push({ id, label: 'try / except', type: 'error' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  if (deep) {
    const body = child.childForFieldName('body');
    if (body) walkBody(body, id);
    for (const sibling of child.namedChildren) {
      if (sibling.type === 'except_clause') {
        const exceptBody = sibling.namedChildren.find(c => c.type === 'block');
        if (exceptBody) walkBody(exceptBody, id);
      }
    }
  }
  break;
}
```

Añadir NUEVO case para funciones anidadas en bodies (solo deep):

```typescript
case 'function_definition': {
  if (!deep) break;
  const name = child.childForFieldName('name')?.text ?? `fn${counter}`;
  const id = uid('fn');
  fnNameToId.set(name, id);
  nodes.push({ id, label: name, type: 'function' });
  edges.push({ id: uid('e'), source: parentId, target: id });
  const body = child.childForFieldName('body');
  if (body) walkBody(body, id);
  break;
}
```

- [ ] **Step 3.4: Ejecutar todos los tests y verificar que pasan**

```bash
npm test -- --reporter=verbose test/unit/codeflow-parsers.test.ts
```
Expected: PASS en todos los tests de parsers.

---

## Task 4: Actualizar buildDagreGraph con parámetro deep

**Files:**
- Modify: `src/lib/codeflow/buildDagreGraph.ts`

- [ ] **Step 4.1: Añadir parámetro `deep` a `buildDagreGraph` y pasarlo a parsers**

```typescript
export async function buildDagreGraph(
  filePath: string,
  content: string,
  deep = false,
): Promise<graphlib.Graph> {
  // ... setup sin cambios ...

  const flow =
    lang === SupportedLanguages.Python
      ? parsePython(tree, deep)
      : parseJsTs(tree, deep);

  // ... resto sin cambios ...
}
```

- [ ] **Step 4.2: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```
Expected: 0 errores.

---

## Task 5: Añadir prop `depth` a CodeFlowView

**Files:**
- Modify: `src/components/CodeFlowView.tsx`

- [ ] **Step 5.1: Añadir la interfaz de props y cambiar la firma del componente**

Añadir antes de `export const CodeFlowView`:

```typescript
interface CodeFlowViewProps {
  depth: 'high' | 'low';
}
```

Cambiar la firma del componente (línea ~253):

```typescript
export const CodeFlowView = forwardRef<CodeFlowViewHandle, CodeFlowViewProps>(
  ({ depth }, ref) => {
```

- [ ] **Step 5.2: Usar un ref para depth dentro de `handleFileSelect` (evita stale closure)**

`handleFileSelect` es un `useCallback` con deps vacías. Para que siempre lea el `depth` actual sin añadirlo como dep (lo que invalidaría la referencia en cada cambio), se usa un ref.

Añadir justo después de las declaraciones de estado existentes (tras los `useRef` ya existentes):

```typescript
// Mantiene el depth actualizado sin invalidar handleFileSelect en cada cambio
const depthRef = useRef(depth);
useEffect(() => { depthRef.current = depth; }, [depth]);
```

En `handleFileSelect`, cambiar la llamada a `buildDagreGraph` para leer del ref:

```typescript
const g = await buildDagreGraph(filePath, content, depthRef.current === 'low');
```

- [ ] **Step 5.3: Añadir useEffect que re-parsea cuando cambia `depth`**

Añadir justo antes del `return (...)`. El `prevDepthRef` evita ejecutar el re-parseo en el montaje inicial:

```typescript
const prevDepthRef = useRef(depth);
useEffect(() => {
  if (prevDepthRef.current === depth) return;
  prevDepthRef.current = depth;
  if (selectedFile && mode === 'graph') {
    handleFileSelect(selectedFile);
  }
}, [depth, selectedFile, mode, handleFileSelect]);
```

- [ ] **Step 5.4: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errores.

---

## Task 6: Añadir toggle UI a GraphCanvas

**Files:**
- Modify: `src/components/GraphCanvas.tsx`

- [ ] **Step 6.1: Importar `List` en GraphCanvas**

En el bloque de imports de lucide-icons (línea ~6), añadir `List`:

```typescript
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Focus,
  RotateCcw,
  Play,
  Pause,
  Lightbulb,
  LightbulbOff,
  Sparkles,
  Layers,
  Brain,
  Building2,
  GitBranch,
  Globe,
  Share2,
  Download,
  List,
} from '@/lib/lucide-icons';
```

- [ ] **Step 6.2: Añadir el estado `codeFlowDepth`**

Después de la línea con `const codeFlowRef = useRef<CodeFlowViewHandle>(null);` (línea ~95), añadir:

```typescript
const [codeFlowDepth, setCodeFlowDepth] = useState<'high' | 'low'>('high');
```

- [ ] **Step 6.3: Añadir el toggle flotante de Alto/Bajo nivel**

Añadir después del bloque del toggle de City View (después del `)}` que cierra `{graph && graphViewType === 'city' && ...}`, aproximadamente línea 469):

```typescript
{/* Toggle Alto / Bajo nivel — visible en Code Flow */}
{graph && graphViewType === 'codeflow' && (
  <div
    className={`absolute top-12 z-20 flex overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm transition-all duration-300 ${isSidebarCollapsed ? 'left-14' : 'left-60'}`}
  >
    <button
      onClick={() => setCodeFlowDepth('high')}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
        codeFlowDepth === 'high'
          ? 'bg-elevated text-text-primary'
          : 'text-text-muted hover:bg-hover hover:text-text-secondary'
      }`}
      title="Vista estructural: funciones, clases, flujo de control principal"
    >
      <Layers className="h-3 w-3" />
      Alto nivel
    </button>
    <div className="w-px bg-border-subtle" />
    <button
      onClick={() => setCodeFlowDepth('low')}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
        codeFlowDepth === 'low'
          ? 'bg-elevated text-text-primary'
          : 'text-text-muted hover:bg-hover hover:text-text-secondary'
      }`}
      title="Vista detallada: incluye bloques anidados, switch/case y funciones internas"
    >
      <List className="h-3 w-3" />
      Bajo nivel
    </button>
  </div>
)}
```

- [ ] **Step 6.4: Pasar `depth` como prop a `<CodeFlowView>`**

Buscar la línea con `<CodeFlowView ref={codeFlowRef} />` (aproximadamente línea 544) y reemplazar:

```tsx
<CodeFlowView ref={codeFlowRef} depth={codeFlowDepth} />
```

- [ ] **Step 6.5: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errores.

---

## Task 7: Verificación final y commit

- [ ] **Step 7.1: Ejecutar todos los tests**

```bash
npm test
```
Expected: todos los tests pasan, incluyendo los nuevos de `codeflow-parsers.test.ts`.

- [ ] **Step 7.2: Build de producción**

```bash
npm run build
```
Expected: build exitoso sin errores TypeScript ni de bundle.

- [ ] **Step 7.3: Commit**

```bash
git add src/components/GraphCanvas.tsx src/components/CodeFlowView.tsx src/lib/codeflow/buildDagreGraph.ts src/lib/codeflow/parsers/js.ts src/lib/codeflow/parsers/python.ts test/unit/codeflow-parsers.test.ts
git commit -m "feat: añadir toggle Alto nivel / Bajo nivel a Code Flow"
```

---

## Verificación manual esperada

1. Abrir la app con un repositorio analizado
2. Ir a la vista **Code Flow**
3. Seleccionar un archivo `.ts` o `.py` con funciones que contengan `if` y `for` anidados
4. Verificar que en **Alto nivel** el diagrama muestra la estructura actual (sin recursión)
5. Hacer clic en **Bajo nivel** — el diagrama debe recargarse mostrando los nodos anidados
6. Volver a **Alto nivel** — el diagrama debe simplificarse de nuevo
7. El toggle debe aparecer en la misma posición y con el mismo estilo que "Conexiones/Profundidad" en City View
