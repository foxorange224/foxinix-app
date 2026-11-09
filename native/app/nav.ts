/* nav.ts — estado de navegación de la app nativa.

   La web enruta por URL (store.route); en NS no hay URL, así que la app
   lleva su propio estado de vista. Es lo NATIVO: el núcleo compartido no
   sabe que esto existe (sólo usa store.route para las pantallas de
   autenticación).

   Se usa una pila simple: "Atrás" vuelve a la vista anterior. */

import { ref } from 'nativescript-vue';

export type NativeView = 'chats' | 'people' | 'newgroup' | 'profile' | 'settings' | 'media';

export const view = ref<NativeView>('chats');
/* Datos de la vista actual (id del usuario del perfil). */
export const profileUserId = ref(0);
/* W102: imagen a pantalla completa (URL absoluta del CDN + pie de foto). */
export const mediaUrl = ref('');
export const mediaCaption = ref('');

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

/* W102: abre una imagen a pantalla completa (desde la burbuja del chat). */
export function openMedia(url: string, caption?: string): void {
  mediaUrl.value = String(url || '');
  mediaCaption.value = String(caption || '');
  goView('media');
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
