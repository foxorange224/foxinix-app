/* test-w114-i18n.mjs — comprueba el port de "renombrar grupo" (W114):
   RenameGroupModal. Los textos calcan los de RenameGroupModal.js de la
   web (PATCH /chats/:id {title}, loadChats, toast ok/err).

   También revisa: paridad byte a byte con la web, clases CSS del bloque
   W114, sin position:fixed ni z-index (regla NS9) y señales de W114 en
   ChatView/App.vue/fox.ts.

   No necesita la API ni credenciales (todo es local).

   Uso: node tools/test-w114-i18n.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = path.join(ROOT, 'app');
const WEB = path.join(ROOT, '..', 'landing', 'static', 'js');

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
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- 1. archivos ---------- */
const FILES = [
  ['views', 'RenameGroupModal.vue'],
];
const src = {};
for (const [dir, f] of FILES) {
  const p = path.join(APP, dir, f);
  const exists = fs.existsSync(p);
  ok('existe ' + f, exists);
  if (exists) src[f] = read(p);
}
const appVue = read(path.join(APP, 'App.vue'));
const chat = read(path.join(APP, 'views', 'ChatView.vue'));
const fox = read(path.join(APP, 'fox.ts'));

/* ---------- 2. claves i18n ---------- */
const i18n = read(path.join(APP, 'core', 'i18n.js'));
const webAll = read(path.join(WEB, 'views', 'components', 'RenameGroupModal.js'))
  + '\n' + read(path.join(WEB, 'views', 'chat-shell.js'));

const PARITY = [
  'Renombrar grupo',
  'El nuevo nombre lo verán todos los miembros.',
  'Nombre del grupo',
  'Nombre del grupo (máx. 60)',
  'Guardando…', 'Guardar',
  'Cancelar',
  'Nombre del grupo actualizado',
  'No se pudo cambiar el nombre',
  'Escribe un nombre para el grupo',
];
const i18nMissing = PARITY.filter((k) =>
  !new RegExp("['\"]" + esc(k) + "['\"]\\s*:").test(i18n));
ok('labels del menú en i18n.js',
  i18nMissing.length === 0,
  i18nMissing.length ? 'faltan: ' + i18nMissing.join(' | ')
    : PARITY.length + ' claves');

/* ---------- 3. paridad byte a byte con la web ---------- */
const portAll = src['RenameGroupModal.vue'] || '';
const parityBad = PARITY.filter((k) =>
  !portAll.includes(k) || !webAll.includes(k));
ok('textos byte a byte con RenameGroupModal de la web',
  parityBad.length === 0,
  parityBad.length ? 'difieren/faltan: ' + parityBad.join(' | ')
    : PARITY.length + ' textos');

/* ---------- 4. estilos del bloque W114 ---------- */
const css = read(path.join(APP, 'app.css'));
const CSS_CLASSES = [
  '.rename-head', '.cf-body', '.cf-text', '.group-rename-field',
  '.field-label', '.group-rename-input', '.form-err', '.st-err',
  '.st-err-t', '.m-foot.st-btns',
];
const cssMissing = CSS_CLASSES.filter((c) => !css.includes(c));
ok('clases W114 existen en app.css',
  cssMissing.length === 0,
  cssMissing.length ? 'faltan: ' + cssMissing.join(' ')
    : CSS_CLASSES.length + ' clases');

const wIdx = css.indexOf('W114:');
ok('aparece el bloque W114 en app.css', wIdx >= 0);
const block = css.slice(css.lastIndexOf('/*', wIdx))
  .replace(/\/\*[\s\S]*?\*\//g, '');
ok('sin position:fixed ni z-index en el bloque W114',
  !/position:\s*fixed/.test(block) && !/z-index/.test(block));

/* ---------- 5. señales de W114 ---------- */
ok('App.vue monta RenameGroupModal antes de NativeToasts',
  appVue.indexOf('RenameGroupModal') < appVue.indexOf('NativeToasts')
  && appVue.includes('store.renameGroupId')
  && appVue.includes("store.renameGroupTitle = ''"));
ok('ChatView: renombrar grupo en chat-more (solo owner/admin)',
  chat.includes("label: 'Renombrar grupo'")
  && chat.includes('icon: \'pencil\'')
  && chat.includes('store.renameGroupId = store.activeChatId')
  && chat.includes('store.renameGroupTitle = title.value'));
ok('ChatView: back() cierra renameGroupId primero',
  chat.includes('if (store.renameGroupId)'));
ok('fox.ts: renombrar grupo cede antes de requestSent/newChatOpen/canGoBack',
  fox.includes('store.renameGroupId')
  && fox.indexOf('store.renameGroupId') < fox.indexOf('store.requestSent')
  && fox.indexOf('store.renameGroupId') < fox.indexOf('canGoBack()'));

console.log('');
console.log((fail === 0 ? 'OK' : 'HAY FALLOS') + ': ' + pass + ' PASS, '
  + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
