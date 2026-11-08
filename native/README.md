# Foxinix nativo (NativeScript + Vue)

La app nativa de Foxinix. Comparte el **núcleo de lógica** con la web
(`api.js`, `store.js`, `i18n.js`…) y cambia la **capa de plataforma** y las
**vistas**.

## Cómo está organizado

```
native/
├── app/
│   ├── app.ts              punto de entrada
│   ├── App.vue             raíz: decide qué vista se ve según store.route
│   ├── fox.ts              pegamento nativo ↔ núcleo compartido
│   ├── views/              VISTAS NATIVAS (Login, Register, Verify, Shell)
│   ├── app.css             estilos con la marca de Foxinix
│   └── core/               ⚙ GENERADO — no editar a mano
├── tools/
│   └── sync-core.mjs       copia el núcleo de la web a app/core/
├── App_Resources/          iconos y recursos nativos
└── nativescript.config.ts
```

### `app/core/` es generado

La fuente de verdad del núcleo compartido es **`../landing/static/js`** (el
repo de la web). El script `tools/sync-core.mjs`:

1. Parte de los módulos de entrada (`api.js`, `store.js`, `i18n.js`,
   `downloads.js`) y calcula el **cierre de imports** (para no arrastrar las
   vistas HTML).
2. Copia esos módulos a `app/core/`.
3. Sustituye `platform/` por las implementaciones **NativeScript**.
4. Escribe el puente de Vue (`app/core/vue.js`) y el conmutador
   (`app/core/platform/index.js`).

```bash
npm run sync          # regenerar app/core/
npm run sync:check    # verificar que está al día (sale 1 si no)
```

### `platform/` en modo nativo

`app/core/platform/` contiene las implementaciones NS:

| Adaptador | Qué hace en NS |
|---|---|
| `net.js` | `httpModule` de `@nativescript/core` (Response simulada) |
| `storage.js` | `ApplicationSettings` (funciones sueltas en NS 9) |
| `files.js` | `FileSystem` / `knownFolders` |
| `dom.js` | stubs: medidas de `Screen.mainScreen`, foco, diálogo, etc. |
| `images.js` | devuelve la URL original (sin canvas) |
| `media.js` | sin soporte: avisa al usuario |
| `notifications.js` | plugin de notificaciones locales (si está) |
| `cookies.js` | **no hay cookie jar** → el refresh va en el body |

## La sesión en NS

En la web el refresh token viaja en una cookie HttpOnly (`fm_rt`) y el
access token solo vive en memoria. NativeScript **no tiene cookie jar**, así
que la app nativa guarda ambos tokens en `ApplicationSettings` (modo
"legado", el mismo que ya soportaba el servidor) y manda el refresh en el
body del `POST /auth/refresh`.

Eso lo decide `platform/cookies.js` → `api.js` (`applyAuth`).

## Comandos

```bash
npm run sync:check      # ¿app/core/ al día?
npm run build:android   # sincroniza + compila el APK
npm run run:android     # instala y corre en el dispositivo/emulador
```

## Estado actual (Fase 3.3)

 functioning:
- Login, registro y verificación por correo (pantallas nativas).
- El shell muestra la sesión y prueba `GET /users/me`.
- El núcleo compartido (`api`, `store`, `i18n`) funciona tal cual en NS.

 pendiente:
- Lista de chats y conversación (vistas nativas + `realtime.js`).
- Contactos, búsqueda y perfiles.
- Ajustes (varias pestañas).
- Notas de voz (plugin de audio), imágenes, archivos.
- Notificaciones push.

## Requisitos

- Node 18+
- Android SDK (platform 35+, build-tools 35+), JDK 17+
- NativeScript CLI 9 (`npm i -g nativescript`)
