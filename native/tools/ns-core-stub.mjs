/* ns-core-stub.mjs — stub de @nativescript/core para probar el núcleo
   nativo en Node (sin emulador).

   Implementa lo que usan los adaptadores de `platform/nativescript/`:
   - application-settings: un Map en memoria (como ApplicationSettings).
   - http: `request` sobre fetch, devolviendo la forma de NS
     ({statusCode, content, headers}).
   - platform: Screen.mainScreen con medidas DIPs.

   NO es el runtime real de NativeScript: sirve para verificar que el
   núcleo compartido (api/store/i18n) funciona con la capa nativa. */

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

/* --- http sobre fetch --- */
export async function request(opts) {
  const headers = Object.assign({}, opts.headers || {});
  if (opts.contentType) headers['Content-Type'] = opts.contentType;
  let body = opts.body;
  if (body !== undefined && body !== null && typeof body !== 'string' &&
      !(body instanceof ArrayBuffer) && !(body instanceof FormData)) {
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

export class File {
  static fromPath(path) { return new File(path); }
  static exists(path) { return false; }
  constructor(path) { this.path = path; }
  writeSync() {}
  write() { return Promise.resolve(); }
  remove() { return Promise.resolve(); }
  readSync() { return null; }
}
export class Folder {
  getFile(name) { return new File(name); }
}

export function getFileAccess() { return {}; }

/* --- image-source: sólo hace falta fromUrl (tamaño de una imagen) --- */
export const ImageSource = {
  fromUrl(url) {
    /* En Node no hay decodificador de imágenes: se resuelve con 0×0. */
    return Promise.resolve({ width: 0, height: 0, url: String(url) });
  },
  fromFile() { return Promise.resolve({ width: 0, height: 0 }); },
  fromData() { return Promise.resolve({ width: 0, height: 0 }); },
};

export const Application = {
  android: { foregroundActivity: null },
  ios: {},
};

export default {
  getString, setString, remove, clear, hasKey, Screen, device,
  request, getFile, knownFolders, File, Folder, Application, ImageSource,
};
