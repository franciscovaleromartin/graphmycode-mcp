# Footer y páginas estáticas — Diseño

**Fecha:** 2026-05-02
**Proyecto:** GraphMyCode
**Estado:** Aprobado

---

## Objetivo

Añadir un footer a la landing page con 4 enlaces de navegación + texto legal, y crear 3 páginas HTML estáticas (Política de privacidad, Cómo funciona, Casos de uso) que sean crawlables por bots IA sin ejecución de JavaScript.

---

## Decisiones tomadas

| Pregunta | Decisión |
|---|---|
| Arquitectura de páginas | HTML estático en `/public/` (Option A) |
| Estilo visual | Dark, idéntico a la landing (#080d18) |
| Layout del footer | Dos filas centradas (Option A) |

---

## Footer — Especificación

### Ubicación
Al final del `return` de `LandingScreen.tsx`, justo después del `<div>` que envuelve todo el contenido (antes del cierre del `flex min-h-screen`).

### Estructura HTML (dos filas)

```
Fila 1 (links): Cómo funciona · Casos de uso · Política de privacidad · [GitHub icon] GitHub · Licencia PolyForm
Fila 2 (legal): © 2026 Francisco Valero
```

### Estilos (Tailwind, en línea con la app)
- Separador top: `border-t border-white/[0.06]`
- Fondo: transparente (hereda `bg-void`)
- Padding: `py-8 px-6`
- Links fila 1: `text-xs text-text-muted hover:text-text-secondary transition-colors`
- Separadores `·`: `text-border-subtle`
- Fila 2: `text-[11px] text-text-muted/60`
- GitHub: con SVG del logo de GitHub (14×14px)
- "Licencia PolyForm": enlace externo a `https://polyformproject.org/licenses/noncommercial/1.0.0/`
- "GitHub": enlace externo a `https://github.com/franciscovaleromartin/graphmycode`
- "Cómo funciona": enlace a `/como-funciona`
- "Casos de uso": enlace a `/casos-de-uso`
- "Política de privacidad": enlace a `/privacy`

---

## Páginas estáticas — Especificación

### Archivos a crear
- `/public/privacy.html` → accesible en `https://graphmycode.com/privacy`
- `/public/como-funciona.html` → accesible en `https://graphmycode.com/como-funciona`
- `/public/casos-de-uso.html` → accesible en `https://graphmycode.com/casos-de-uso`

### Estructura común de cada página (plantilla)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Título de la página] — GraphMyCode</title>
  <meta name="description" content="[Descripción específica]">
  <link rel="canonical" href="https://graphmycode.com/[slug]">
  <!-- Open Graph -->
  <!-- JSON-LD schema Article o WebPage -->
  <!-- Google Fonts: Inter -->
  <!-- CSS inline: dark theme -->
</head>
<body>
  <!-- Topbar: logo GraphMyCode + "← Volver a la app" -->
  <!-- Contenido principal: H1, secciones H2, párrafos -->
  <!-- Footer: idéntico al de la landing (fila links + fila copyright) -->
</body>
</html>
```

### Paleta de colores (CSS variables inline)
```css
--bg:       #080d18;
--surface:  #0c111d;
--border:   rgba(255,255,255,0.07);
--text-primary:   #f1f5f9;
--text-secondary: #94a3b8;
--text-muted:     #475569;
--accent:   #e879f9;  /* fuchsia para GraphMy */
--cyan:     #22d3ee;  /* cyan para Code */
```

---

## Contenido de cada página

### 1. `/public/privacy.html` — Política de privacidad

**Title:** `Política de privacidad — GraphMyCode`
**H1:** `Tu código nunca sale de tu navegador`
**Schema JSON-LD:** `WebPage` con `name`, `description`, `url`, `author`

**Secciones (H2):**
1. **Procesamiento local** — Todo el análisis ocurre en el navegador con WebAssembly (tree-sitter). Ningún servidor de GraphMyCode recibe código.
2. **¿Qué datos se procesan?** — En tu dispositivo: archivos fuente, metadata de imports/exports, embeddings vectoriales. Nada se envía a ningún servidor de GraphMyCode.
3. **Cuando usas el chat con IA** — El contexto relevante viaja al proveedor que elijas (OpenAI, Gemini, Anthropic u Ollama). GraphMyCode actúa como intermediario local, no almacena ni registra estas conversaciones.
4. **Analytics** — Vercel Analytics recoge métricas de uso anónimas (páginas visitadas, tiempo de sesión). Sin cookies de tracking. Sin identificadores personales.
5. **Cookies** — No se usan cookies propias. El análisis del repositorio y la configuración se guardan en `localStorage` del navegador, accesible solo desde tu dispositivo.
6. **Contacto** — correodefranciscovalero@gmail.com

---

### 2. `/public/como-funciona.html` — Cómo funciona

**Title:** `Cómo funciona GraphMyCode — Visualización de dependencias en el navegador`
**H1:** `Cómo convierte GraphMyCode tu código en un grafo`
**Schema JSON-LD:** `Article` con `name`, `description`, `author`, `datePublished`

**Secciones (H2):**
1. **Paso 1 — Sube tu repositorio** — Arrastra un ZIP o pega la URL de un repositorio público de GitHub. GraphMyCode descarga o descomprime los archivos directamente en tu navegador.
2. **Paso 2 — Análisis AST con WebAssembly** — Tree-sitter analiza cada archivo fuente mediante gramáticas WASM específicas por lenguaje. Extrae funciones, clases, imports y exports sin ejecutar el código.
3. **Paso 3 — Construcción del grafo** — Los símbolos y sus relaciones forman un grafo de conocimiento. Los nodos son archivos, clases y funciones; las aristas representan dependencias.
4. **Paso 4 — Layout y visualización** — ForceAtlas2 calcula el layout del grafo. Three.js renderiza el resultado en 3D. Sigma.js gestiona la vista 2D estructural.
5. **Paso 5 — Agrupación semántica (opcional)** — HuggingFace Transformers genera embeddings locales de cada símbolo. UMAP proyecta las similitudes semánticas en 3D para agrupar código relacionado.
6. **Paso 6 — Chat con IA (opcional)** — Conecta tu propio proveedor LLM (OpenAI, Gemini, Anthropic u Ollama local). El contexto del grafo se envía junto con tu pregunta.
7. **Lenguajes soportados** — TypeScript, JavaScript, Python, Go, Rust, Java, PHP, C, C++, C#, Swift, Kotlin, Ruby.
8. **Tecnologías** — React 19, Vite, Three.js, Sigma.js, tree-sitter WASM, HuggingFace Transformers, LangChain, UMAP, ForceAtlas2.

---

### 3. `/public/casos-de-uso.html` — Casos de uso

**Title:** `Casos de uso de GraphMyCode — Para qué sirve la visualización de dependencias`
**H1:** `¿Para qué sirve GraphMyCode?`
**Schema JSON-LD:** `Article` con `name`, `description`, `author`, `datePublished`

**Secciones (H2):**
1. **Onboarding en un proyecto nuevo** — Visualiza en minutos cómo está estructurado un codebase desconocido. Identifica los módulos principales, los puntos de entrada y las dependencias más críticas.
2. **Analizar un repositorio de GitHub** — Pega la URL de cualquier repositorio público y obtén su grafo de dependencias al instante. Útil para evaluar librerías open-source antes de adoptarlas.
3. **Detectar acoplamiento excesivo** — El heatmap de dependencias muestra qué archivos tienen más imports entrantes. Un nodo muy conectado es un candidato a refactorización.
4. **Planificar una refactorización** — El análisis de impacto muestra qué archivos se ven afectados al modificar uno dado. Evita romper dependencias inesperadas.
5. **Revisar arquitectura antes de un code review** — La vista de grafo estructural hace evidente si un PR introduce dependencias circulares o acopla módulos que deberían estar separados.
6. **Explorar proyectos open-source** — Analiza el código fuente de React, Next.js, FastAPI o cualquier proyecto popular para entender su arquitectura interna.
7. **Deuda técnica con Technical Debt City** — La vista 3D estilo ciudad asigna altura a los archivos según su complejidad y número de dependencias. Las "torres" son los puntos de mayor deuda técnica.

---

## Cambios en vercel.json

Añadir `"cleanUrls": true` al `vercel.json` existente para que Vercel sirva `/privacy.html` como `/privacy`, `/como-funciona.html` como `/como-funciona`, etc. Sin este flag las URLs tendrían la extensión `.html` visible.

El enlace "← Volver a la app" en el topbar de cada página apunta a `href="/"`.

---

## Actualización del sitemap

Añadir las 3 URLs nuevas a `/public/sitemap.xml`:
- `https://graphmycode.com/privacy`
- `https://graphmycode.com/como-funciona`
- `https://graphmycode.com/casos-de-uso`

---

## Impacto GEO esperado

Con estas 3 páginas publicadas:
- **Citabilidad IA:** 10 → ~35/100 (de 57 palabras indexables a ~2.000+)
- **E-E-A-T:** 22 → ~35/100 (Privacy Policy añade Trustworthiness; "Cómo funciona" añade Expertise)
- **GEO Score global:** 21 → ~30/100

Las páginas de "Cómo funciona" y "Casos de uso" son directamente citable por Perplexity, ChatGPT y Claude cuando alguien busca "herramientas para visualizar dependencias de código".
