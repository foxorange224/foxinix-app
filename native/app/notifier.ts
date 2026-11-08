/* notifier.ts — avisos del sistema en la app nativa (W100).

   El núcleo compartido (realtime.js) avisa de los mensajes que llegan con
   NotificationAdapter.notify(): en la web eso es la Notification del
   navegador; en NativeScript esa API no existe. Lo implementa aquí el
   plugin de notificaciones locales (@nativescript/local-notifications),
   que muestra un aviso REAL del sistema (canal propio "Foxinix").

   Flujo:
     1. realtime.js llama a NotificationAdapter.notify() cuando llega un
        mensaje y la app está en segundo plano (DomAdapter.getHidden()).
     2. Aquí se convierte eso en una notificación del sistema, con el
        sonido si el usuario lo tiene activado en Ajustes.
     3. Al tocar el aviso, el id del chat y del mensaje viajan en el
        "payload" de la notificación y se abren con
        openNotificationTarget() — el mismo camino que usa la web (W57).

   El permiso (POST_NOTIFICATIONS en Android 13+) se pide una sola vez al
   arrancar; si el usuario lo deniega, puede activarlo desde Ajustes. */

import { LocalNotifications } from '@nativescript/local-notifications';
import type { ScheduleOptions } from '@nativescript/local-notifications';
import { getString, setString } from '@nativescript/core/application-settings';
import { NotificationAdapter } from './core/platform/index.js';
import { openNotificationTarget } from './core/actions.js';
import { store } from './core/store.js';

export type NotifPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/* El objeto `android` sólo existe en el runtime de Android. */
declare const android: any;

/* El adaptador consulta el permiso de forma SÍNCRONA (permission()) pero
   el plugin lo responde de forma asíncrona: se guarda el último estado
   conocido. 'prompt' = todavía no se comprobó. */
let perm: NotifPermission = 'prompt';
let wired = false;

/* Canal de Android: el nombre que se ve al mantener pulsado el aviso. */
const CHANNEL = 'Foxinix';
/* Icono del aviso (la cabeza de zorro de la marca, en blanco: Android lo
   tiñe con el color del sistema). */
const ICON = 'res://drawable/ic_stat_notify';
/* Clave para no pedir el permiso en cada arranque. */
const ASKED_KEY = 'fox.notif.asked';

/* El payload viaja al tocar el aviso: el chat y el mensaje exactos. */
function payloadOf(opts: any): any {
  const chatId = opts ? opts.chatId : 0;
  if (!chatId) return null;
  return { chatId: String(chatId), msgId: String((opts && opts.msgId) || '') };
}

export const nativeNotifier = {
  /* Estado del permiso (para el adaptador y para Ajustes). */
  permission(): NotifPermission {
    return perm;
  },

  async requestPermission(): Promise<NotifPermission> {
    try {
      const ok = await LocalNotifications.requestPermission();
      perm = ok ? 'granted' : 'denied';
    } catch (e) {
      perm = 'denied';
    }
    setString(ASKED_KEY, '1');
    return perm;
  },

  /* Muestra el aviso del sistema. */
  notify(title: string, options: any): boolean {
    if (perm !== 'granted') return false;
    const opts = options || {};
    const body = String(opts.body || '');
    const entry: ScheduleOptions = {
      title: String(title || 'Foxinix'),
      body,
      /* En la barra de estado (Android). */
      ticker: body,
      channel: CHANNEL,
      icon: ICON,
      /* Texto largo en el aviso desplegado. */
      bigTextStyle: true,
      /* El sonido lo pone la propia notificación (aquí no hay Web Audio):
         si el usuario lo apagó en Ajustes, la clave "sound" no se manda. */
      sound: store.prefs && store.prefs.sound ? 'default' : (undefined as any),
    };
    const payload = payloadOf(opts);
    if (payload) entry.payload = payload;
    try {
      const p = LocalNotifications.schedule([entry]);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      return false;
    }
    return true;
  },
};

/* Engancha el notificador con el núcleo y escucha el toque en los avisos.
   Se llama al arrancar (antes de abrir el WebSocket) para que ningún
   mensaje se quede sin avisar. */
export function setupNotifications(): void {
  if (wired) return;
  wired = true;
  NotificationAdapter.setNotifier(nativeNotifier);
  /* El permiso se consulta cuanto antes: hasta que se sepa, los avisos
     no se muestran (notify() devuelve false si el estado no es
     "granted"). */
  notificationState().catch(() => {});
  try {
    const p = LocalNotifications.addOnMessageReceivedCallback((n: any) => {
      const pl = n && n.payload;
      if (!pl) return;
      const chatId = pl.chatId || pl.chat_id;
      const msgId = pl.msgId || pl.msg_id;
      if (!chatId) return;
      try {
        /* Si la app estaba cerrada, la sesión todavía no está cargada:
           openNotificationTarget guarda el destino y lo resuelve cuando
           la lista de chats está lista (W57). */
        openNotificationTarget(chatId, msgId);
      } catch (e) {}
    });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {}
}

/* Estado del permiso para Ajustes. */
export async function notificationState(): Promise<NotifPermission> {
  try {
    const ok = await LocalNotifications.hasPermission();
    perm = ok ? 'granted' : 'denied';
  } catch (e) {
    perm = 'denied';
  }
  return perm;
}

/* Pide el permiso (o lo recuerda). Se llama al arrancar y desde Ajustes.
   force=true (desde Ajustes) vuelve a preguntar aunque ya se haya
   preguntado antes: el usuario puede haber cambiado de opinión. */
export async function askNotificationPermission(force?: boolean): Promise<NotifPermission> {
  await notificationState();
  if (perm === 'granted') return perm;
  /* Ya se preguntó y el usuario lo denegó: no se insiste al arrancar
     (Android tampoco muestra el diálogo otra vez). */
  if (!force && getString(ASKED_KEY, '0') === '1') return perm;
  return nativeNotifier.requestPermission();
}

/* Abre los ajustes de avisos de la app en el sistema (Android).
   Se usa cuando el usuario los bloqueó y hay que ir a habilitarlos a
   mano. */
export function openNotificationSettings(): boolean {
  try {
    const context = require('@nativescript/core/utils').Utils.android.getApplicationContext();
    const pkg = context.getPackageName();
    const intent = new android.content.Intent('android.settings.APP_NOTIFICATION_SETTINGS');
    intent.putExtra('android.provider.extra.APP_PACKAGE', pkg);
    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
    context.startActivity(intent);
    return true;
  } catch (e) {
    return false;
  }
}
