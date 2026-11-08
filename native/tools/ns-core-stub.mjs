/* ns-core-stub.mjs — stub de @nativescript/core para probar el núcleo
   nativo en Node (sin emulador).

   Implementa lo que usan los adaptadores de `platform/nativescript/`:
   - application-settings: un Map en memoria (como ApplicationSettings).
   - http: `request` sobre fetch, devolviendo la forma de NS
     ({statusCode, content, headers}).
   - platform: Screen.mainScreen con medidas DIPs.

   NO es el runtime real de NativeScript: sirve para verificar que el
   núcleo compartido (api/store/i18n) funciona con la capa nativa. */

import fs from 'node:fs';

const store = new Map();

export function getString(key, def = null) {
  return store.has(key) ? String(store.get(key)) : def;
}
export function setString(key, value) { store.set(key, String(value)); }
export function remove(key) { store.delete(key); }
export function clear() { store.clear(); }
export function hasKey(key) { return store.has(key); }
export function getBoolean(key, def = false) {
  return store.has(key) ? store.get(key) === 'true' : def;
}
export function setBoolean(key, value) { store.set(key, String(!!value)); }
export function getNumber(key, def = 0) {
  return store.has(key) ? Number(store.get(key)) : def;
}
export function setNumber(key, value) { store.set(key, String(value)); }

export const Screen = {
  mainScreen: { widthDIPs: 412, heightDIPs: 915, widthPixels: 1080, heightPixels: 2400, scale: 2.625 },
};

export const device = {
  manufacturer: 'node', model: 'test', os: 'node', osVersion: '0',
  sdkVersion: '0', deviceType: 'Phone', uuid: 'stub', language: 'es', region: 'ES',
};

/* --- http sobre fetch ---
   El cuerpo va en `content` (como en NS 9): si la app usara `body`, la
   petición saldría sin cuerpo y el fallo sólo se vería en el dispositivo. */
export async function request(opts) {
  const headers = Object.assign({}, opts.headers || {});
  if (opts.contentType) headers['Content-Type'] = opts.contentType;
  let body = opts.content;
  if (body === undefined || body === null) body = undefined;
  else if (typeof body !== 'string' && !(body instanceof ArrayBuffer) &&
      !(body instanceof Uint8Array) && !(body instanceof FormData)) {
    body = JSON.stringify(body);
  }
  const res = await fetch(opts.url, {
    method: opts.method || 'GET',
    headers,
    body,
  });
  const text = await res.text();
  return {
    statusCode: res.status,
    /* En NS el `content` de una respuesta de texto es un string. */
    content: text,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

export async function getFile(url, destinationFilePath) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return { path: destinationFilePath || url, content: new Uint8Array(buf) };
}

export const knownFolders = {
  documents: () => ({ path: '/tmp/docs', getFile: (n) => ({ path: '/tmp/docs/' + n }) }),
  temp: () => ({ path: '/tmp', getFile: (n) => ({ path: '/tmp/' + n }) }),
  currentApp: () => ({ path: '/tmp/app' }),
  externalDocuments: () => ({ path: '/tmp/ext' }),
};

/* --- API de bajo nivel de archivos (readBufferSync devuelve un
   ArrayBuffer, como en NS; en Android además entiende los content://) --- */
export function getFileAccess() {
  return {
    readBufferSync(path) {
      const buf = fs.readFileSync(String(path));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
    readBuffer(path) {
      return Promise.resolve(this.readBufferSync(path));
    },
    getFileSize(path) {
      try { return fs.statSync(String(path)).size; }
      catch (e) { return 0; }
    },
  };
}

export class File {
  static fromPath(path) { return new File(path); }
  static exists(path) { try { return fs.existsSync(String(path)); } catch (e) { return false; } }
  constructor(path) { this.path = path; }
  writeSync() {}
  write() { return Promise.resolve(); }
  remove() { return Promise.resolve(); }
  readSync() { return getFileAccess().readBufferSync(this.path); }
}
export class Folder {
  getFile(name) { return new File(name); }
}

/* --- image-source: sólo hace falta fromUrl (tamaño de una imagen) --- */export const ImageSource = {
  fromUrl(url) {
    /* En Node no hay decodificador de imágenes: se resuelve con 0×0. */
    return Promise.resolve({ width: 0, height: 0, url: String(url) });
  },
  fromFile() { return Promise.resolve({ width: 0, height: 0 }); },
  fromData() { return Promise.resolve({ width: 0, height: 0 }); },
};

/* --- Application: eventos de suspender/reanudar (W100) ---
   En NS la app avisa con Application.suspendEvent cuando va al segundo
   plano: el núcleo lo usa para saber si tiene que mostrar un aviso del
   sistema. El stub deja emitirlos a mano (__emit). */
const appListeners = {};
export const Application = {
  android: { foregroundActivity: null },
  ios: {},
  suspendEvent: 'suspend',
  resumeEvent: 'resume',
  launchEvent: 'launch',
  on(event, cb) {
    (appListeners[event] = appListeners[event] || []).push(cb);
  },
  off(event, cb) {
    const l = appListeners[event] || [];
    const i = l.indexOf(cb);
    if (i >= 0) l.splice(i, 1);
  },
  __emit(event, data) {
    for (const cb of (appListeners[event] || []).slice()) {
      try { cb(data); } catch (e) {}
    }
  },
};

/* --- contexto de la app (W101: servicio en primer plano) ---
   El servicio en primer plano se arranca con un Intent explícito al
   contexto de la aplicación. El stub anota las llamadas para que la
   prueba pueda comprobar que se arrancan y se paran. */
const ctxCalls = [];
const appContext = {
  getPackageName() { return 'io.foxinix.nativa'; },
  startForegroundService(i) { ctxCalls.push(['startForegroundService', i]); },
  startService(i) { ctxCalls.push(['startService', i]); },
  stopService(i) { ctxCalls.push(['stopService', i]); },
};
export const Utils = {
  android: { getApplicationContext: () => appContext },
};
export function __ctxCalls() { return ctxCalls.slice(); }
export function __resetCtx() { ctxCalls.length = 0; }

export default {
  getString, setString, remove, clear, hasKey, Screen, device,
  request, getFile, knownFolders, File, Folder, Application, ImageSource,
  getFileAccess, Utils,
};
