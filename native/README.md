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
│   ├── files.ts            selector de archivos (común)
│   ├── files-picker.*.ts   selector por plataforma (Android SAF / iOS)
│   ├── views/              VISTAS NATIVAS (Login, Register, Verify, Shell)
│   ├── app.css             estilos con la marca de Foxinix
│   └── core/               ⚙ GENERADO — no editar a mano
├── tools/
│   ├── sync-core.mjs       copia el núcleo de la web a app/core/
│   ├── test-core.mjs       prueba del núcleo nativo contra la API real
│   └── fix-ns-cli-gradle.sh  alinea el Gradle del CLI con el de la app
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
| `files.js` | `FileSystem` / `knownFolders` + multipart a mano |
| `dom.js` | stubs: medidas de `Screen.mainScreen`, foco, diálogo, etc. |
| `images.js` | devuelve la URL original (sin canvas) |
| `media.js` | sin soporte: avisa al usuario |
| `notifications.js` | plugin de notificaciones locales (si está) |
| `cookies.js` | **no hay cookie jar** → el refresh va en el body |

## Enviar archivos (imágenes y documentos)

El botón 📎 del compositor abre el **selector del sistema**:

- **Android** (`app/files-picker.android.ts`): intent `ACTION_OPEN_DOCUMENT`
  (el SAF de Android). No pide permiso de almacenamiento: el sistema da
  acceso sólo al archivo elegido. Por eso NO se usa el plugin
  `ui-document-picker` en Android (pide permiso "storage" siempre y en
  Android 13+ ese permiso ya no se concede).
- **iOS** (`app/files-picker.ios.ts`): `UIDocumentPickerViewController` a
  través del plugin `ui-document-picker` (su parte de iOS no pide
  permisos). El webpack mete el plugin **sólo** en el bundle de iOS.

La subida la hace el núcleo compartido, pero el **cuerpo multipart lo arma
la capa de plataforma** (`FileAdapter.buildUploadBody`):

| Plataforma | Cómo se arma el `multipart/form-data` |
|---|---|
| Web | `FormData` del navegador (él pone el boundary) |
| NativeScript | bytes a mano: boundary + `Content-Disposition` + `Content-Type` + archivo + cierre |

El `Content-Type` va como **cabecera** (en NS 9 `http.request` no tiene la
opción `contentType`) y el cuerpo binario se manda como `ArrayBuffer`.

En Android el archivo elegido es una URI `content://`: los bytes se copian
a un temporal con el `ContentResolver` y se leen de ahí (`readPathBytes`).

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

### El CLI de NativeScript y Gradle

El CLI compila cada **plugin con código nativo** en un proyecto Gradle
propio y usa para eso sus defaults (Gradle 7.4.0 + AGP 7.1.2). En NS 9 el
runtime Android ya no es el paquete `@nativescript/android`, así que la
búsqueda de la versión de Gradle falla y siempre caen en esos defaults: con
el Java 21 de este equipo **no compilan** (y Gradle 7.4.0 tampoco se
descarga: el release v7.4.0 de Gradle tiene los assets con otro nombre).

La app usa Gradle 8.14.3 + AGP 8.12.1 (`platforms/android`), que ya están
descargados. Para que los plugins compilen con la misma cadena de
herramientas:

```bash
sudo bash tools/fix-ns-cli-gradle.sh
```

(Deja una copia del original en `constants.js.orig`; es idempotente.)

## Estado actual (Fase 3.3)

 functioning:
- Login, registro y verificación por correo (pantallas nativas).
- El shell muestra la sesión y prueba `GET /users/me`.
- El núcleo compartido (`api`, `store`, `i18n`) funciona tal cual en NS.
- Lista de chats, conversación, Personas, grupo nuevo, perfil y Ajustes
  (vistas nativas + `realtime.js`).
- Envío de **imágenes y archivos** (selector del sistema + multipart a
  mano): la imagen sube al servidor y el mensaje llega con su media.

 pendiente:
- Mostrar la imagen dentro de la burbuja (hoy sale como etiqueta de texto).
- Notas de voz (plugin de audio).
- Notificaciones push.
- Compilación para iOS (hace falta un Mac).

## Requisitos

- Node 18+
- Android SDK (platform 35+, build-tools 35+), JDK 17+
- NativeScript CLI 9 (`npm i -g nativescript`)
