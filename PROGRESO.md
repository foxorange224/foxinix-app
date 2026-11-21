# PROGRESO — Foxinix app nativa (NativeScript 9 + Vue) + web

Última actualización: 2026-11-21
Rama: `main` (W115 con arreglo de compatibilidad nativa; CI al publicar)

## Estado de los hits (W-números)

| Hit | Contenido | Commits | Tests | CI |
|-----|-----------|---------|-------|-----|
| W108 | Info del chat (ChatInfoView, PinsView, GalleryView, ActSheet) | f13206a + f50c5a5 | 25 PASS / 0 FAIL | verde (capturas 23-25) |
| W109 | Buscar en el chat, Nuevo chat, Solicitud enviada | 9e336bf + c9e2a44 (docs) | 23 PASS / 0 FAIL | verde (capturas 26-31) |
| W110 | Menú chat-more ⋮ (fijar/desfijar, silenciar/activar) | 355d2fc + c9e2a44 (docs) | 9 PASS / 0 FAIL | verde (captura 33) |
| W114 | Renombrar grupo desde chat-more ⋮ | d76c756 + 8717397 (docs) | 10 PASS / 0 FAIL | verde (captura 34) |
| W115 | Política de contraseñas visible y coherente (web + nativa) | commit W115 + fix de compatibilidad (esta sesión) | 24 PASS backend + 12 PASS frontend + 18 PASS nativa | E2E real Firefox OK; CI pendiente tras el fix |

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

## Archivos creados/modificados en esta sesión (W115 + web landing)
- `landing/static/js/password.js` (nuevo: regla compartida web/nativa)
- `landing/static/js/views/auth.js`, `landing/static/js/views/components/SettingsModal.js`, `landing/static/js/api.js`, `landing/static/js/i18n.js`, `landing/sw.js`
- `server/app/schemas.py` (política única, aplicada a registro/reset/cambio) — desplegado en `/home/FoxOrange/chat-server/app/schemas.py` y `chat-server` reiniciado
- `native/app/views/RegisterView.vue`, `native/tools/sync-core.mjs`
- `server/tests/password_policy_test.py` (nuevo), `tests/password_policy_test.mjs` (nuevo)
- Tests actualizados con contraseñas válidas: `tests/web_e2e.py`, `tests/chat_ui_test.py`, `tests/w6_ui_test.py`, `tests/w11_smoke.py`, `tests/w13_smoke.py`, `tests/w13_ui_test.py`, `tests/w59_test.py`, `tests/w65_test.py`, `server/tests/e2e.sh`, `server/tests/ws_test.py`
- `README.md`, `native/README.md`, `docs/API.md`, `PROGRESO.md` (este archivo)

## Próxima acción inmediata
1. Pushear el fix de W115 y vigilar el CI: al tocar `native/**`, se
   lanzan `native-smoke` y `native-release-smoke` (APK debug/release +
   capturas). El smoke ahora falla si la app crashea.
2. Sincronizar el espejo `Foxinix-main` cuando se vaya a publicar (sigue en
   W106): incluye favicon, novedades, og.png y W115.
3. Publicar v0.2.6 solo cuando el usuario lo pida.
4. W112 sigue bloqueado por WebRTC nativo.
