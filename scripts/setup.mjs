import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.dirname(__dirname);
const distPath = path.join(packageRoot, 'dist', 'index.js');
const nodePath = process.execPath;
const commandsSource = path.join(packageRoot, 'commands');
const commandsDest = path.join(os.homedir(), '.claude', 'commands');

function registerMcp() {
  try {
    execSync(`claude mcp add -s user graphmycode -- "${nodePath}" "${distPath}"`, {
      stdio: 'pipe',
    });
    console.log('✓ MCP graphmycode registrado en Claude Code');
  } catch (e) {
    const output = (e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '');
    if (output.includes('already') || output.includes('exists')) {
      // Idempotente: ya estaba registrado, actualizar con remove+add
      try {
        execSync('claude mcp remove graphmycode -s user', { stdio: 'pipe' });
        execSync(`claude mcp add -s user graphmycode -- "${nodePath}" "${distPath}"`, { stdio: 'pipe' });
        console.log('✓ MCP graphmycode actualizado en Claude Code');
      } catch {
        console.log('✓ MCP graphmycode ya estaba registrado');
      }
    } else {
      console.warn('⚠  No se pudo registrar el MCP automáticamente.');
      console.warn('   Ejecuta manualmente:');
      console.warn(`   claude mcp add -s user graphmycode -- "${nodePath}" "${distPath}"`);
    }
  }
}

function copyCommands() {
  if (!fs.existsSync(commandsSource)) return;

  fs.mkdirSync(commandsDest, { recursive: true });

  const files = fs.readdirSync(commandsSource).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    fs.copyFileSync(path.join(commandsSource, file), path.join(commandsDest, file));
  }
  console.log(`✓ ${files.length} slash commands instalados en ~/.claude/commands/`);
  console.log('  ' + files.map((f) => `/${f.replace('.md', '')}`).join(', '));
}

export function setup() {
  if (!fs.existsSync(distPath)) {
    console.error('Error: dist/index.js no encontrado. El paquete puede estar corrupto.');
    process.exit(1);
  }

  console.log('\nConfigurando GraphMyCode MCP...\n');
  registerMcp();
  copyCommands();
  console.log('\n¡Listo! Reinicia Claude Code para activar los cambios.\n');
}
