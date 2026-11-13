#!/usr/bin/env node
/**
 * Build Vercel (Build Output API v3) — tout le POC sur Vercel, sans service
 * externe :
 *
 *   .vercel/output/static/             frontend React compilé
 *   .vercel/output/functions/api.func/ API Express (fonction Node), base PGlite
 *                                      en mémoire rechargée avec les données
 *                                      de démonstration à chaque démarrage
 *
 * Utilisé par vercel.json (buildCommand). Exécutable en local :
 *   node scripts/vercel-build.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = path.join(root, 'artifacts', 'api-server');
const web = path.join(root, 'artifacts', 'cabinet-avocat-poc');
const out = path.join(root, '.vercel', 'output');
const funcDir = path.join(out, 'functions', 'api.func');

function run(label, args, cwd, env = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`✘ Échec : ${label}`);
    process.exit(r.status ?? 1);
  }
}

const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

fs.rmSync(out, { recursive: true, force: true });

/* 1. Frontend -> static/ */
run('Build du frontend', [path.join(web, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.config.ts'], web, {
  NODE_ENV: 'production',
});
fs.cpSync(path.join(web, 'dist', 'public'), path.join(out, 'static'), { recursive: true });

/* 2. API -> functions/api.func (bundle esbuild + migrations) */
run('Build de l’API (fonction Vercel)', ['build.mjs'], api, { API_ENTRY: 'src/vercel.ts', API_OUTDIR: funcDir });

/*
 * 3. Paquets laissés hors du bundle (PGlite : fichiers WASM ; pdfkit : polices)
 *    copiés avec leurs dépendances dans api.func/node_modules, en suivant la
 *    résolution Node depuis l'arborescence pnpm.
 */
function resolvePackageDir(name, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    if (path.basename(dir) !== 'node_modules') {
      const candidate = path.join(dir, 'node_modules', name);
      if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    }
    if (path.dirname(dir) === dir) throw new Error(`Paquet introuvable : ${name} (depuis ${fromDir})`);
  }
}

const installed = new Map(); // nom -> version copiée à la racine de node_modules
function copyPackage(name, fromDir, destNodeModules) {
  const src = resolvePackageDir(name, fromDir);
  const pkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
  // Une version par nom à la racine ; une version différente est imbriquée
  // sous le paquet qui la requiert (résolution Node standard).
  const existing = installed.get(name);
  if (existing === pkg.version) return;
  let dest;
  if (existing === undefined) {
    dest = path.join(funcDir, 'node_modules', name);
    installed.set(name, pkg.version);
  } else {
    dest = path.join(destNodeModules, name);
    if (fs.existsSync(dest)) return;
  }
  fs.cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter: (p) => !p.slice(src.length).split(path.sep).includes('node_modules'),
  });
  const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
  for (const dep of Object.keys(deps)) {
    try {
      copyPackage(dep, src, path.join(dest, 'node_modules'));
    } catch (err) {
      if (!pkg.optionalDependencies?.[dep]) throw err;
    }
  }
}
for (const name of ['@electric-sql/pglite', 'pdfkit']) copyPackage(name, api, path.join(funcDir, 'node_modules'));
fs.writeFileSync(path.join(funcDir, 'package.json'), '{ "type": "module" }\n');

/* 4. Configuration de la fonction et des routes */
writeJson(path.join(funcDir, '.vc-config.json'), {
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  maxDuration: 30,
  memory: 1024,
  environment: {
    NODE_ENV: 'production',
    PGLITE_DATA_DIR: 'memory://',
    DATA_DIR: '/tmp/cabinet',
    SERVE_STATIC: 'false',
    // Secret de signature des sessions, propre à chaque déploiement
    // (jamais envoyé au navigateur).
    SESSION_SECRET: process.env.SESSION_SECRET ?? crypto.randomBytes(32).toString('base64url'),
  },
});

writeJson(path.join(out, 'config.json'), {
  version: 3,
  routes: [
    { src: '^/api/(.*)$', dest: '/api?__path=$1' },
    { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
    { handle: 'filesystem' },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
});

console.log('\n✔ Sortie Vercel prête dans .vercel/output');
