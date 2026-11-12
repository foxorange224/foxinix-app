/* test-w108-i18n.mjs — comprueba el port del "panel de info del chat"
   (W108): ChatInfoView + modales de fijados/archivos + hoja ActSheet.

   Las vistas nuevas deben usar EXACTAMENTE las mismas claves que la
   web (ChatInfoPanel.js, ui-actions.js y helpers.js): el texto en
   español ES la clave y sólo existe traducción si la clave está en
   core/i18n.js (que es el i18n.js de la web, copiado por
   sync-core.mjs). Las claves SIN traducir están bien sólo si la web
   tampoco las traduce (se comprueba contra los fuentes de la web).

   También revisa: paridad de menús y asks con la web, los
   accessibilityLabel del port, las clases del bloque CSS W108, que el
   bloque no tenga position:fixed ni z-index (regla NS9) y las
   señales de W108 en ChatView/App.vue/fox.ts.

   No necesita la API ni credenciales (todo es local).

   Uso: node tools/test-w108-i18n.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = path.join(ROOT, 'app');
const WEB = path.join(ROOT, '..', 'landing', 'static', 'js');

const FILES = [
  ['views', 'ChatInfoView.vue'],
  ['views', 'PinsView.vue'],
  ['views', 'GalleryView.vue'],
  ['components', 'ActSheet.vue'],
];

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

/* ---------- 1. los archivos existen ---------- */
const src = {};
for (const [dir, f] of FILES) {
  const p = path.join(APP, dir, f);
  const exists = fs.existsSync(p);
  ok('existe ' + f, exists);
  if (exists) src[f] = read(p);
}

/* ---------- 2. claves t('…') presentes en core/i18n.js ---------- */
const i18n = read(path.join(APP, 'core', 'i18n.js'));

/* Fuentes de la web: donde viven los textos sin traducir. */
const webFiles = [
  'views/ui-actions.js', 'views/helpers.js',
  'views/components/ChatInfoPanel.js', 'store.js',
].map((f) => path.join(WEB, f)).filter((p) => fs.existsSync(p));
const webAll = webFiles.map(read).join('\n');

/* Claves estáticas: t('texto'). Las dinámicas (t(it.label), t(sec.label))
   no se pueden resolver acá: esas van en DYN, más abajo. */
const KEY_RE = /\bt\(\s*'((?:[^'\\]|\\.)+)'/g;

const allKeys = new Set();
for (const f of Object.keys(src)) {
  for (const m of (src[f] || '').matchAll(KEY_RE)) allKeys.add(m[1]);
}

ok('hay claves estáticas en los archivos', allKeys.size >= 25,
  allKeys.size + ' claves');

/* Toda clave debe estar traducida en i18n.js, o bien ser un texto que
   la web también deja sin traducir (paridad: se ve igual en ambos). */
const untranslated = [];
const notAnywhere = [];
for (const k of allKeys) {
  const inI18n = new RegExp("['\"]" + esc(k) + "['\"]\\s*:").test(i18n);
  if (inI18n) continue;
  if (webAll.includes("'" + k + "'") || webAll.includes('"' + k + '"')) {
    untranslated.push(k);
  } else {
    notAnywhere.push(k);
  }
}
ok('toda clave está en i18n.js o sin traducir también en la web',
  notAnywhere.length === 0,
  notAnywhere.length
    ? 'huérfanas: ' + notAnywhere.slice(0, 5).join(' | ')
    : allKeys.size + ' claves'
      + (untranslated.length
        ? ' (' + untranslated.length + ' sin traducir en ambos: '
          + untranslated.slice(0, 4).join(' | ') + ')'
        : ''));

/* ---------- 3. claves dinámicas (menús, asks, avisos) ---------- */
/* Los menús se arman con el label EN español (lo traduce ActSheet en el
   render, como CtxMenu); los asks y avisos son los textos exactos de
   helpers.js / ui-actions.js de la web. */
const DYN = [
  /* menús: chatInfoMenu / chatMenu / memberMenu de la web */
  'Abrir chat', 'Ver info del chat', 'Cambiar foto del grupo',
  'Salir del grupo', 'Ver perfil', 'Fijar chat', 'Desfijar chat',
  'Activar notificaciones', 'Silenciar notificaciones',
  'Archivar chat', 'Desarchivar chat',
  'Hacer admin', 'Quitar admin', 'Transferir propiedad',
  'Eliminar del grupo',
  /* asks (helpers.js) — textos completos (\\n = el escape literal
     de ambas fuentes) */
  'Vas a salir de "{n}".\\nEste chat se borra de tu lista y no vas a recibir más mensajes. Puedes volver si alguien te vuelve a agregar.',
  '¿Hacer admin a {n}? Podrá administrar el grupo y todos verán el aviso en el chat.',
  '¿Quitar admin a {n}? Ya no podrá administrar el grupo y todos verán el aviso en el chat.',
  '{n} ahora es admin', '{n} ya no es admin',
  '¿Transferir la propiedad de este grupo a {n}? Tú pasarás a ser admin y {n} podrá administrar el grupo.',
  'La propiedad pasó a {n}',
  '¿Eliminar a {n} del grupo? Dejará de ver el chat y todos verán el aviso de la expulsión.',
  '{n} fue eliminado del grupo',
  'No se pudo completar la acción', 'Cancelar',
  /* avisos y errores (ui-actions.js / ChatInfoPanel.js) */
  'Elige una imagen', 'La imagen supera los 15 MB',
  'Foto del grupo actualizada', 'No se pudo subir la foto',
  'Enlace de invitación activado', 'Enlace de invitación desactivado',
  'No se pudo cambiar el ajuste',
  'No se pudo copiar el texto', 'Enlace copiado',
  'Chat archivado', 'Chat desarchivado', 'No se pudo archivar el chat',
];

const dynMissing = DYN.filter((k) => {
  const inI18n = new RegExp("['\"]" + esc(k) + "['\"]").test(i18n);
  if (inI18n) return false;
  return !(webAll.includes("'" + k + "'") || webAll.includes('"' + k + '"'));
});
ok('claves dinámicas (menús/asks/avisos) presentes',
  dynMissing.length === 0,
  dynMissing.length ? 'faltan: ' + dynMissing.slice(0, 5).join(' | ')
    : DYN.length + ' claves');

/* ---------- 4. paridad byte a byte con la web ---------- */
const webActions = read(path.join(WEB, 'views', 'ui-actions.js'));
const webHelpers = read(path.join(WEB, 'views', 'helpers.js'));
const webPanel = read(path.join(WEB, 'views', 'components', 'ChatInfoPanel.js'));

/* Los menús nativos usan los MISMOS textos que la web. */
const MENU = [
  'Abrir chat', 'Ver info del chat', 'Cambiar foto del grupo',
  'Salir del grupo', 'Ver perfil', 'Fijar chat', 'Desfijar chat',
  'Activar notificaciones', 'Silenciar notificaciones',
  'Archivar chat', 'Desarchivar chat',
  'Hacer admin', 'Quitar admin', 'Transferir propiedad',
  'Eliminar del grupo',
];
const nativeMenus = (src['ChatInfoView.vue'] || '');
const menuBad = MENU.filter((k) =>
  !nativeMenus.includes("'" + k + "'")
  || !(webActions.includes("'" + k + "'")
    || webPanel.includes("'" + k + "'")));
ok('los menús coinciden con ui-actions.js/ChatInfoPanel.js',
  menuBad.length === 0,
  menuBad.length ? 'difieren: ' + menuBad.join(' | ')
    : MENU.length + ' ítems (sin "Renombrar grupo": es W114)');

/* Los asks van textualmente iguales a helpers.js. */
const ASKS = [
  'Salir del grupo',
  'Vas a salir de "{n}".\\nEste chat se borra de tu lista y no vas a recibir más mensajes. Puedes volver si alguien te vuelve a agregar.',
  '¿Hacer admin a {n}? Podrá administrar el grupo y todos verán el aviso en el chat.',
  '¿Quitar admin a {n}? Ya no podrá administrar el grupo y todos verán el aviso en el chat.',
  '¿Transferir la propiedad de este grupo a {n}? Tú pasarás a ser admin y {n} podrá administrar el grupo.',
  '¿Eliminar a {n} del grupo? Dejará de ver el chat y todos verán el aviso de la expulsión.',
  '{n} fue eliminado del grupo', 'La propiedad pasó a {n}',
];
const askBad = ASKS.filter((k) =>
  !nativeMenus.includes(k) || !webHelpers.includes(k));
ok('los asks son byte a byte de helpers.js',
  askBad.length === 0,
  askBad.length ? 'difieren: ' + askBad.slice(0, 3).join(' | ')
    : ASKS.length + ' texts');

/* El toastErr del port = humanError(err || {detail: fallback}). */
ok('avisos con el fallback de la web',
  nativeMenus.includes("humanError(err || { detail: 'No se pudo subir la foto' })")
  && nativeMenus.includes("humanError(err || { detail: 'No se pudo cambiar el ajuste' })")
  && nativeMenus.includes("humanError(err || { detail: 'No se pudo archivar el chat' })"));

/* ---------- 5. accessibilityLabel del port ---------- */
const A11Y = [
  ['ChatInfoView.vue', ['Administrar', 'close info', 'pins access',
    'gallery access', 'member menu', 'Cambiar foto del grupo',
    'Enlace de invitación', 'Copiar enlace']],
  ['PinsView.vue', ['close pins', 'pin row']],
  ['GalleryView.vue', ['close gallery', 'file row']],
  ['ActSheet.vue', ['close menu']],
];
for (const [f, labels] of A11Y) {
  const s = src[f] || '';
  const missing = labels.filter((l) => !s.includes('accessibilityLabel="' + l + '"'));
  ok('labels en ' + f, missing.length === 0,
    missing.length ? 'faltan: ' + missing.join(' | ') : labels.length + ' labels');
}
const chat = read(path.join(APP, 'views', 'ChatView.vue'));
ok('cabecera con botón de info (chat info)',
  chat.includes('accessibilityLabel="chat info"')
  && chat.includes('toggleInfo') && chat.includes('<ChatInfoView'));

/* ---------- 6. estilos del bloque W108 ---------- */
const css = read(path.join(APP, 'app.css'));
const CSS_CLASSES = [
  '.pp-panel', '.pp-head', '.pp-title', '.pp-more', '.pf-banner',
  '.pf-body', '.ci-idrow', '.ci-quote', '.ci-quote-t', '.ci-idbelow',
  '.pp-bio', '.pp-rows', '.pp-body.pp-left', '.grp-av', '.grp-av-btn',
  '.mi-head', '.mi-head-t', '.mi-head-s', '.mi-head-on', '.mi-sec',
  '.mi-row', '.mi-col', '.mi-name', '.mi-me', '.mi-role', '.mi-sub',
  '.mi-more', '.ci-typing', '.ci-dot', '.gi-body', '.gi-tgl-row',
  '.gi-link', '.gi-link-i', '.pp-acts', '.pp-pinhead', '.pp-pinhead-t',
  '.pp-ncount', '.pp-chev', '.pp-loading', '.modal-veil', '.modal ',
  '.pp-modal-head', '.pp-modal-t', '.pp-modal-i', '.pp-mbody',
  '.pp-pinrow', '.pp-pinrow-t', '.pp-pinrow-s', '.pp-galgrid',
  '.pp-galimg', '.gal-spoil', '.sheet-title',
];
const cssMissing = CSS_CLASSES.filter((c) => !css.includes(c));
ok('todas las clases W108 existen en app.css',
  cssMissing.length === 0,
  cssMissing.length ? 'faltan: ' + cssMissing.join(' ')
    : CSS_CLASSES.length + ' clases');

/* Nada de position:fixed ni z-index (regla NS9): fuera de comentarios,
   porque el propio bloque los menciona. */
const wIdx = css.indexOf('W108: panel');
ok('aparece el bloque W108 en app.css', wIdx >= 0);
const block = css.slice(css.lastIndexOf('/*', wIdx))
  .replace(/\/\*[\s\S]*?\*\//g, '');
ok('sin position:fixed ni z-index en el bloque W108',
  !/position:\s*fixed/.test(block) && !/z-index/.test(block));

/* Los giros del sprite (web: rotate en el SVG) van en la raíz. */
ok('giros: pp-more/mi-more 90° y pp-chev −90°',
  /\.pp-more\s*\{[^}]*transform:\s*rotate\(90deg\)/.test(block)
  && /\.mi-more\s*\{[^}]*transform:\s*rotate\(90deg\)/.test(block)
  && /\.pp-chev\s*\{[^}]*transform:\s*rotate\(-90deg\)/.test(block));

/* ---------- 7. señales de W108 en la navegación ---------- */
const appVue = read(path.join(APP, 'App.vue'));
ok('App.vue monta ProfileView ANTES que ChatView',
  appVue.indexOf("view === 'profile'") < appVue.indexOf('ChatView v-else-if'),
  'goProfile desde la info se ve con el chat abierto');

const fox = read(path.join(APP, 'fox.ts'));
ok('fox.ts cierra por capas (pines → galería → info)',
  fox.includes('store.pinsModal') && fox.includes('store.galModal')
  && fox.includes('store.infoOpen'));

ok('ChatView: stick + salto + filas medidas',
  chat.includes('const stick') && chat.includes('tryJump')
  && chat.includes('setRowEl') && chat.includes('@scroll="onScroll"')
  && chat.includes('loadOlder'));
ok('ChatView: al enviar vuelve al final (stick)',
  chat.split('stick.value = true').length >= 4);
ok('ChatView: back() cierra modales antes que el chat',
  chat.includes('if (store.pinsModal)') && chat.includes('if (store.galModal)')
  && chat.includes('if (store.infoOpen)'));
ok('portadas con la clase pf-banner (borde de la web)',
  (src['ChatInfoView.vue'] || '').includes('class="pf-banner"')
  && read(path.join(APP, 'views', 'MyProfileView.vue'))
    .includes('class="pf-banner"'));

console.log('');
console.log((fail === 0 ? 'OK' : 'HAY FALLOS') + ': ' + pass + ' PASS, '
  + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
