# PROGRESO — Foxinix app nativa (NativeScript 9 + Vue) + web

Última actualización: 2026-11-19
Rama: `main` (limpia, todo commiteado y pusheado)

## Estado de los hits (W-números)

| Hit | Contenido | Commits | Tests | CI |
|-----|-----------|---------|-------|-----|
| W108 | Info del chat (ChatInfoView, PinsView, GalleryView, ActSheet) | f13206a + f50c5a5 | 25 PASS / 0 FAIL | verde (capturas 23-25) |
| W109 | Buscar en el chat, Nuevo chat, Solicitud enviada | 9e336bf + c9e2a44 (docs) | 23 PASS / 0 FAIL | verde (capturas 26-31) |
| W110 | Menú chat-more ⋮ (fijar/desfijar, silenciar/activar) | 355d2fc + c9e2a44 (docs) | 9 PASS / 0 FAIL | verde (captura 33) |
| W114 | Renombrar grupo desde chat-more ⋮ | d76c756 + 8717397 (docs) | 10 PASS / 0 FAIL | verde (captura 34) |

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

## Archivos creados/modificados en esta sesión (W110 + W114 + web landing)
- `native/app/views/RenameGroupModal.vue`, `native/tools/test-w114-i18n.mjs` (W114)
- `native/app/views/ChatView.vue`, `native/app/fox.ts`, `native/app/App.vue`, `native/app/uistate.js`, `native/app/app.css`, `native/tools/ci-captura.py`, `native/tools/test-w109-i18n.mjs`, `native/tools/test-w110-i18n.mjs`, `native/tools/test-w114-i18n.mjs` (W110+W114)
- `README.md`, `native/README.md` (docs W109-W114)
- `landing/index.html` (web: og.png + sección novedades)
- `PROGRESO.md` (este archivo)

## Próxima acción inmediata
Esperar confirmación del usuario para:
a) Crear tag v0.2.6 + release de GitHub (publicar).
b) Decidir sobre W112 (requiere trabajo de infraestructura WebRTC nativo grande).
c) Seguir con mejoras a la web (otra sección, funcionalidad, etc.).
