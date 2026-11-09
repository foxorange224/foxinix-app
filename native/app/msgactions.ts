/* msgactions.ts — acciones del mensaje que NO están en el núcleo (W105).

   El núcleo (landing/static/js/actions.js) tiene casi todo: editar,
   reaccionar, fijar, reenviar… Lo que falta es BORRAR, porque la web
   lo hace con un cuadro de confirmación propio (store.confirmBox) que
   en la app nativa no existe: ahí se usa el diálogo del sistema.

   Acá está el borrado de verdad (la llamada a la API y la limpieza del
   store), tal como lo hace askDeleteMessage() de la web pero sin el
   cuadro de confirmación (eso lo pone la vista). */

import { api } from './core/api.js';
import { store, toast } from './core/store.js';
import { t } from './core/i18n.js';
import { loadChats } from './core/actions.js';

/* Borra un mensaje del chat (para mí y para todos). */
export async function deleteMessage(chatId: number, msgId: number): Promise<boolean> {
  try {
    await api('DELETE', '/chats/' + chatId + '/messages/' + msgId,
      undefined, { retry401: true });
  } catch (e: any) {
    toast((e && e.detail) || t('No se pudo eliminar el mensaje'), 'err');
    return false;
  }
  const arr: any = (store.msgs as any)[chatId];
  if (arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].id === msgId) arr.splice(i, 1);
    }
  }
  /* Si era el último mensaje, el server recalcula la vista previa del
     chat (como en la web). */
  try {
    const chats: any[] = (store.chats as any) || [];
    for (const c of chats) {
      if (c.id === chatId && c.last_message && c.last_message.id === msgId) {
        loadChats();
        break;
      }
    }
  } catch (e) { /* la lista se actualiza sola en la próxima carga */ }
  return true;
}
