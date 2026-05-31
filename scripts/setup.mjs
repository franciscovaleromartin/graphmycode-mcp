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

// ─── Claude Code ────────────────────────────────────────────────────────────

function registerMcp() {
  try {
    execSync(`claude mcp add -s user graphmycode -- "${nodePath}" "${distPath}"`, {
      stdio: 'pipe',
    });
    console.log('✓ MCP graphmycode registrado en Claude Code');
  } catch (e) {
    const output = (e.stderr?.toString() ?? '') + (e.stdout?.toString() ?? '');
    if (output.includes('already') || output.includes('exists')) {
      try {
        execSync('claude mcp remove graphmycode -s user', { stdio: 'pipe' });
        execSync(`claude mcp add -s user graphmycode -- "${nodePath}" "${distPath}"`, { stdio: 'pipe' });
        console.log('✓ MCP graphmycode actualizado en Claude Code');
      } catch {
        console.log('✓ MCP graphmycode ya estaba registrado en Claude Code');
      }
    } else {
      console.warn('⚠  No se pudo registrar el MCP en Claude Code automáticamente.');
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function mergeJsonConfig(filePath, mcpKey, serverConfig) {
  let config = {};
  if (fs.existsSync(filePath)) {
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      config = {};
    }
  }
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[mcpKey] = serverConfig;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
}

const npxEntry = { command: 'npx', args: ['-y', 'graphmycode-mcp'] };

// ─── Cursor ─────────────────────────────────────────────────────────────────

function registerCursor() {
  const configPath = path.join(os.homedir(), '.cursor', 'mcp.json');
  mergeJsonConfig(configPath, 'graphmycode', npxEntry);
  console.log('✓ MCP graphmycode registrado en Cursor (~/.cursor/mcp.json)');
}

// ─── Windsurf ────────────────────────────────────────────────────────────────

function registerWindsurf() {
  const configPath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
  mergeJsonConfig(configPath, 'graphmycode', npxEntry);
  console.log('✓ MCP graphmycode registrado en Windsurf (~/.codeium/windsurf/mcp_config.json)');
}

// ─── Cline ───────────────────────────────────────────────────────────────────

function getClinePath() {
  const ext = path.join('globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', ext);
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Code', 'User', ext);
  }
  return path.join(os.homedir(), '.config', 'Code', 'User', ext);
}

function registerCline() {
  const configPath = getClinePath();
  const settingsDir = path.dirname(configPath);

  if (!fs.existsSync(settingsDir)) {
    console.warn('⚠  Cline: directorio de VSCode no encontrado.');
    console.warn(`   Ruta esperada: ${configPath}`);
    console.warn('   Configura manualmente en Cline > MCP Servers > Configure MCP Servers.');
    return false;
  }

  mergeJsonConfig(configPath, 'graphmycode', {
    ...npxEntry,
    disabled: false,
    autoApprove: [],
  });
  console.log('✓ MCP graphmycode registrado en Cline (VSCode)');
  return true;
}

// ─── Continue ────────────────────────────────────────────────────────────────

function registerContinue() {
  // Continue picks up JSON files from ~/.continue/mcpServers/ automatically
  const dir = path.join(os.homedir(), '.continue', 'mcpServers');
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, 'graphmycode.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify({ mcpServers: { graphmycode: npxEntry } }, null, 2) + '\n',
  );
  console.log('✓ MCP graphmycode registrado en Continue (~/.continue/mcpServers/graphmycode.json)');
}

// ─── Antigravity (Google) ────────────────────────────────────────────────────

function registerAntigravity() {
  const configPath = process.platform === 'win32'
    ? path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json')
    : path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
  mergeJsonConfig(configPath, 'graphmycode', npxEntry);
  console.log(`✓ MCP graphmycode registrado en Antigravity (${configPath.replace(os.homedir(), '~')})`);
}

// ─── Zed ─────────────────────────────────────────────────────────────────────

function getZedSettingsPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Zed', 'settings.json');
  }
  return path.join(os.homedir(), '.config', 'zed', 'settings.json');
}

function registerZed() {
  const configPath = getZedSettingsPath();
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      config = {};
    }
  }
  config.context_servers = config.context_servers ?? {};
  config.context_servers['graphmycode-mcp'] = {
    source: 'custom',
    command: 'npx',
    args: ['-y', 'graphmycode-mcp'],
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('✓ MCP graphmycode registrado en Zed (~/.config/zed/settings.json)');
}

// ─── Exports públicos ────────────────────────────────────────────────────────

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

export function setupTool(tool) {
  console.log(`\nConfigurando GraphMyCode MCP para ${tool}...\n`);
  switch (tool) {
    case 'cursor':       registerCursor();      break;
    case 'windsurf':     registerWindsurf();    break;
    case 'cline':        registerCline();       break;
    case 'continue':     registerContinue();    break;
    case 'zed':          registerZed();         break;
    case 'antigravity':  registerAntigravity(); break;
    default:
      console.error(`Herramienta desconocida: "${tool}"`);
      console.error('Disponibles: cursor, windsurf, cline, continue, zed, antigravity');
      process.exit(1);
  }
  console.log('\nReinicia el editor para activar los cambios.\n');
}

export function setupAll() {
  console.log('\nConfigurando GraphMyCode MCP para todos los editores...\n');
  registerMcp();
  copyCommands();
  registerCursor();
  registerWindsurf();
  registerCline();
  registerContinue();
  registerZed();
  registerAntigravity();
  console.log('\n¡Listo! Reinicia tus editores para activar los cambios.\n');
}
