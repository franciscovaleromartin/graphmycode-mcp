#!/usr/bin/env node
const [, , arg, subarg] = process.argv;

if (arg === 'setup') {
  const { setup, setupTool, setupAll } = await import('./setup.mjs');
  if (!subarg) {
    setup();
  } else if (subarg === '--all') {
    setupAll();
  } else {
    setupTool(subarg);
  }
} else {
  await import('../dist/index.js');
}
