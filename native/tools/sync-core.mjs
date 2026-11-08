#!/usr/bin/env node
/* tools/sync-core.mjs — copia el NÚCLEO COMPARTIDO de Foxinix (web) al
   proyecto NativeScript.

   La app nativa y la web comparten la MISMA lógica (api, store, i18n,
   descargas…). Lo que cambia es la capa `platform/` y las vistas.

   Este script:
     1. Parte de un conjunto de módulos entrada y calcula el cierre de
        imports (para no arrastrar vistas que son HTML).
     2. Copia esos módulos a `app/core/`.
     3. Sustituye `platform/` por las implementaciones NativeScript.
     4. Escribe el puente de Vue para NS (`app/core/vue.js`).
     5. Escribe `app/core/platform/index.js` con el conmutador nativo.

   Lo que copia es GENERADO: no se edita a mano. Para cambiar la lógica
   compartida se edita `landing/static/js/` y se vuelve a correr esto.

   Uso: node tools/sync-core.mjs [--check]
        --check  solo verifica que app/core/ esté al día (sale 1 si no). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NS_ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.resolve(NS_ROOT, '..', 'landing', 'static', 'js');
const OUT = path.join(NS_ROOT, 'app', 'core');

/* Módulos de entrada del núcleo compartido. Son los que no dependen de
   vistas HTML. */
const ENTRIES = [
  'api.js',
  'store.js',
  'i18n.js',
  'downloads.js',
];

/* Módulos de platform/ que la app nativa necesita (implementación NS). */
const PLATFORM_FILES = [
  'net.js',
  'storage.js',
  'files.js',
  'dom.js',
  'images.js',
  'media.js',
  'notifications.js',
  'cookies.js',
];

const IMPORT_RE = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

function readWeb(rel) {
  const p = path.join(WEB_ROOT, rel);
  if (!fs.existsSync(p)) throw new Error('no existe en la web: ' + rel);
  return fs.readFileSync(p, 'utf8');
}

/* Cierre de imports: si un módulo importa './otro.js', ese otro también
   se copia (si está en la raíz de shared/). */
function closure(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    const src = readWeb(rel);
    seen.add(rel);
    if (rel.startsWith('platform/')) continue;
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(src)) !== null) {
      const spec = m[1];
      if (!spec.startsWith('./')) continue;
      const dep = path.posix.normalize(spec.replace(/^\.\//, ''));
      if (!dep.endsWith('.js')) continue;
      if (dep.startsWith('platform/')) continue;
      if (!fs.existsSync(path.join(WEB_ROOT, dep))) continue;  /* p.ej. vue.js (NS) */
      queue.push(dep);
    }
  }
  return seen;
}

const BANNER = (origin) =>
  '/* GENERADO POR tools/sync-core.mjs — NO EDITAR A MANO.\n' +
  '   Origen: landing/static/js/' + origin + '\n' +
  '   Regenerar: node tools/sync-core.mjs\n' +
  '   (cambia el original en la web y vuelve a sincronizar) */\n\n';

/* ---- puente de Vue para NativeScript ---- */
const VUE_BRIDGE = `/* GENERADO POR tools/sync-core.mjs — NO EDITAR A MANO.
   Puente de Vue para NativeScript (equivalente de landing/static/js/vue.js).

   En la web, Vue vive en window.Vue (script global). En NS se importa
   del paquete real, así que este módulo reexporta la API de composición
   como un objeto con la MISMA forma que el Vue global de la web
   (Vue.ref, Vue.computed, Vue.onMounted, ...).

   Los componentes de la web usan Vue.onMounted/onUnmounted/onUpdated
   DENTRO de setup(): en Vue 3 eso es la API de composición, que aquí se
   expone con esos mismos nombres. */

import {
  ref, computed, reactive, readonly, watch, watchEffect, nextTick,
  onMounted, onUnmounted, onUpdated, onBeforeMount, onBeforeUnmount,
  provide, inject,
} from 'nativescript-vue';

const V = {
  ref, computed, reactive, readonly, watch, watchEffect, nextTick,
  onMounted, onUnmounted, onUpdated, onBeforeMount, onBeforeUnmount,
  provide, inject,
  /* Algunos módulos usan Vue.createApp / Vue.component (no debería pasar). */
  createApp: null,
  component: null,
};

export default V;
export const VueRef = ref;
`;

/* ---- conmutador de platform/ para NativeScript ---- */
function platformIndex() {
  const lines = [
    '/* GENERADO POR tools/sync-core.mjs — NO EDITAR A MANO.',
    '   platform/index.js en modo NATIVE (implementaciones de nativescript/).',
    '   La versión web vive en landing/static/js/platform/index.js. */',
    '',
  ];
  const names = { 'net.js': 'HttpClient', 'storage.js': 'StorageAdapter', 'files.js': 'FileAdapter',
    'dom.js': 'DomAdapter', 'images.js': 'ImageAdapter', 'media.js': 'MediaAdapter',
    'notifications.js': 'NotificationAdapter', 'cookies.js': 'CookieAdapter' };
  for (const f of PLATFORM_FILES) {
    lines.push("export { " + names[f] + " } from './nativescript/" + f + "';");
  }
  lines.push('');
  return lines.join('\n');
}

function writeFile(rel, content, check) {
  const dest = path.join(OUT, rel);
  const prev = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
  if (prev === content) return false;
  if (check) {
    console.error('DESACTUALIZADO: app/core/' + rel);
    return true;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
  return true;
}

function main() {
  const check = process.argv.includes('--check');
  const files = closure(ENTRIES);
  let changed = 0;

  /* 1. módulos del núcleo compartido */
  for (const rel of [...files].sort()) {
    const out = BANNER(rel) + readWeb(rel);
    if (writeFile(rel, out, check)) changed++;
  }

  /* 2. platform/ con las implementaciones NS */
  for (const f of PLATFORM_FILES) {
    const src = path.join(WEB_ROOT, 'platform', 'nativescript', f);
    if (!fs.existsSync(src)) throw new Error('falta platform/nativescript/' + f);
    const out = BANNER('platform/nativescript/' + f) + fs.readFileSync(src, 'utf8');
    if (writeFile('platform/' + f, out, check)) changed++;
  }
  if (writeFile('platform/index.js', platformIndex(), check)) changed++;

  /* 3. puente de Vue */
  if (writeFile('vue.js', VUE_BRIDGE, check)) changed++;

  /* 4. limpiar restos de una sincronización anterior */
  if (!check) {
    const keep = new Set([...files]);
    for (const f of PLATFORM_FILES) keep.add('platform/' + f);
    keep.add('platform/index.js');
    keep.add('vue.js');
    const walk = (dir, base) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = base ? base + '/' + e.name : e.name;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs, rel);
        else if (!keep.has(rel)) { fs.unlinkSync(abs); console.log('  eliminado obsoleto: app/core/' + rel); }
      }
    };
    walk(OUT, '');
  }

  console.log('núcleo sincronizado: ' + files.size + ' módulos compartidos + platform/ (' + PLATFORM_FILES.length + ')');
  console.log('  → ' + path.relative(process.cwd(), OUT));
  if (check && changed) {
    console.error('FALLO: app/core/ no está al día. Corre: node tools/sync-core.mjs');
    process.exit(1);
  }
  if (check) console.log('OK: app/core/ está al día');
}

main();
