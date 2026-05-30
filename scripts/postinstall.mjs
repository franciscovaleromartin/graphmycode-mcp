import { setup } from './setup.mjs';

// Solo ejecutar en instalación global para no tocar ~/.claude en entornos de desarrollo
if (process.env.npm_config_global !== 'true') {
  process.exit(0);
}

try {
  setup();
} catch (e) {
  // Nunca fallar la instalación de npm
  console.warn('\nGraphMyCode: el setup automático falló:', e.message);
  console.warn('Ejecuta el setup manualmente con: graphmycode-mcp setup\n');
}
