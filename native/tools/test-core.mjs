/* test-core.mjs — prueba de integración del NÚCLEO NATIVO.
   Corre el núcleo compartido (api/store/i18n) con la capa `platform/`
   en modo NativeScript (con stubs de @nativescript/core) y verifica
   contra la API real de Foxinix:
     1. Login con la API real.
     2. La sesión queda guardada en el almacenamiento del dispositivo.
     3. /users/me funciona con el token.
     4. Al "reiniciar la app" (módulo recargado), la sesión se recupera.
     5. El refresh renueva el access (modo nativo: refresh en el body).
     6. Logout limpio.

   Uso: node --import ./tools/ns-register.mjs tools/test-core.mjs <user> <pw> */

const [USER, PW] = process.argv.slice(2);
if (!USER || !PW) {
  console.log('uso: node --import ./tools/ns-register.mjs tools/test-core.mjs <user> <pw>');
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const API = 'https://api.foxinix.qzz.io';

async function run() {
  /* --- 1. login --- */
  const api = await import('../app/core/api.js');
  const store = await import('../app/core/store.js');
  const cookies = await import('../app/core/platform/cookies.js');
  const storage = await import('../app/core/platform/storage.js');

  ok('NS: no hay cookie jar (modo legado)', cookies.CookieAdapter.supportsCookies() === false);

  const r = await api.api('POST', '/auth/login', { identifier: USER, password: PW });
  ok('login contra la API real', !!(r && r.user), 'user=' + (r && r.user && r.user.username));
  ok('viene el access token', !!(r && r.tokens && r.tokens.access));
  ok('viene el refresh token (para NS)', !!(r && r.tokens && r.tokens.refresh));

  api.applyAuth(r);
  ok('modo legado activo (refresh guardado)', api.session.legacy === true);
  ok('el refresh quedó en memoria', !!api.session.refresh);

  /* --- 2. persistencia en el "dispositivo" --- */
  const raw = storage.StorageAdapter.getItem('fm.session');
  ok('la sesión se guardó en ApplicationSettings', !!raw, raw ? raw.slice(0, 60) + '…' : '');
  const parsed = raw ? JSON.parse(raw) : null;
  ok('guarda el access', !!(parsed && parsed.access));
  ok('guarda el refresh', !!(parsed && parsed.refresh));
  ok('guarda el usuario', !!(parsed && parsed.user && parsed.user.username));

  /* --- 3. /users/me --- */
  const me = await api.api('GET', '/users/me', undefined, { retry401: true });
  ok('GET /users/me con el token', !!(me && me.user), 'user=' + (me && me.user && me.user.username));
  ok('store.user poblado', !!(store.store.user && store.store.user.id));

  /* --- 4. "reinicio de la app": se pierde la memoria, no el disco --- */
  /* El store es un singleton; al reiniciar la app se vacía la memoria y
     se vuelve a leer el almacenamiento del dispositivo. */
  api.session.access = '';
  api.session.refresh = '';
  api.session.user = null;
  store.store.user = null;
  store.store.hasSession = false;
  api.loadSession();
  ok('"reinicio": la sesión se recupera del almacenamiento', !!(store.store.user && store.store.user.id),
    'user=' + (store.store.user && store.store.user.username));
  ok('"reinicio": vuelve el access', !!api.session.access);
  ok('"reinicio": vuelve el refresh (modo NS)', !!api.session.refresh);

  /* --- 5. refresh (renovar el access) --- */
  api.session.access = '';
  await api.refreshTokens();
  ok('refresh con el token en el body (sin cookie)', !!api.session.access,
    'access=' + String(api.session.access).slice(0, 18) + '…');

  const me2 = await api.api('GET', '/users/me', undefined, { retry401: false });
  ok('petición tras el refresh', !!(me2 && me2.user));

  /* --- 6. lista de chats + conversación (el camino de la app nativa) --- */
  const actions = await import('../app/core/actions.js');
  await actions.loadChats();
  ok('GET /chats devuelve la lista', Array.isArray(store.store.chats),
    'n=' + store.store.chats.length);

  /* Para probar la conversación hace falta un chat. Si el usuario de
     prueba no tiene ninguno, se crea un grupo (el creador es miembro
     implícito: no hace falta un segundo usuario). */
  if (!store.store.chats.length) {
    const g = await actions.createGroup('Prueba nativa', []);
    ok('createGroup crea el chat de prueba', !!(g && g.id), 'chat=' + (g && g.id));
  }
  let chatId = store.store.chats.length ? store.store.chats[0].id : 0;
  ok('la lista trae al menos un chat', !!chatId, 'chat=' + chatId);

  if (chatId) {
    await actions.openChat(chatId);
    ok('openChat carga los mensajes', !!store.store.loaded[chatId]);
    ok('store.msgs tiene la conversación', !!(store.store.msgs[chatId]),
      'n=' + ((store.store.msgs[chatId] || []).length));

    const texto = 'zafiro' + Date.now();
    await actions.sendText(chatId, texto);
    const arr = store.store.msgs[chatId] || [];
    const mine = arr.filter((m) => m.body === texto);
    ok('sendText publica el mensaje', mine.length === 1,
      'id=' + (mine[0] && mine[0].id));
    ok('el mensaje quedó en el store', arr.some((m) => m.body === texto));
  }

  /* --- 7. tiempo real (WebSocket por el adaptador de NS) --- */
  const socket = await import('../app/core/platform/socket.js');
  ok('el adaptador de socket existe', !!socket.SocketAdapter);
  ok('el adaptador de socket tiene soporte', socket.SocketAdapter.isSupported() === true);
  const sock = socket.SocketAdapter.create('wss://api.foxinix.qzz.io/ws',
    ['foxinix', 'token-de-prueba'], { 'X-Foxinix-Token': 'token-de-prueba' });
  ok('se abre un socket con la interfaz del navegador',
    !!sock && typeof sock.send === 'function' && typeof sock.close === 'function');
  ok('el socket expone readyState', sock && typeof sock.readyState === 'number');

  /* --- 8. logout --- */
  try { await api.api('POST', '/auth/logout', {}); } catch (e) {}
  api.clearSession();
  ok('logout: sesión borrada', api.session.access === '' && !store.store.hasSession);
  ok('logout: almacenamiento limpio', !storage.StorageAdapter.getItem('fm.session'));

  console.log('');
  console.log(pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}

run().catch((e) => {
  console.error('ERROR:', e && e.message ? e.message : e);
  if (e && e.detail) console.error('detail:', e.detail);
  process.exit(1);
});
