/* test-w107-i18n.mjs — comprueba el port de "perfil propio" (W107).

   Las pantallas nuevas (Tu perfil / Editar perfil / Cambiar @usuario)
   deben usar EXACTAMENTE las mismas claves que la web (MeProfileModal,
   MeProfileEditModal y UsernameModal): el texto en español ES la clave
   y sólo existe traducción si la clave está en core/i18n.js (que es el
   i18n.js de la web, copiado por sync-core.mjs).

   También revisa que las vistas estén registradas en la navegación
   (nav.ts + App.vue), que ningún t() haya quedado con comillas rotas y
   que los estilos nuevos existan en app.css.

   No necesita la API ni credenciales (todo es local).

   Uso: node tools/test-w107-i18n.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = path.join(ROOT, 'app');

const VIEWS = ['MyProfileView.vue', 'MyProfileEditView.vue', 'UsernameView.vue'];

let pass = 0;
let fail = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log('PASS  ' + name + (detail ? '  [' + detail + ']' : ''));
  } else {
    fail++;
    console.log('FAIL  ' + name + (detail ? '  [' + detail + ']' : ''));
  }
}

const read = (p) => fs.readFileSync(p, 'utf8');

/* ---------- 1. las vistas existen ---------- */
const src = {};
for (const v of VIEWS) {
  const p = path.join(APP, 'views', v);
  const exists = fs.existsSync(p);
  ok('existe ' + v, exists);
  if (exists) src[v] = read(p);
}

/* ---------- 2. claves t('…') presentes en core/i18n.js ---------- */
const i18n = read(path.join(APP, 'core', 'i18n.js'));

/* Claves estáticas: t('texto'). Las dinámicas (t(p.label), t(e.detail))
   no se pueden resolver acá: esas se prueban contra los presets. */
const KEY_RE = /\bt\('((?:[^'\\]|\\.)+)'\)/g;

const allKeys = new Set();
for (const v of VIEWS) {
  const s = src[v] || '';
  for (const m of s.matchAll(KEY_RE)) allKeys.add(m[1].replace(/\\'/g, "'"));
}

ok('hay claves estáticas en las vistas', allKeys.size >= 40,
  allKeys.size + ' claves');

const missing = [];
for (const k of allKeys) {
  /* La clave va entre comillas simples o dobles en el mapa EN. */
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp("['\"]" + esc + "['\"]\\s*:");
  if (!re.test(i18n)) missing.push(k);
}
ok('todas las claves están traducidas en i18n.js',
  missing.length === 0,
  missing.length ? 'faltan: ' + missing.slice(0, 5).join(' | ') : allKeys.size + ' claves');

/* Las claves dinámicas de los presets y de los errores sí tienen que
   existir también (son las que el native arma con variables). */
const DYN = [
  'En línea', 'Ausente', 'No molestar', 'Invisible',
  'No se pudo actualizar el estado', 'No se pudo guardar el perfil',
  'No se pudo cambiar el usuario', 'Cambiando…', 'Guardando…',
];
const dynMissing = DYN.filter(
  (k) => !new RegExp("['\"]" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]").test(i18n));
ok('claves dinámicas (presets/errores) en i18n.js',
  dynMissing.length === 0,
  dynMissing.length ? 'faltan: ' + dynMissing.join(' | ') : DYN.length + ' claves');

/* ---------- 3. registro de navegación ---------- */
const nav = read(path.join(APP, 'nav.ts'));
ok('nav.ts conoce myprofile / myprofileedit / uname',
  nav.includes("'myprofile'") && nav.includes("'myprofileedit'")
  && nav.includes("'uname'"));
ok('nav.ts expone goMyProfile / goMyProfileEdit / goUsername',
  nav.includes('function goMyProfile()')
  && nav.includes('function goMyProfileEdit()')
  && nav.includes('function goUsername()'));

const appVue = read(path.join(APP, 'App.vue'));
ok('App.vue importa y monta las 3 vistas',
  appVue.includes('MyProfileView') && appVue.includes('MyProfileEditView')
  && appVue.includes('UsernameView'));
ok('App.vue las monta ANTES que ChatView',
  appVue.indexOf("view === 'myprofile'") < appVue.indexOf('ChatView v-else-if'),
  'orden de ramas');

/* ---------- 4. el avatar de cabecera abre "Tu perfil" ---------- */
const list = read(path.join(APP, 'views', 'ChatListView.vue'));
ok('la cabecera de Chats abre Tu perfil',
  list.includes('goMyProfile') && list.includes('accessibilityLabel="profile"'));
const people = read(path.join(APP, 'views', 'PeopleView.vue'));
ok('la cabecera de Personas abre Tu perfil', people.includes('goMyProfile'));

/* ---------- 5. estilos nuevos en app.css ---------- */
const css = read(path.join(APP, 'app.css'));
const CSS_CLASSES = [
  '.mp-page', '.mp-body', '.mp-av', '.fb ', '.fb-rounded',
  '.pf-quote', '.pf-quote-text', '.sdot', '.pf-pubid', '.pf-rows',
  '.pp-row', '.btn-ic', '.btn-ic-t', '.pf-status-menu', '.pf-menu-title',
  '.pf-menu-label', '.pf-preset', '.pf-preset-t', '.pf-menu-hint',
  '.pf-edit-banner', '.pf-edit-banner-img', '.avatar-pick', '.av-btn',
  '.av-clear', '.pf-pos-row', '.btn-sm', '.btn-sm-t', '.mp-presets',
  '.ap-chip', '.ap-chip-t', '.pf-bio-count', '.bio-input', '.uname-current',
  '.uname-at', '.uname-now', '.uname-wait', '.uname-warn', '.uname-intro',
];
const cssMissing = CSS_CLASSES.filter((c) => !css.includes(c));
ok('todos los estilos nuevos existen en app.css',
  cssMissing.length === 0,
  cssMissing.length ? 'faltan: ' + cssMissing.join(' ') : CSS_CLASSES.length + ' clases');

/* Nada de position:fixed ni z-index (regla NS9): se comprueba fuera de
   los comentarios, porque el propio bloque los menciona. */
const wIdx = css.indexOf('W107: perfil propio');
const block = css.slice(css.lastIndexOf('/*', wIdx))
  .replace(/\/\*[\s\S]*?\*\//g, '');
ok('sin position:fixed ni z-index en el bloque W107',
  !/position:\s*fixed/.test(block) && !/z-index/.test(block));

/* ---------- 6. el port apunta a la misma API que la web ---------- */
const edit = src['MyProfileEditView.vue'] || '';
const uname = src['UsernameView.vue'] || '';
const mine = src['MyProfileView.vue'] || '';
ok('guardar perfil usa PUT /auth/profile',
  edit.includes("'/auth/profile'") && edit.includes("api('PUT'"));
ok('el estado usa PUT /auth/profile',
  mine.includes("'/auth/profile'") && mine.includes("api('PUT'"));
ok('el @usuario usa PUT /auth/username',
  uname.includes("'/auth/username'") && uname.includes("api('PUT'"));
ok('el editor sube media con uploadMedia',
  edit.includes('uploadMedia') && edit.includes('avatar_media_id')
  && edit.includes('banner_media_id'));
ok('validaciones igual que la web (50/300/80)',
  edit.includes('50 caracteres') && edit.includes('300 caracteres')
  && edit.includes('80 caracteres'));

console.log('');
console.log((fail === 0 ? 'OK' : 'HAY FALLOS') + ': ' + pass + ' PASS, '
  + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
