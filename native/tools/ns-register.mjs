/* ns-register.mjs — registra el loader de NS para las pruebas en Node. */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(pathToFileURL(new URL('./ns-loader.mjs', import.meta.url).pathname).href);

/* El runtime de NS trae un XMLHttpRequest global; en Node hay que
   instalar el stub para que el núcleo pueda subir archivos. */
await import('./ns-xhr-stub.mjs');
