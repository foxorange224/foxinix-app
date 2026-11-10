import { createApp } from 'nativescript-vue';

import App from './App.vue';

const app = createApp(App);

/* W106: nativescript-vue atrapa los errores de Vue y SÓLO los relanza en
   desarrollo (__DEV__). En la build de release (__DEV__ = false) un error
   al renderizar dejaba la pantalla EN NEGRO y sin dejar rastro, porque
   además el webpack de producción borra los console.*.

   Acá se anota el error (con la pila) para que quede en el logcat del
   dispositivo y la app se pueda diagnosticar sin tener que adivinar. */
app.config.errorHandler = (err: unknown, _instance: unknown, info: string) => {
  const detail = err instanceof Error ? (err.stack || err.message) : String(err);
  console.error(`[Foxinix] error de Vue (${info || 'render'}): ${detail}`);
};

app.start();
