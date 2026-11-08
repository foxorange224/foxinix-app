/* nav.ts — estado de navegación de la app nativa.

   La web enruta por URL (store.route); en NS no hay URL, así que la app
   lleva su propio estado de vista. Es lo NATIVO: el núcleo compartido no
   sabe que esto existe (sólo usa store.route para las pantallas de
   autenticación). */

import { ref } from 'nativescript-vue';

export type NativeView = 'chats' | 'people' | 'newgroup';

export const view = ref<NativeView>('chats');

export function goView(v: NativeView): void {
  view.value = v;
}

export function backToChats(): void {
  view.value = 'chats';
}
