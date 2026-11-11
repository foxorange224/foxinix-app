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
│   ├── notifier.ts         avisos del sistema (plugin de notificaciones)
│   ├── service.ts          servicio en primer plano (WS vivo en 2º plano)
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

## Avisos del sistema (W100)

En NS no existe la `Notification` del navegador, así que los avisos de
mensajes nuevos los hace el plugin **`@nativescript/local-notifications`**
(7.0.0) desde `app/notifier.ts`:

```
realtime.js  ──NotificationAdapter.notify()──▶  notifier.ts  ──▶  aviso del sistema
     ▲                                                                    │
     └── el aviso lleva chatId + msgId en el payload ──── al tocar ──────┘
                                    (abre el chat y el mensaje exactos)
```

- **Cuándo avisa**: el núcleo sólo avisa si la app está en segundo plano.
  En NS eso es el evento `Application.suspendEvent` (lo lleva
  `platform/nativescript/dom.js`: `getHidden()`), no una pestaña oculta.
- **Permiso**: `POST_NOTIFICATIONS` (Android 13+). Se pide **una vez** al
  arrancar, después de iniciar sesión; si el usuario lo deniega, Ajustes →
  Avisos muestra el estado y deja volver a pedirlo o abrir los ajustes del
  sistema. En Android < 13 no hay diálogo (el permiso va incluido).
- **El aviso**: canal "Foxinix", icono de la marca (`ic_stat_notify`, la
  cabeza de zorro en blanco), título con el remitente (y el grupo) y el
  texto del mensaje. El sonido sale si el usuario tiene "Sonido al
  recibir" activado (en NS no hay Web Audio: lo pone el aviso).
- **Al tocarlo**: el id del chat y del mensaje viajan en el `payload` de la
  notificación y se abren con `openNotificationTarget()` (el mismo camino
  que la web). Si la app estaba cerrada, el destino se resuelve cuando la
  lista de chats está lista.

> **Limitación**: el aviso sale cuando el proceso recibe el mensaje por el
> WebSocket. Con el servicio en primer plano (W101, más abajo) el proceso
> no se congela con la app en segundo plano, así que el socket sigue vivo
> y el aviso llega. Lo que **no** hay es push remoto (FCM/APNs): si el
> usuario cierra la app a la fuerza y el sistema no la levanta, no llega
> nada (ni con el servicio: Android lo mata si el usuario la arrastra
> fuera).

## Servicio en primer plano (W101)

Sin Firebase, el WebSocket de la app nativa vive en el runtime de
JavaScript: si Android congela o mata el proceso con la app en segundo
plano, el socket se cae y no llega ningún aviso.

La solución es un **servicio en primer plano** propio:

- `App_Resources/Android/src/main/java/io/foxinix/app/FoxinixService.java`
  (`START_STICKY`: si Android mata el proceso, el sistema vuelve a
  levantar el servicio y con él la conexión).
- `app/service.ts` lo arranca cuando la app va al segundo plano
  (`Application.suspendEvent`) y lo para cuando vuelve
  (`Application.resumeEvent`): en primer plano el proceso vive por sí
  solo y el aviso persistente del servicio sobraría.
- El intent es **explícito** (`ComponentName`), así que la clase Java no
  hace falta que esté expuesta al runtime de JS.

Requisitos de Android 14+ (API 34), que ya van en el manifest:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>
...
<service android:name="io.foxinix.nativa.FoxinixService"
         android:exported="false"
         android:foregroundServiceType="specialUse">
    <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
              android:value="keep_messaging_connection_alive" />
</service>
```

`specialUse` es el tipo que corresponde a "mantener una conexión de
mensajería viva" (no hay un tipo estándar para eso; `dataSync` tendría un
límite de 6 h por día en Android 15). El aviso del servicio va en un canal
de importancia **BAJA**: sale silencioso, sin vibración y sin insignias.

> Con `targetSdk` 36, Google Play exige justificar el uso de
> `specialUse`; para el APK firmado que se distributes a mano no hace
> falta nada extra.

## La imagen dentro de la burbuja (W102)

Antes, en la app nativa, un mensaje con imagen se veía como el texto
"🖼 Imagen". Ahora la imagen **se ve dentro de la burbuja**:

- `app/img.ts` decide qué es una imagen (`isImageMsg`), qué URL se pide
  (`imageUrl`) y de qué tamaño es la caja (`imageBox`). Vive fuera de la
  vista para poder probarlo en Node (`tools/test-core.mjs`).
- La burbuja (`app/views/ChatView.vue`) pide la **miniatura** del servidor
  (`?thumb=1`): pesa mucho menos y a ese tamaño se ve igual. La firma
  HMAC cubre sólo el slug del archivo, así que añadir `?thumb=1` no la
  invalida (comprobado contra el CDN real: HTTP 200 con la firma puesta).
- La caja conserva la **proporción real** que manda el servidor
  (`media.width` / `media.height`), con un tope de 220×300 DIPs; si la
  imagen no trae resolución (mensajes viejos) sale una caja cuadrada.
- Al tocarla se abre el **visor a pantalla completa**
  (`app/views/MediaViewer.vue`), que carga el **original** y muestra el pie
  de foto. Es una vista nativa propia: en `App.vue` se enruta **antes** que
  el chat, porque cuando se abre desde la burbuja el chat sigue activo y el
  visor debe taparlo.
- La navegación es la pila propia de `app/nav.ts` (`openMedia()` / `back()`);
  no hay URL (en NS no existe el historial del navegador).

```
ChatView.vue ──imageUrl(m, true)──▶ miniatura (?thumb=1) en la burbuja
      │ tap
      ▼
nav.openMedia(url) ──▶ MediaViewer.vue ──imageUrl(m, false)──▶ original
```

## Acciones del mensaje (W105)

En la web el menú del mensaje se ancla a la burbuja (clic derecho) o sale
de la barrita flotante (⋯). En el móvil lo natural es **mantener pulsado**
el mensaje: sale una **hoja pegada abajo**, como en WhatsApp o Telegram.

- **La hoja** (`app/components/MsgSheet.vue`): las 12 reacciones rápidas de
  la web (`emoji.js`: 👍 ❤️ 😂 😮 😢 🙏 🔥 👏 🥰 😅 😉 🤝) y las acciones:
  responder, copiar texto, fijar/desfijar, reenviar, editar y eliminar
  (editar y borrar sólo de los mensajes propios; borrar el de otro, si soy
  owner o admin del grupo).
- **En NS no hay `position: fixed` ni `z-index`**: la hoja es la **última
  hija** del GridLayout de la conversación (`row="0" rowSpan="3"`), que es
  lo que la dibuja encima de todo, y el velo es un **elemento hermano**
  (no un padre) para que el toque dentro de la hoja no la cierre.
- **Las reacciones** se ven **debajo de la burbuja** (una píldora por emoji
  con el conteo, como el `.b-reacts` de la web) y la **cita** del mensaje
  al que se responde se dibuja **dentro** de la burbuja (el `.b-reply`).
- **La barra de respuesta** (el `.reply-bar` de la web) va arriba del
  compositor: al responder, el mensaje nuevo lleva la cita; al editar se
  manda `editMessage()` en vez de uno nuevo.
- **Reenviar**: pantalla propia (`app/views/ForwardView.vue`) con buscador
  y lista de chats, como el `ForwardModal` de la web.
- **Eliminar**: el núcleo no lo trae (`askDeleteMessage` usa el cuadro de
  confirmación de la web), así que el borrado real vive en
  `app/msgactions.ts` (API + limpieza del store) y la confirmación es el
  diálogo del sistema (`Dialogs.confirm`).
- **Copiar**: NS 9 no tiene portapapeles en el core, así que `app/clipboard.ts`
  lo hace con el código de cada sistema (`ClipboardManager` en Android,
  `UIPasteboard` en iOS) y lo engancha al adaptador de plataforma
  (`DomAdapter.setClipboard()`), que es lo que usa el núcleo.

El núcleo (`landing/static/js/actions.js`) ya tenía casi todo
(`toggleReaction`, `editMessage`, `forwardMessage`, `togglePin`): lo
nuevo es la UI nativa.

## Selector de emojis, stickers y GIFs (W106)

La carita del compositor abre el panel de **3 pestañas** de la web:

- **Emojis**: buscador, el **rail de categorías a la izquierda** y **una
  sola lista con subtítulos** ("Caras y emociones:", "Comida y bebida:", …),
  igual que la web. Tocar una categoría del rail **salta a su sección**
  (las alturas del subtítulo y de cada fila son fijas, así que el punto
  de salto se calcula exacto) y al desplazar la lista se ilumina la
  categoría que se está viendo.
- **Stickers**: los 24 del sitio, los **favoritos** (con su estrella) y
  los que **subió el usuario** (con su X para borrarlos). El sticker
  viaja como mensaje `kind:'sticker'`.
- **GIFs**: la biblioteca del sitio, los favoritos y los GIFs del
  usuario. El GIF de la biblioteca se **baja y se sube** como imagen
  (`sendGif`); en NS no hay `File`, así que la capa de plataforma
  (`FileAdapter.toUploadFile()`) lo escribe en un archivo temporal.

Detalles que impone NativeScript:

- **El panel no flota**: en NS no hay `position: fixed` ni `z-index`, así
  que es una **fila propia** del `GridLayout` de la conversación
  (`rows="auto,*,auto,auto"`, el panel en la fila 2 y el compositor en la
  3). El compositor sigue a la vista y los mensajes se achican solos. La
  hoja de acciones del mensaje (W105) ahora cubre las 4 filas.
- **Los emojis y los stickers se pintan como texto** (`Label`), no como
  imágenes Twemoji: en NS no hay SVG y las imágenes del estilo "Noto" se
  descargarían de a uno. Los GIFs y los archivos del usuario sí son
  imágenes (con la URL del CDN).
- **La lógica es compartida**: `landing/static/js/stickers.js` tiene los
  datos, los favoritos y la biblioteca personal (la web la reexporta
  desde `views/ui-actions.js`) y `emoji.js` usa el puente de Vue
  (`./vue.js`), que en NS genera `tools/sync-core.mjs`.

## Perfil propio (W107)

Tres pantallas nativas que portan los modales de la web (`MeProfileModal`,
`MeProfileEditModal` y `UsernameModal`), con el mismo estilo y la misma
API:

- **`MyProfileView` — "Tu perfil"** (el modal `.meprof`): portada
  (`FoxBanner`), avatar de 88 montado encima, la burbuja citada del
  estado **al lado** del avatar (toca y abre el menú), nombre,
  `@usuario`, **ID copiable** (portapapeles + aviso), bio, "Miembro
  desde" y el botón **Editar perfil**. Tocar la portada o la foto abre
  el visor de imágenes (`nav.openMedia`), como "Ver portada"/"Ver foto"
  de la web.
- **`MyProfileEditView` — "Editar perfil"** (el modal `.mp-edit`):
  portada de 96 redondeada con la **posición vertical** (barra 0–100 %),
  foto montada encima con su botón de elegir (imagen) y su X de quitar
  (con `Dialogs.confirm`, igual que el borrado de mensajes de W105),
  "Cambiar portada"/"Quitar portada", campos **Nombre** / **Usuario**
  (el cambio va a una pantalla aparte) / **Estado** con los 4 chips de
  preset y **Bio** con contador `n/300`; pie Cancelar/Guardar con las
  MISMAS validaciones que la web (50 / 300 / 80 caracteres, imagen hasta
  3 MB) y `PUT /auth/profile` subiendo `avatar_media_id` /
  `banner_media_id` con `uploadMedia()`.
- **`UsernameView` — "Cambiar usuario"** (el modal `.uname-modal`, W60):
  aviso de 12 h con el bloqueo real (`username_changed_at` + reloj que
  refresca cada 30 s), regex `^[a-z0-9][a-z0-9_.]{2,19}$`, contraseña
  actual y `PUT /auth/username`.

Entradas (como `.mobile-me` de la web): el **avatar de la cabecera** de
la lista de Chats y de Personas abre "Tu perfil" (antes abría Ajustes;
Ajustes sigue en su pestaña de abajo) y `ProfileView` redirige allí
cuando el perfil es el propio (`relation === 'me'`).

Detalles que impone NativeScript:

- **Los modales son páginas**: en NS no hay capas superpuestas, así que
  cada modal es una vista de la pila (`nav.ts`: `myprofile`,
  `myprofileedit`, `uname`) y "Atrás"/Cancelar recorren la pila igual
  que los botones de la web. El **menú de estado** es la última fila del
  `GridLayout` (regla NS9: sin `position:fixed` ni z-index).
- **`FoxBanner` dibuja `object-position` a mano**: con la posición de
  por defecto (50 %) usa `aspectFill`, **idéntico a antes y sin
  descargar nada** (cero regresión en `9-perfil`); sólo cuando la
  posición se mueve mide la imagen (`ImageSource.fromUrl/fromFileSync`),
  escala para cubrir el hueco y la desplaza con `translateY` (el
  contenedor la recorta). La portada del editor es redondeada con
  `setClipToOutline`, con guarda `outline.canClip()` (si el fondo no
  puede recortar, se queda cuadrada y nunca en blanco).
- **Selector de imagen propio**: `pickFile(accept)` filtra MIME en
  Android (`setType('image/*')` — en iOS el plugin no filtra y la vista
  descarta lo que no sea imagen) y `pickImage()` copia el `content://` a
  un archivo temporal con extensión, que `ImageSource` y el
  `FileAdapter` leen sin problemas.

**Queda pendiente de cara a la paridad total** (documentado para el
siguiente hito que lo toque): el editor de foto con recorte/giro (W27 de
la web, `avatar-editor.js`), el arrastre de portada (la web permite
arrastrar además de la barra), el **markdown de la bio** (`BioText`)
y la vista de portada con `object-position` en `ProfileView` (la ficha
de otros sigue con el `aspectFill` de siempre).

## Comandos

```bash
npm run sync:check      # ¿app/core/ al día?
npm run build:android   # sincroniza + compila el APK
npm run run:android     # instala y corre en el dispositivo/emulador
node --import ./tools/ns-register.mjs tools/test-core.mjs <user> <pw>
                         # test del núcleo nativo contra la API real
node --import ./tools/ns-register.mjs tools/test-w106-core.mjs
                         # test del núcleo de emojis/stickers/GIFs (W106)
node tools/test-w107-i18n.mjs
                         # test del port de perfil propio (W107): claves
                         # i18n, navegación y estilos
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
- **Avisos del sistema** (W100): notificación real del sistema con el
  texto del mensaje, permiso de Android 13+, sonido según Ajustes y, al
  tocarla, se abre el chat y el mensaje exactos.
- **Servicio en primer plano** (W101): el WebSocket sigue vivo con la app
  en segundo plano (sin Firebase), así que los avisos llegan de verdad.
- **La imagen se ve dentro de la burbuja** (W102): miniatura del servidor
  (`?thumb=1`) respetando la proporción real y, al tocarla, un visor a
  pantalla completa con el original.
- **Notas de voz** (W104): el botón del micrófono del compositor graba
  con `@nativescript-community/audio` (MediaRecorder en Android,
  AVAudioRecorder en iOS), con la barra de grabación de la web (punto,
  tiempo, onda en vivo) y el reproductor dentro de la burbuja (play/pausa
  y onda de picos). El archivo se sube con el mismo `sendMedia()` del
  núcleo y el server lo sirve firmado desde el CDN.
- **Acciones del mensaje** (W105): mantener pulsado un mensaje abre una
  hoja pegada abajo con las 12 reacciones rápidas y las acciones
  (responder, copiar, fijar, reenviar, editar, eliminar). Las reacciones
  salen bajo la burbuja, la cita dentro de la burbuja y la barra de
  respuesta arriba del compositor.
- **Selector de emojis/stickers/GIFs** (W106): la carita del compositor
  abre el panel de 3 pestañas de la web (Emojis con buscador, rail de
  categorías y lista con subtítulos; Stickers y GIFs con favoritos y
  biblioteca del usuario). Es una fila propia del `GridLayout` de la
  conversación, justo arriba del compositor.
- **Perfil propio** (W107): "Tu perfil" (portada, avatar solapado, estado
  citado con su menú, ID copiable, bio y "Miembro desde"), "Editar
  perfil" (foto y portada con posición, nombre, estado con presets, bio
  con contador y las mismas validaciones que la web) y "Cambiar usuario"
  (espera de 12 h + contraseña). El avatar de la cabecera de Chats y de
  Personas es la entrada, como el `.mobile-me` de la web.
- **Los scrolls de NativeScript (v0.2.6)**: en NS-Vue el `ref` de un
  elemento nativo es el **envoltorio** (`NSVElement`), no la vista nativa:
  los métodos del `ScrollView` (`scrollToVerticalOffset`) están en su
  `nativeView`. Y `scrollToBottom()` es un método de la **web**: en NS no
  existe (se baja al final con un desplazamiento enorme, que la vista
  nativa recorta al final del contenido). Además, el evento de scroll de
  NS 9 trae `scrollY` (en dp), no `contentOffset`.
- **La APK de publicación se abre (v0.2.5)**: la v0.2.4 se quedaba en
  negro al abrirla. La causa era que la raíz del template de `App.vue`
  compilaba a un **Fragment** (por los comentarios en el nivel del root) y
  Vue sólo desenvuelve el Fragment raíz en depuración: en la build de
  publicación `$el` quedaba sin vista nativa y `entry.create()` devolvía
  `undefined`. Ahora la raíz es el `GridLayout` directamente y
  `vue-loader` compila con `comments:false`.
- **Los errores se ven en el teléfono**: `app.ts` los escribe con
  `android.util.Log` (que sí llega al logcat en las builds de publicación,
  donde el `console` de NativeScript depende del tracing y va apagado) y
  avisa si la raíz no tiene vista nativa. El webpack ya no borra
  `console.error`/`console.warn` en producción.
- **Smoke de release** (`native-release-smoke.yml`): compila la APK en
  modo publicación y la abre en el emulador; falla si la app queda en
  negro o si la pantalla no se puede leer.

 pendiente:
- Push remoto (FCM/APNs) para los avisos cuando la app está cerrada de
  verdad (el usuario la arrastró fuera y el sistema no la levanta).
- Compilación para iOS (hace falta un Mac).

## Requisitos

- Node 18+
- Android SDK (platform 35+, build-tools 35+), JDK 17+
- NativeScript CLI 9 (`npm i -g nativescript`)
