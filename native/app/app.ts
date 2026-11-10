import { createApp } from 'nativescript-vue';

import App from './App.vue';

/* W106: los errores de la app tienen que verse en el logcat del
   teléfono TAMBIÉN en las builds de release, donde el console de
   NativeScript depende del tracing (que va apagado en producción) y
   donde nativescript-vue sólo relanza los errores de Vue en desarrollo.
   Por eso se escriben con android.util.Log (Android) y con console.error
   (resto de plataformas). */
declare const android: any;

export function logError(msg: string): void {
  const text = `[Foxinix] ${msg}`;
  try {
    if (typeof android !== 'undefined' && android.util && android.util.Log) {
      android.util.Log.e('Foxinix', text);
    }
  } catch (e) {}
  try {
    console.error(text);
  } catch (e) {}
}

const app = createApp(App);

app.config.errorHandler = (err: unknown, _instance: unknown, info: string) => {
  const detail = err instanceof Error ? (err.stack || err.message) : String(err);
  logError(`error de Vue (${info || 'render'}): ${detail}`);
};

/* W106: se anota qué devuelve el montaje de la raíz. Si el elemento raíz
   no tiene vista nativa, la pantalla queda en negro. */
const anyApp = app as any;
const origMount = anyApp.mount.bind(anyApp);
anyApp.mount = (...args: any[]) => {
  logError('montando la raíz...');
  try {
    const inst: any = origMount(...args);
    logError(`montaje: instancia=${inst ? 'sí' : 'NO'}` +
      ` $el=${inst && inst.$el ? (inst.$el.constructor && inst.$el.constructor.name) : 'undefined'}` +
      ` nativeView=${inst && inst.$el && inst.$el.nativeView ? 'sí' : 'NO'}`);
    return inst;
  } catch (e: any) {
    logError(`EXCEPCIÓN al montar: ${e && e.stack ? e.stack : e}`);
    throw e;
  }
};

app.start();
