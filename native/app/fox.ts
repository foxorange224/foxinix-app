/* fox.ts — el pegamento entre el núcleo compartido y la app nativa.

   El núcleo (api.js, store.js, i18n.js…) es el MISMO código que la web.
   Lo que es nativo va aquí: arranque de sesión, navegación de vistas y
   avisos. */

import { Application } from '@nativescript/core';
import { api, applyAuth, bootstrap, loadSession, logout, session } from './core/api.js';
import { store, go, goReplace, toast } from './core/store.js';
import { t } from './core/i18n.js';
import { closeChat, loadChats, openChat, sendText } from './core/actions.js';
import { startWS, stopWS } from './core/realtime.js';
import { askNotificationPermission, setupNotifications } from './notifier';
import { setupBackgroundService } from './service';
import { back, canGoBack, view } from './nav';

/* El objeto `android` solo existe en el runtime de Android. */
declare const android: any;

/* Arranque: carga la sesión guardada y, si hay una válida, entra a la
   app; si no, al login. */
export async function bootNative(): Promise<void> {
  /* W100: el notificador se engancha ANTES de abrir el WebSocket: si
     llega un mensaje con la app en segundo plano, el aviso del sistema
     tiene que salir. */
  setupNotifications();
  /* W101: servicio en primer plano para que el WebSocket sobreviva con
     la app en segundo plano (se arranca al salir, se para al volver). */
  setupBackgroundService();
  /* W103: el botón "atrás" del teléfono (Android) tiene que hacer lo
     mismo que el de las cabeceras: volver a la vista anterior. */
  setupBackButton();
  loadSession();
  if (!store.hasSession) {
    goReplace('login');
    return;
  }
  try {
    await bootstrap();
  } catch (e) {
    goReplace('login');
    return;
  }
  /* Sesión lista: la lista de chats y el tiempo real. */
  try {
    await loadChats();
  } catch (e) { /* la lista se reintenta al abrir la app */ }
  try { startWS(); } catch (e) { /* sin WS: la app sigue funcionando */ }
  /* W100: permiso de avisos (Android 13+). Se pide una sola vez y sin
     bloquear el arranque: si el usuario lo deniega, puede activarlo
     desde Ajustes. */
  askNotif();
}

export interface AuthResult {
  needsVerification: boolean;
  email?: string;
}

/* W103: botón físico "atrás" de Android.
   - Si hay una vista encima (personas, perfil, ajustes…), se vuelve a
     ella, igual que la flecha de la cabecera.
   - Si no, con un chat abierto se cierra el chat y se vuelve a la lista.
   - Si no hay nada, la app se cierra (comportamiento normal de Android). */
function setupBackButton(): void {
  try {
    if (!Application.android) return;
    const evt = (Application as any).AndroidApplication
      ? (Application as any).AndroidApplication.activityBackPressedEvent
      : 'activityBackPressed';
    Application.android.on(evt, (args: any) => {
      if (canGoBack()) {
        args.cancel = true;
        back();
        return;
      }
      if (view.value === 'chats' && store.activeChatId) {
        args.cancel = true;
        try { closeChat(); } catch (e) { /* si falla, se sale */ }
      }
    });
  } catch (e) { /* en iOS no existe este evento */ }
}

/* W100: pide el permiso de avisos del sistema (una sola vez; si el
   usuario lo deniega, puede reactivarlo desde Ajustes). No bloquea el
   arranque. */
function askNotif(): void {
  askNotificationPermission().catch(() => {});
}

/* Login: devuelve true si la sesión quedó lista. */
export async function nativeLogin(identifier: string, password: string): Promise<AuthResult> {
  const r = await api('POST', '/auth/login', { identifier, password });
  applyAuth(r);
  if (r.verification && r.verification.required) {
    go('verify');
    return { needsVerification: true, email: r.verification.email_masked || '' };
  }
  goReplace('app');
  /* Si la app arrancó sin sesión, el permiso se pide recién cuando el
     usuario entra (no antes). */
  askNotif();
  return { needsVerification: false };
}

/* Registro: devuelve true si la cuenta quedó creada (y verificada). */
export async function nativeRegister(username: string, email: string, password: string): Promise<AuthResult> {
  const r = await api('POST', '/auth/register', { username, email, password });
  if (r.user) {
    applyAuth({ user: r.user, tokens: r.tokens });
    if (!r.verification || !r.verification.required) {
      goReplace('app');
      askNotif();
      return { needsVerification: false };
    }
    store.pendingEmail = r.verification.email_masked || email;
    go('verify');
    return { needsVerification: true, email: r.verification.email_masked || email };
  }
  goReplace('app');
  askNotif();
  return { needsVerification: false };
}

export function nativeLogout(): void {
  try { stopWS(); } catch (e) {}
  logout();
  goReplace('login');
}

/* Aviso nativo: el toast de la web no existe en NS. En Android se usa el
   diálogo del sistema; en iOS, las vistas muestran el mensaje en línea
   (así que aquí no hay nada que hacer). */
export function nativeToast(msg: string, kind?: string): void {
  try {
    const text = String(msg || '');
    if (!text) return;
    const activity = Application.android.foregroundActivity;
    if (!activity) return;
    new android.app.AlertDialog.Builder(activity)
      .setTitle('Foxinix')
      .setMessage(text)
      .setPositiveButton('OK', null)
      .show();
  } catch (e) {
    /* Sin diálogo disponible: la vista muestra el error en línea. */
  }
}

export { store, go, goReplace, toast, t, session, loadChats, openChat, sendText };
