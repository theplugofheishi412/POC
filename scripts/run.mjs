#!/usr/bin/env node
/**
 * Lanceur multiplateforme (Windows / macOS / Linux) sans appel « pnpm »
 * imbriqué :
 *
 *   node scripts/run.mjs dev      API (port 8080) + frontend Vite (port 5173)
 *   node scripts/run.mjs start    build complet puis un seul serveur (port 8080)
 *   node scripts/run.mjs verify   typecheck de tous les paquets + builds
 *   node scripts/run.mjs reset    réinitialise les données de démonstration
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = path.join(root, 'artifacts', 'api-server');
const web = path.join(root, 'artifacts', 'cabinet-avocat-poc');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const vite = path.join(web, 'node_modules', 'vite', 'bin', 'vite.js');
const API_PORT = process.env.API_PORT ?? '8080';
const WEB_PORT = process.env.WEB_PORT ?? '5173';

function step(label, cmd, args, cwd, env = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`✘ Échec : ${label}`);
    process.exit(r.status ?? 1);
  }
}

function serve(label, cmd, args, cwd, env) {
  const child = spawn(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  child.on('exit', (code) => {
    console.log(`${label} arrêté (code ${code}).`);
    process.exit(code ?? 0);
  });
  return child;
}

const buildApi = () => step('Build de l’API', process.execPath, ['build.mjs'], api);
const buildWeb = (env = {}) => step('Build du frontend', process.execPath, [vite, 'build', '--config', 'vite.config.ts'], web, { NODE_ENV: 'production', ...env });

switch (process.argv[2]) {
  case 'dev': {
    buildApi();
    const children = [
      serve('API', process.execPath, ['--enable-source-maps', 'dist/index.mjs'], api, { PORT: API_PORT, SERVE_STATIC: 'false' }),
      serve('Frontend', process.execPath, [vite, '--config', 'vite.config.ts', '--host', '0.0.0.0'], web, { PORT: WEB_PORT, API_PORT }),
    ];
    console.log(`\n  Application : http://localhost:${WEB_PORT}\n  API         : http://localhost:${API_PORT}/api/healthz\n`);
    process.on('SIGINT', () => children.forEach((c) => c.kill()));
    break;
  }
  case 'start': {
    buildWeb({ PORT: API_PORT });
    buildApi();
    console.log(`\n  Application : http://localhost:${API_PORT}\n`);
    serve('Serveur', process.execPath, ['--enable-source-maps', 'dist/index.mjs'], api, { PORT: API_PORT, NODE_ENV: 'production' });
    break;
  }
  case 'verify': {
    step('Typecheck des bibliothèques partagées', process.execPath, [tsc, '--build'], root);
    for (const pkg of ['artifacts/api-server', 'artifacts/cabinet-avocat-poc', 'artifacts/mockup-sandbox', 'scripts']) {
      step(`Typecheck ${pkg}`, process.execPath, [tsc, '-p', 'tsconfig.json', '--noEmit'], path.join(root, pkg));
    }
    buildApi();
    buildWeb();
    console.log('\n✔ Typecheck et builds réussis.');
    break;
  }
  case 'reset': {
    buildApi();
    step('Réinitialisation des données de démonstration', process.execPath, ['dist/index.mjs', '--reset-only'], api);
    break;
  }
  default:
    console.log('Usage : node scripts/run.mjs <dev|start|verify|reset>');
    process.exit(1);
}
