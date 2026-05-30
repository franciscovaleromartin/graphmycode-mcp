# Code Flow — Toggle Alto nivel / Bajo nivel

**Fecha:** 2026-05-08  
**Estado:** Aprobado

## Objetivo

Añadir un toggle "Alto nivel / Bajo nivel" a la vista Code Flow que permita elegir entre la vista estructural actual (alto nivel) y una vista detallada que recursiona dentro de los bloques de control (bajo nivel).

## Diseño

### UI

Toggle flotante idéntico al de "Conexiones/Profundidad" de la City View:
- Posición: `absolute top-12 z-20` en GraphCanvas, desplazado según sidebar colapsado o no
- Solo visible cuando `graphViewType === 'codeflow'` y hay un archivo abierto (modo graph)
- Estilo: `flex overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm`
- Botón activo: `bg-elevated text-text-primary`
- Botón inactivo: `text-text-muted hover:bg-hover hover:text-text-secondary`
- Iconos: `Layers` para Alto nivel, `List` para Bajo nivel (ambos ya disponibles en lucide-icons.tsx)

### Comportamiento

- **Alto nivel** (por defecto): comportamiento actual — funciones, clases, métodos, if, for, while, try/catch, returns, llamadas entre funciones del mismo archivo
- **Bajo nivel**: todo lo anterior más:
  - Recursión dentro de bloques `if` (rama true, rama else/else-if)
  - Recursión dentro de cuerpos de bucles `for`, `for...of`, `for...in`, `while`, `do...while`
  - Recursión dentro de bloques `try` y `catch`
  - `switch/case` con sus ramas como nodos
  - Funciones anidadas declaradas dentro de cuerpos de otras funciones
- Al cambiar el modo con un archivo ya abierto, se re-parsea automáticamente

### Flujo de datos

```
GraphCanvas (codeFlowDepth state)
  → prop depth="high"|"low" → CodeFlowView
    → buildDagreGraph(filePath, content, deep)
      → parseJsTs(tree, deep) / parsePython(tree, deep)
```

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `GraphCanvas.tsx` | Estado `codeFlowDepth`, toggle flotante, prop a CodeFlowView |
| `CodeFlowView.tsx` | Prop `depth`, re-trigger build en cambio de depth |
| `buildDagreGraph.ts` | Parámetro `deep?: boolean`, pasa a parsers |
| `parsers/js.ts` | Recursión en bloques, switch/case, funciones anidadas |
| `parsers/python.ts` | Recursión en bloques (if, for, while, try/except) |

## No incluido en este scope

- Mostrar variables/constantes no-función
- Mostrar imports/exports
- Mostrar tipos TypeScript (interfaces, enums)
- Animación al cambiar de modo
