/* ns-loader.mjs — loader de Node que redirige `@nativescript/core/*`,
   `nativescript-vue` y `@master.technology/websockets` a stubs locales,
   para poder probar el núcleo nativo sin emulador.

   Uso: node --import ./tools/ns-register.mjs tools/test-core.mjs */

import { pathToFileURL } from 'node:url';

const CORE_STUB = pathToFileURL(new URL('./ns-core-stub.mjs', import.meta.url).pathname).href;
const VUE_STUB = pathToFileURL(new URL('./ns-vue-stub.mjs', import.meta.url).pathname).href;
const WS_STUB = pathToFileURL(new URL('./ns-websocket-stub.mjs', import.meta.url).pathname).href;
const NOTIF_STUB = pathToFileURL(new URL('./ns-notifications-stub.mjs', import.meta.url).pathname).href;

export function resolve(specifier, context, next) {
  if (specifier === '@nativescript/core' || specifier.startsWith('@nativescript/core/')) {
    return { url: CORE_STUB, shortCircuit: true, format: 'module' };
  }
  if (specifier === 'nativescript-vue') {
    return { url: VUE_STUB, shortCircuit: true, format: 'module' };
  }
  if (specifier === '@master.technology/websockets') {
    return { url: WS_STUB, shortCircuit: true, format: 'module' };
  }
  if (specifier === '@nativescript/local-notifications') {
    return { url: NOTIF_STUB, shortCircuit: true, format: 'module' };
  }
  return next(specifier, context);
}
