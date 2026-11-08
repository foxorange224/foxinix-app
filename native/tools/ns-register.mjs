/* ns-register.mjs — registra el loader de NS para las pruebas en Node. */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(pathToFileURL(new URL('./ns-loader.mjs', import.meta.url).pathname).href);
