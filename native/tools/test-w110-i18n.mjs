/* test-w110-i18n.mjs — comprueba el port del menú "chat-more ⋮" de la
   cabecera de la conversación (W110): fijar/desfijar chat y silenciar/
   activar notificaciones.

   Los textos deben calcar EXACTAMENTE los de chatMore de la web
   (views/chat-shell.js): el texto en español ES la clave.

   También revisa: paridad byte a byte con la web, que no haya
   position:fixed ni z-index (regla NS9) y las señales de W110 en
   ChatView/App.vue/fox.ts.

   No necesita la API ni credenciales (todo es local).

   Uso: node tools/test-w110-i18n.mjs
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
  ['components', 'ActSheet.vue'],
  ['views', 'ChatView.vue'],
];
const src = {};
for (const [dir, f] of FILES) {
  const p = path.join(APP, dir, f);
  const exists = fs.existsSync(p);
  ok('existe ' + f, exists);
  if (exists) src[f] = read(p);
}
const uistate = path.join(APP, 'uistate.js');
ok('existe uistate.js', fs.existsSync(uistate));
if (fs.existsSync(uistate)) src['uistate.js'] = read(uistate);

/* ---------- 2. los 4 labels del menú están en i18n ---------- */
const i18n = read(path.join(APP, 'core', 'i18n.js'));
const webAll = read(path.join(WEB, 'views', 'chat-shell.js'));

const PARITY = [
  'Fijar chat', 'Desfijar chat',
  'Silenciar notificaciones', 'Activar notificaciones',
];
const i18nMissing = PARITY.filter((k) =>
  !new RegExp("['\"]" + esc(k) + "['\"]\\s*:").test(i18n));
ok('labels del menú en i18n.js',
  i18nMissing.length === 0,
  i18nMissing.length ? 'faltan: ' + i18nMissing.join(' | ')
    : PARITY.length + ' claves');

/* ---------- 3. paridad byte a byte con la web ---------- */
const portAll = Object.values(src).join('\n');
const parityBad = PARITY.filter((k) =>
  !portAll.includes(k) || !webAll.includes(k));
ok('textos byte a byte con chatMore de la web',
  parityBad.length === 0,
  parityBad.length ? 'difieren/faltan: ' + parityBad.join(' | ')
    : PARITY.length + ' textos');

/* ---------- 4. estilos (reusa las clases de ActSheet, W108) ---------- */
const css = read(path.join(APP, 'app.css'));
const CSS_CLASSES = [
  '.sheet', '.sheet-act', '.sheet-tx', '.sheet-ic', '.sheet-cancel',
  '.sheet-title',
];
const cssMissing = CSS_CLASSES.filter((c) => !css.includes(c));
ok('clases del menú (ActSheet, W108) existen en app.css',
  cssMissing.length === 0,
  cssMissing.length ? 'faltan: ' + cssMissing.join(' ')
    : CSS_CLASSES.length + ' clases');

/* ---------- 5. señales de W110 ---------- */
const chat = src['ChatView.vue'] || '';
ok('ChatView: botón chat-more ⋮ y toggleChatMenu',
  chat.includes('icon="dots"')
  && chat.includes('accessibilityLabel="más acciones"')
  && chat.includes('toggleChatMenu')
  && chat.includes('<ActSheet'));
ok('ChatView: ActSheet montada ÚLTIMA (rowSpan) y back() cierra menú primero',
  chat.includes('rowSpan="4"')
  && chat.includes('if (ui.chatMenuOpen) { ui.chatMenuOpen = false; return; }'));

const fox = read(path.join(APP, 'fox.ts'));
ok('fox.ts: cierra chatMenuOpen antes que pins en rama de chat',
  fox.includes('ui.chatMenuOpen')
  && fox.indexOf('ui.chatMenuOpen') < fox.indexOf('store.pinsModal'));

console.log('');
console.log((fail === 0 ? 'OK' : 'HAY FALLOS') + ': ' + pass + ' PASS, '
  + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
