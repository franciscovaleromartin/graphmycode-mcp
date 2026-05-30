#!/usr/bin/env node
// Punto de entrada CLI: "graphmycode-mcp setup" o el servidor MCP
if (process.argv[2] === 'setup') {
  const { setup } = await import('./setup.mjs');
  setup();
} else {
  await import('../dist/index.js');
}
