/* test-w109-i18n.mjs — comprueba el port de "buscar en el chat",
   "nuevo chat" y "solicitud enviada" (W109): SearchChatModal,
   NewChatModal y RequestSentModal.

   Las vistas nuevas deben usar EXACTAMENTE las mismas claves que la
   web (SearchModal.js, NewChatModal.js, RequestSentModal.js): el texto
   en español ES la clave y sólo existe traducción si la clave está en
   core/i18n.js (copiado de la web por sync-core.mjs).

   También revisa: paridad byte a byte con la web, las clases del bloque
   CSS W109, que el bloque no tenga position:fixed ni z-index (regla
   NS9) y las señales de W109 en ChatView/App.vue/fox.ts.

   No necesita la API ni credenciales (todo es local).

   Uso: node tools/test-w109-i18n.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = path.join(ROOT, 'app');
const WEB = path.join(ROOT, '..', 'landing', 'static', 'js');

const FILES = [
  ['views', 'SearchChatModal.vue'],
  ['views', 'NewChatModal.vue'],
  ['views', 'RequestSentModal.vue'],
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
  'views/components/SearchModal.js',
  'views/components/NewChatModal.js',
  'views/components/RequestSentModal.js',
  'views/chat-shell.js',
].map((f) => path.join(WEB, f)).filter((p) => fs.existsSync(p));
const webAll = webFiles.map(read).join('\n');

/* Claves estáticas: t('texto'). */
const KEY_RE = /\bt\(\s*'((?:[^'\\]|\\.)+)'/g;

const allKeys = new Set();
for (const f of Object.keys(src)) {
  for (const m of (src[f] || '').matchAll(KEY_RE)) allKeys.add(m[1]);
}

ok('hay claves estáticas en los archivos', allKeys.size >= 20,
  allKeys.size + ' claves');

/* Toda clave debe estar traducida en i18n.js, o bien ser un texto que
   la web también deja sin traducir. */
const notAnywhere = [];
for (const k of allKeys) {
  const inI18n = new RegExp("['\"]" + esc(k) + "['\"]\\s*:").test(i18n);
  if (inI18n) continue;
  if (webAll.includes("'" + k + "'") || webAll.includes('"' + k + '"')) continue;
  notAnywhere.push(k);
}
ok('toda clave está en i18n.js o también en la web',
  notAnywhere.length === 0,
  notAnywhere.length
    ? 'huérfanas: ' + notAnywhere.slice(0, 5).join(' | ')
    : allKeys.size + ' claves');

/* ---------- 3. paridad byte a byte con la web ---------- */
/* Textos que el port debe calcar exactamente de la web. */
const PARITY = [
  'Buscar en el chat', 'Buscar mensajes',
  'Escribe para buscar en los mensajes de este chat.',
  'Sin resultados.', 'Buscando…', 'No se pudo buscar', 'Spoiler',
  'Nuevo chat', 'Nuevo grupo', 'Agregar al grupo', 'Chat', 'Grupo',
  'Nombre del grupo (máx. 60)', 'Buscar por nombre o usuario…',
  'Solicitud pendiente', 'Aceptar solicitud', 'Enviar solicitud',
  'Ya enviaste una solicitud a @{n}', 'Solicitud aceptada',
  'No se pudo aceptar la solicitud', 'No se pudo enviar la solicitud',
  'No se pudo crear el chat', 'Escribe un nombre para el grupo',
  'Solicitud enviada.',
  'Se ha enviado solicitud a @{n}',
  'Espera a que acepte, podés ir a la sección',
  'Solicitudes', 'Okey', 'Escribe al menos 2 letras',
  'Crear grupo',
];
const portAll = Object.values(src).join('\n');
/* La web arma estos componentes con concatenación de strings, así que
   el texto aparece como \'…\' (comilla escapada) y no como '…'. Se
   compara el texto plano (la clave t() es la misma en ambos). */
const parityBad = PARITY.filter((k) =>
  !portAll.includes(k) || !webAll.includes(k));
ok('textos byte a byte con la web',
  parityBad.length === 0,
  parityBad.length ? 'difieren/faltan: ' + parityBad.join(' | ')
    : PARITY.length + ' textos');

/* ---------- 4. estilos del bloque W109 ---------- */
const css = read(path.join(APP, 'app.css'));
const CSS_CLASSES = [
  '.newchat', '.m-tabs', '.m-tab', '.m-tab.on', '.m-title-input',
  '.m-search', '.m-search-input', '.results', '.ri-check',
  '.res-empty.dim', '.sp-body', '.sp-res', '.sp-res:pressed',
  '.spr-top', '.spr-name', '.spr-time', '.spr-text', '.sp-empty',
  '.req-sent-head', '.m-head-title', '.req-sent-body',
  '.req-sent-check', '.req-sent-lead', '.req-sent-wait',
  '.req-sent-foot', '.req-ok', '.msg.flash .bubble',
];
const cssMissing = CSS_CLASSES.filter((c) => !css.includes(c));
ok('todas las clases W109 existen en app.css',
  cssMissing.length === 0,
  cssMissing.length ? 'faltan: ' + cssMissing.join(' ')
    : CSS_CLASSES.length + ' clases');

/* token --accent-wash en los tres temas */
ok('token --accent-wash en fox-dark/light/black',
  /\.fox-dark\s*\{[\s\S]*?--accent-wash/.test(css)
  && /\.fox-light\s*\{[\s\S]*?--accent-wash/.test(css)
  && /\.fox-black\s*\{[\s\S]*?--accent-wash/.test(css));

/* Nada de position:fixed ni z-index (regla NS9): fuera de comentarios. */
const wIdx = css.indexOf('W109:');
ok('aparece el bloque W109 en app.css', wIdx >= 0);
const block = css.slice(css.lastIndexOf('/*', wIdx))
  .replace(/\/\*[\s\S]*?\*\//g, '');
ok('sin position:fixed ni z-index en el bloque W109',
  !/position:\s*fixed/.test(block) && !/z-index/.test(block));

/* ---------- 5. señales de W109 en la navegación ---------- */
const chat = read(path.join(APP, 'views', 'ChatView.vue'));
ok('ChatView: búsqueda y agregar miembro en la cabecera',
  chat.includes('accessibilityLabel="buscar en el chat"')
  && chat.includes('toggleSearch')
  && chat.includes('accessibilityLabel="agregar miembro"')
  && chat.includes('openAddMember'));
ok('ChatView: monta SearchChatModal con @jump',
  chat.includes('<SearchChatModal') && chat.includes('@jump="onSearchJump"'));
ok('ChatView: onSearchJump (before_seq + mergeMessages + flash)',
  chat.includes('before_seq=') && chat.includes('mergeMessages')
  && chat.includes('scrollToMsg(m.id, true)'));
ok('ChatView: back() cierra la búsqueda antes que el chat',
  chat.includes('if (store.searchOpen)'));
ok('ChatView: onUnmounted apaga searchOpen',
  chat.includes('store.searchOpen = false') && chat.includes('onUnmounted'));

const appVue = read(path.join(APP, 'App.vue'));
ok('App.vue monta NewChatModal y RequestSentModal antes de NativeToasts',
  appVue.indexOf('NewChatModal') < appVue.indexOf('NativeToasts')
  && appVue.indexOf('RequestSentModal') < appVue.indexOf('NativeToasts'));
ok('App.vue: watch requestsJump → peopleTab + closeChat + goView(people)',
  appVue.includes('store.requestsJump')
  && appVue.includes("store.peopleTab = 'req'")
  && appVue.includes('closeChat()')
  && appVue.includes("goView('people')"));

const fox = read(path.join(APP, 'fox.ts'));
ok('fox.ts: requestSent y newChatOpen antes de canGoBack',
  fox.indexOf('store.requestSent') < fox.indexOf('canGoBack()')
  && fox.indexOf('store.newChatOpen') < fox.indexOf('canGoBack()'));
ok('fox.ts: searchOpen antes de pins en la rama de chat',
  fox.indexOf('store.searchOpen') < fox.indexOf('store.pinsModal'));

const people = read(path.join(APP, 'views', 'PeopleView.vue'));
ok('PeopleView: tab es computed sobre store.peopleTab',
  people.includes('const tab = computed(() => store.peopleTab)'));
ok('PeopleView: pestañas escriben store.peopleTab',
  people.includes("store.peopleTab = 'active'")
  && people.includes("store.peopleTab = 'req'"));
ok('PeopleView: CTA "Buscar personas" en pestaña req',
  people.includes("t('Buscar personas')"));

const chatList = read(path.join(APP, 'views', 'ChatListView.vue'));
ok('ChatListView: ＋ es "new chat" y llama startNewChat',
  chatList.includes('accessibilityLabel="new chat"')
  && chatList.includes('@tap="startNewChat"')
  && chatList.includes('store.newChatMode = \'dm\'')
  && chatList.includes('store.newChatOpen = true'));

console.log('');
console.log((fail === 0 ? 'OK' : 'HAY FALLOS') + ': ' + pass + ' PASS, '
  + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
