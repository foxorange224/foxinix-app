# PROGRESO — Foxinix app nativa (NativeScript 9 + Vue) + web

Última actualización: 2026-11-22
Rama: `main` (W116: el Ausente automático no sobrevive al cierre)

## Estado de los hits (W-números)

| Hit | Contenido | Commits | Tests | CI |
|-----|-----------|---------|-------|-----|
| W108 | Info del chat (ChatInfoView, PinsView, GalleryView, ActSheet) | f13206a + f50c5a5 | 25 PASS / 0 FAIL | verde (capturas 23-25) |
| W109 | Buscar en el chat, Nuevo chat, Solicitud enviada | 9e336bf + c9e2a44 (docs) | 23 PASS / 0 FAIL | verde (capturas 26-31) |
| W110 | Menú chat-more ⋮ (fijar/desfijar, silenciar/activar) | 355d2fc + c9e2a44 (docs) | 9 PASS / 0 FAIL | verde (captura 33) |
| W114 | Renombrar grupo desde chat-more ⋮ | d76c756 + 8717397 (docs) | 10 PASS / 0 FAIL | verde (captura 34) |
| W115 | Política de contraseñas visible y coherente (web + nativa) | `dc3ac38` + `d4f9df3` + `5e903d5` | 24 PASS backend + 12 PASS frontend + 18 PASS nativa | verde (release); capturas canceladas por emulador colgado |
| W116 | El “Ausente” automático no sobrevive al cierre de la app | commit W116 | `server/tests/auto_presence_test.py` (auto, manual y dos pestañas) | prueba real contra servidor local |

Web (landing):
- Mejoras al sitio público: og.png versión `?v=20261119`, sección "Novedades de Foxinix", copyright automático ya en app.js | `97bf422 feat(web): mejoras al sitio público (landing)`
- Favicon corregido: icon.svg tenía viewBox con coordenadas negativas y
  400x400 fijos → se veía pixeleado en la pestaña del navegador. Nuevo
  SVG con viewBox="0 0 100 100", logo centrado, sin dimensiones fijas.
  Aplicado a landing/assets/icon.svg y landing/static/icon.svg.
- Cache-busting: ?v=2 en todos los hrefs de favicon de todas las
  páginas HTML (index, app, login, register, privacy, terms, 404) para
  forzar al navegador a recargar el icono corregido | `ea80821` +
  `894c094 fix(web): favicon pixeleado en la pestaña del navegador`
- W115: el registro fallaba con 422 y "Datos inválidos" porque el
  backend (desde f40e3ad) exige mayúscula/minúscula/número/símbolo y la
  web solo validaba 8 caracteres. Nuevo `landing/static/js/password.js`
  compartido (web + núcleo nativo), pista bajo el campo, validación en
  registro/reset/cambio, `errDetail` muestra el mensaje real de FastAPI
  y la misma política aplica en reset/cambio del servidor. Test nuevo
  `server/tests/password_policy_test.py` + `tests/password_policy_test.mjs`.
  Backend desplegado y verificado en vivo (422 con mensaje claro).
- W115 (fix): la primera versión usaba `\p{Lu}` y la APK nativa crasheaba
  al arrancar ("Invalid property name"); el CI no lo detectaba porque el
  barrido terminaba con código 0. La regla ahora usa
  `toUpperCase`/`toLowerCase`, el símbolo se limita a la puntuación
  habitual y `ci-captura.py` falla ante la pantalla de excepción de
  NativeScript. La web se revalidó en Firefox (débil, sin símbolo y
  fuerte).
- W116: el "Ausente" automático de W98 se quedaba pegado al cerrar la
  pestaña porque `autoAway` sólo vivía en memoria. Ahora el perfil guarda
  `status_auto`: el auto-away lo pone a 1, cualquier cambio manual lo deja
  en 0 y el servidor lo devuelve a `online` cuando se cierra la última
  WebSocket (o al arrancar). Un "Ausente" manual sigue persistiendo. La
  web cancela el auto-away en vuelo al elegir un estado a mano.

Pendientes de hitos: **W112 (llamadas WebRTC)**. (W113 no existe en el plan.)

## Queda por hacer — en orden recomendado

1. **W112: llamadas (WebRTC)** — BLOQUEADO por infraestructura nativa.
   - El núcleo `app/core/call.js` YA existe y está sincronizado con la web
     (1122 líneas, mismas exportaciones: startCall, joinCall, hangupCall,
     acceptCall, toggleMute, toggleCam, etc.).
   - PERO `app/core/platform/media.js` tiene `canCall() = false`,
     `getUserMedia()` = unsupported, `getPeerConnectionCtor()` = null.
     Sin eso, `startCall` no puede obtener cámara/micrófono ni crear
     PeerConnection en el nativo.
   - Requiere agregar soporte WebRTC nativo (plugins de NativeScript para
     getUserMedia + RTCPeerConnection) antes de poder portar la vista de
     llamadas (CallBox nativo) y los ítems "Llamar"/"Videollamada" del
     chat-more ⋮.
   - Décisión: NO hacer medio trabajo. Queda documentado aquí hasta que
     se decida agregar el soporte WebRTC nativo.

2. **Publicar v0.2.6** (prerelease; "Latest" sigue siendo v0.2.2 hasta que el usuario lo pida).
   - Tag v0.2.6 ya existe (apunta a W106, `7ff1bc5`). Los commits W107-W114
     + web landing no están en ningún tag.
   - NO publicar hasta que el usuario lo pida.

3. **Pendientes del usuario** (ya resueltos según el usuario: nota de voz,
   og.png purge, modo desarrollador; iOS falta Mac).

## Reglas del proyecto (mantener)
- Sin Firebase; servicio en primer plano propio (ya existe).
- Todo bajo esquema W-números; un cambio por vez, verificando.
- URLs `/login` `/register` `/app` `/privacy` `/terms` sin barra final.
- La web es la fuente de verdad: donde las decisiones resumidas y el CSS web difieran, manda el CSS web.
- `native/app/core/` es generado por `tools/sync-core.mjs` — NO editar a mano ni commitear.
- CI: `native-smoke.yml` + `native-release-smoke.yml` se disparan con push a `main` en `native/**`.
- No commitear `native/app/core/`.

## Archivos creados/modificados en esta sesión (W116)
- `server/app/db.py` (columna `status_auto` + migración), `server/app/schemas.py`, `server/app/routers/auth.py`, `server/app/routers/ws.py`, `server/app/main.py`
- `landing/static/js/presence.js` (marca `status_auto`, cancela auto-away al elegir estado)
- `landing/static/js/views/components/MeProfileModal.js`, `MeProfileEditModal.js`
- `server/tests/auto_presence_test.py` (nuevo)
- `README.md`, `docs/API.md`, `PROGRESO.md` (este archivo)

## Próxima acción inmediata
1. Probar y desplegar W116 en `/home/FoxOrange/chat-server` (reiniciar `chat-server`).
2. Verificar en vivo con una cuenta de prueba: auto-away → cerrar última pestaña
   → vuelve a En línea; Ausente manual → persiste.
3. Sincronizar el espejo `Foxinix-main` cuando se vaya a publicar (sigue en W106).
4. Publicar v0.2.6 solo cuando el usuario lo pida.
5. W112 sigue bloqueado por WebRTC nativo.
