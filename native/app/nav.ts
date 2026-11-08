/* nav.ts — estado de navegación de la app nativa.

   La web enruta por URL (store.route); en NS no hay URL, así que la app
   lleva su propio estado de vista. Es lo NATIVO: el núcleo compartido no
   sabe que esto existe (sólo usa store.route para las pantallas de
   autenticación).

   Se usa una pila simple: "Atrás" vuelve a la vista anterior. */

import { ref } from 'nativescript-vue';

export type NativeView = 'chats' | 'people' | 'newgroup' | 'profile';

export const view = ref<NativeView>('chats');
/* Datos de la vista actual (id del usuario del perfil). */
export const profileUserId = ref(0);

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

/* Atrás: a la vista anterior de la pila (o a la lista de chats). */
export function back(): void {
  view.value = stack.pop() || 'chats';
}

/* Vuelve a la lista de chats y limpia la pila (tras abrir un chat). */
export function backToChats(): void {
  stack.length = 0;
  view.value = 'chats';
}
