/* files-picker.android.ts — selector de archivos en Android.

   Se usa el SAF de Android (Storage Access Framework): el intent
   ACTION_OPEN_DOCUMENT. NO hace falta pedir permiso de almacenamiento
   (el sistema da acceso sólo al archivo elegido), que es justo lo que
   el plugin ui-document-picker no puede hacer en Android 13+.

   `accept` es un MIME opcional (p. ej. "image/*" para las fotos del
   perfil, W107); por defecto se abre el selector de todo.

   Devuelve la URI del archivo elegido (content://...) o '' si el
   usuario cancela. */

import { Application } from '@nativescript/core';

declare const android: any;

/* Código de la petición al selector (el que vuelve en el resultado). */
const FILE_CODE = 4711;

export async function pickPlatformFile(accept?: string): Promise<string> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      try {
        Application.android.off(Application.android.activityResultEvent, onEvent);
      } catch (e) { /* el listener puede no estar registrado */ }
      resolve(value || '');
    };
    const onEvent = (args: any) => {
      if (!args || args.requestCode !== FILE_CODE) return;
      try {
        if (args.resultCode !== android.app.Activity.RESULT_OK) { finish(''); return; }
        const data = args.intent ? args.intent.getData() : null;
        finish(data ? String(data.toString()) : '');
      } catch (e) {
        finish('');
      }
    };
    try {
      const intent = new android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT);
      intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);
      intent.setType(accept || '*/*');
      /* Acceso de lectura sólo al archivo elegido (sin permisos). */
      intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
      const activity = Application.android.startActivity || Application.android.foregroundActivity;
      Application.android.on(Application.android.activityResultEvent, onEvent);
      activity.startActivityForResult(intent, FILE_CODE);
    } catch (e) {
      finish('');
    }
  });
}
