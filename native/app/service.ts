/* service.ts — servicio en primer plano (W101).

   La app nativa recibe los mensajes por un WebSocket que vive en el
   runtime de JavaScript. Si Android deja el proceso en segundo plano
   (lo congela o lo mata), el socket se cae y no llega ningún aviso.

   Con un servicio en primer plano (App_Resources/Android/.../
   FoxinixService.java) el proceso sigue vivo y con prioridad de CPU: el
   WebSocket no se cae y los avisos del sistema (W100) se pueden mostrar.
   NO hace falta Firebase para esto.

   El servicio se arranca cuando la app va al segundo plano y se para
   cuando vuelve (en primer plano el proceso vive por sí solo y el aviso
   persistente del servicio sobraría). */

import { Application, Utils } from '@nativescript/core';
import { store } from './core/store.js';

/* El objeto `android` sólo existe en el runtime de Android. */
declare const android: any;

let wired = false;

/* Contexto de la app: en Android, la Application de NativeScript es un
   Context (si no, se usa el contexto de la aplicación). */
function appContext(): any {
  try {
    const a = (Application as any).android;
    if (a && a.nativeApp) return a.nativeApp;
  } catch (e) {}
  try {
    /* NS 9: Utils.android.getApplicationContext() */
    return Utils.android.getApplicationContext();
  } catch (e) {}
  return null;
}

/* Intent explícito al servicio (por nombre de clase: así no hace falta
   que la clase Java esté expuesta al runtime de JS). */
function serviceIntent(ctx: any, suffix: string): any {
  const pkg = String(ctx.getPackageName());
  const intent = new android.content.Intent();
  intent.setComponent(new android.content.ComponentName(pkg, pkg + '.FoxinixService'));
  intent.setAction(pkg + '.action.' + suffix);
  return intent;
}

export function startBackgroundService(): boolean {
  try {
    const ctx = appContext();
    if (!ctx) return false;
    const intent = serviceIntent(ctx, 'START');
    if (android.os.Build.VERSION.SDK_INT >= 26) {
      /* Android 8+: los servicios en primer plano se arrancan con
         startForegroundService (el servicio tiene que llamar a
         startForeground en los primeros 5 segundos). */
      ctx.startForegroundService(intent);
    } else {
      ctx.startService(intent);
    }
    return true;
  } catch (e) {
    /* Android 12+ puede rechazar el arranque si la app ya está totalmente
       en segundo plano: no es fatal (el proceso sigue vivo mientras el
       sistema no lo mate). */
    return false;
  }
}

export function stopBackgroundService(): boolean {
  try {
    const ctx = appContext();
    if (!ctx) return false;
    ctx.stopService(serviceIntent(ctx, 'STOP'));
    return true;
  } catch (e) {
    return false;
  }
}

/* Escucha el ciclo de vida de la app: arranca el servicio al salir y lo
   para al volver. */
export function setupBackgroundService(): void {
  if (wired) return;
  wired = true;
  try {
    Application.on(Application.suspendEvent, () => {
      /* Sin sesión no hay WebSocket que mantener: no hace falta el
         servicio (ni el aviso persistente). */
      if (!store.hasSession) return;
      startBackgroundService();
    });
    Application.on(Application.resumeEvent, () => {
      stopBackgroundService();
    });
  } catch (e) {}
}
