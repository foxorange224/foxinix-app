/* nav.ts — estado de navegación de la app nativa.

   La web enruta por URL (store.route); en NS no hay URL, así que la app
   lleva su propio estado de vista. Es lo NATIVO: el núcleo compartido no
   sabe que esto existe (sólo usa store.route para las pantallas de
   autenticación).

   Se usa una pila simple: "Atrás" vuelve a la vista anterior. */

import { ref } from 'nativescript-vue';

export type NativeView =
  | 'chats' | 'people' | 'newgroup' | 'profile' | 'settings' | 'media'
  | 'forward' | 'myprofile' | 'myprofileedit' | 'uname';

export const view = ref<NativeView>('chats');
/* Datos de la vista actual (id del usuario del perfil). */
export const profileUserId = ref(0);
/* W102: imagen a pantalla completa (URL absoluta del CDN + pie de foto). */
export const mediaUrl = ref('');
export const mediaCaption = ref('');
/* W105: reenviar un mensaje: el mensaje y el chat de origen. */
export const forwardMsg = ref<any>(null);
export const forwardSrc = ref(0);

const stack: NativeView[] = [];

export function goView(v: NativeView): void {
  if (v !== view.value) stack.push(view.value);
  view.value = v;
}

/* Abre el perfil de un usuario (vuelve atrás a la vista anterior). */
export function goProfile(userId: number): void {
  profileUserId.value = userId;
  goView('profile');
}

/* W107: "Tu perfil" (el modal .meprof de la web) y su edición. La
   pila hace que "Atrás" en la edición vuelva a "Tu perfil", igual que
   el botón Cancelar de la web. */
export function goMyProfile(): void {
  goView('myprofile');
}

export function goMyProfileEdit(): void {
  goView('myprofileedit');
}

/* W107: cambio de @usuario (modal aparte, W60 de la web). */
export function goUsername(): void {
  goView('uname');
}

/* W102: abre una imagen a pantalla completa (desde la burbuja del chat). */
export function openMedia(url: string, caption?: string): void {
  mediaUrl.value = String(url || '');
  mediaCaption.value = String(caption || '');
  goView('media');
}

/* W105: reenviar un mensaje a otro chat (la vista pide el destino). */
export function openForward(msg: any, srcChatId: number): void {
  forwardMsg.value = msg || null;
  forwardSrc.value = Number(srcChatId || 0);
  goView('forward');
}

/* Atrás: a la vista anterior de la pila (o a la lista de chats). */
export function back(): void {
  view.value = stack.pop() || 'chats';
}

/* ¿Hay a dónde volver con el botón "atrás"? */
export function canGoBack(): boolean {
  return stack.length > 0;
}

/* Vuelve a la lista de chats y limpia la pila (tras abrir un chat). */
export function backToChats(): void {
  stack.length = 0;
  view.value = 'chats';
}
