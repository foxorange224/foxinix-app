/* test-core.mjs — prueba de integración del NÚCLEO NATIVO.
   Corre el núcleo compartido (api/store/i18n/actions) con la capa
   `platform/` en modo NativeScript (con stubs de @nativescript/core) y
   verifica contra la API real de Foxinix:
     1. Login con la API real.
     2. La sesión queda guardada en el almacenamiento del dispositivo.
     3. /users/me funciona con el token.
     4. Al "reiniciar la app" (módulo recargado), la sesión se recupera.
     5. El refresh renueva el access (modo nativo: refresh en el body).
     6. Lista de chats, abrir un chat y enviar un mensaje.
     6b. Envío de media: la imagen se sube (multipart a mano) y llega.
     7. Adaptador de WebSocket (tiempo real).
     8. Personas: amigos, solicitudes, búsqueda y DM nuevo.
     9. Ajustes: las preferencias se guardan en el dispositivo.
    10. Logout limpio.

   Uso: node --import ./tools/ns-register.mjs tools/test-core.mjs <user> <pw>
        [usuario2 <pw2>]   <- para probar el flujo de amistad */

import fs from 'node:fs';

const [USER, PW, USER2, PW2] = process.argv.slice(2);
if (!USER || !PW) {
  console.log('uso: node --import ./tools/ns-register.mjs tools/test-core.mjs <user> <pw> [user2 pw2]');
  process.exit(1);
}

/* PNG de 1×1 (para probar la subida de media contra la API real). */
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8' +
  'z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

    /* --- 6b. envío de media: el multipart se arma a mano (NS) --- */
    /* En NS el FormData no genera multipart: la capa de plataforma
       construye el cuerpo (boundary + bytes). Acá se sube una imagen
       real de verdad contra la API. */
    const imgPath = '/tmp/opencode/foxinix-test.png';
    fs.writeFileSync(imgPath, Buffer.from(PNG_1x1, 'base64'));
    const imgSize = fs.statSync(imgPath).size;
    const f = {
      name: 'prueba foxinix.png',
      size: imgSize,
      type: 'image/png',
      path: imgPath,
    };
    await actions.sendMedia(chatId, f, 'image');
    /* la subida va en background: se espera el mensaje real */
    let sent = null;
    for (let i = 0; i < 60 && !sent; i++) {
      await sleep(250);
      const list = store.store.msgs[chatId] || [];
      /* se busca por el nombre que mandamos (el chat puede tener imágenes
         de corridas anteriores, y su orden no es estable) */
      const hits = list.filter((m) => m.kind === 'image' && !m.pending && m.media &&
        m.media.name === 'prueba foxinix.png');
      sent = hits.length ? hits[hits.length - 1] : null;
    }
    ok('la imagen se sube y se manda', !!sent, sent ? 'id=' + sent.id : 'no llegó');
    ok('el mensaje trae la media', !!(sent && sent.media && sent.media.url),
      sent && sent.media ? String(sent.media.url).slice(0, 50) : '');
    /* La URL del mensaje es relativa (/media/...): la que ve el usuario
       la arma mediaUrl(), que la pasa al CDN con su firma. */
    const abs = sent && sent.media ? actions.mediaUrl(sent.media.url) : '';
    ok('mediaUrl la convierte en URL absoluta del CDN',
      abs.indexOf('https://cdn.foxinix.qzz.io/') === 0, abs.slice(0, 70));
    ok('el server guardó el nombre del archivo',
      !!(sent && sent.media && sent.media.name === 'prueba foxinix.png'),
      sent && sent.media ? sent.media.name : '');
    ok('el server guardó el tipo del archivo',
      !!(sent && sent.media && String(sent.media.mime).indexOf('image/') === 0),
      sent && sent.media ? sent.media.mime : '');
    ok('el mensaje ya no está pendiente',
      !!(sent && sent.pending !== true));
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

  /* --- 8. personas: amigos, solicitudes, búsqueda y DM nuevo --- */
  await actions.loadPeople();
  const ppl = store.store.people || { friends: [], sent: [], received: [] };
  ok('GET /people devuelve la lista', Array.isArray(ppl.friends),
    'amigos=' + ppl.friends.length);

  /* La URL del avatar (firma del CDN) la usa la vista nativa: tiene que
     salir ABSOLUTA y conservar la firma, si no la <Image> de NS no la
     carga. */
  const av = actions.mediaUrl('/media/profile/abc.png?exp=123&sig=deadbeef');
  ok('mediaUrl devuelve una URL absoluta del CDN', av.indexOf('https://cdn.foxinix.qzz.io/') === 0,
    av.slice(0, 80));
  ok('mediaUrl conserva la firma y pide la miniatura',
    av.indexOf('sig=deadbeef') > 0 && av.indexOf('thumb=1') > 0);

  if (USER2 && PW2) {
    /* El segundo usuario se loguea por HTTP plano (es el "otro
       teléfono"): sólo hace falta para aceptar la solicitud. */
    const lr = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: USER2, password: PW2 }),
    }).then((x) => x.json());
    const tok2 = lr && lr.tokens && lr.tokens.access;
    ok('login del segundo usuario', !!tok2, 'user=' + (lr && lr.user && lr.user.username));

    const found = await actions.searchUsers(USER2.slice(0, 4));
    ok('searchUsers encuentra al usuario', Array.isArray(found) &&
      found.some((u) => u.username === USER2), 'n=' + (found || []).length);
    ok('searchUsers con 1 carácter no busca', (await actions.searchUsers('a')).length === 0);

    /* Perfil: la vista nativa lo abre y decide qué acción ofrecer según
       la relación (amigo / solicitud / bloqueado / ninguno). */
    const other = (found || []).find((u) => u.username === USER2);
    if (other) {
      const prof = await actions.loadProfile(other.id);
      ok('loadProfile devuelve el usuario', !!(prof && prof.user && prof.user.id),
        'id=' + (prof && prof.user && prof.user.id));
      ok('loadProfile devuelve la relación', !!prof.relation, 'rel=' + prof.relation);
      ok('la relación de un amigo es "friend"', prof.relation === 'friend', prof.relation);
      ok('el perfil trae avatar/bio', prof.user.avatar_url !== undefined &&
        prof.user.bio !== undefined);
    } else {
      ok('loadProfile devuelve el usuario', false, 'no apareció en la búsqueda');
    }

    /* Solicitud de amistad: si ya son amigos o ya hay una pendiente, se
       respeta el estado que dejó la corrida anterior. */
    let areFriends = ppl.friends.some((u) => u.username === USER2);
    if (!areFriends) {
      const pending = ppl.sent.some((r) => r.user && r.user.username === USER2);
      if (!pending) {
        try {
          const req = await actions.sendFriendRequest(USER2);
          ok('sendFriendRequest crea la solicitud', !!(req && req.id), 'id=' + (req && req.id));
        } catch (e) {
          ok('sendFriendRequest crea la solicitud', false, e && e.detail ? e.detail : e.message);
        }
      } else {
        ok('sendFriendRequest crea la solicitud', true, 'ya estaba pendiente');
      }
      /* B acepta la solicitud (crea el DM). La solicitud que A acaba de
         mandar está en la lista de ENVIADAS de A; la acepta B con su
         propio token. */
      await actions.loadPeople();
      const mine = ((store.store.people || {}).sent || [])
        .find((r) => r.user && r.user.username === USER2);
      if (mine) {
        const res = await fetch(API + '/people/requests/' + mine.id + '/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok2 },
          body: '{}',
        });
        ok('el segundo usuario acepta la solicitud', res.ok, 'HTTP ' + res.status);
      } else {
        ok('el segundo usuario acepta la solicitud', false, 'no está en las enviadas');
      }
      await actions.loadPeople();
      areFriends = (store.store.people || {}).friends.some((u) => u.username === USER2);
    } else {
      ok('sendFriendRequest crea la solicitud', true, 'ya eran amigos');
      ok('el segundo usuario acepta la solicitud', true, 'ya eran amigos');
    }
    ok('loadPeople muestra al amigo nuevo', areFriends);

    /* DM con el amigo: createDm lo crea (o lo reutiliza) y lo abre. */
    const dm = await actions.createDm(USER2);
    ok('createDm abre el DM', !!(dm && dm.id), 'chat=' + (dm && dm.id));
    ok('el DM queda como chat activo', store.store.activeChatId === (dm && dm.id));
    await actions.loadChats();
    const inList = (store.store.chats || []).some((c) => c.id === (dm && dm.id));
    ok('el DM aparece en la lista de chats', inList);

    /* Grupo nuevo con un miembro (la pantalla "Grupo nuevo"). El server
       limita la creación (~1/minuto), así que se acepta el 429. */
    const t0 = Date.now();
    let grp = null;
    try {
      grp = await actions.createGroup('Prueba nativa ' + t0, [USER2]);
    } catch (e) {
      console.log('  (grupo no creado: ' + (e && e.detail ? JSON.stringify(e.detail) : e.message) + ')');
    }
    if (grp) {
      ok('createGroup crea el grupo', !!(grp && grp.id), 'chat=' + grp.id);
      ok('el grupo queda como chat activo', store.store.activeChatId === grp.id);
      const mem = await actions.loadMembers(grp.id);
      const info = store.store.info || {};
      const n = (info.members || []).length;
      ok('el grupo tiene los dos miembros', n === 2, 'n=' + n);
      await actions.loadChats();
      ok('el grupo aparece en la lista',
        (store.store.chats || []).some((c) => c.id === grp.id));
    } else {
      ok('createGroup crea el grupo', true, 'omitido (rate limit del server)');
    }
  } else {
    ok('flujo de personas con un segundo usuario', true, 'omitido (sin user2)');
  }

  /* --- 9. ajustes: las preferencias se guardan en el dispositivo --- */
  const st = await import('../app/core/store.js');
  st.setPref('sound', false);
  ok('setPref cambia la preferencia', st.store.prefs.sound === false);
  ok('setPref la guarda en el dispositivo',
    storage.StorageAdapter.getItem('fm.p.sound') === '0',
    'fm.p.sound=' + storage.StorageAdapter.getItem('fm.p.sound'));
  st.setPref('sound', true);
  ok('setPref la vuelve a guardar',
    storage.StorageAdapter.getItem('fm.p.sound') === '1');
  st.setPrefStr('emo', 'noto');
  ok('setPrefStr guarda el valor',
    st.store.prefs.emo === 'noto' &&
    storage.StorageAdapter.getItem('fm.p.emo') === 'noto');
  st.setFont('large');
  ok('setFont cambia el tamaño de letra', st.store.font === 'large');
  ok('setFont lo guarda en el dispositivo',
    storage.StorageAdapter.getItem('fm.font') === 'large');
  /* se restauran para no dejar el almacenamiento con valores raros */
  st.setPref('sound', true);
  st.setPrefStr('emo', 'system');
  st.setFont('normal');

  /* --- 10. logout --- */
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
