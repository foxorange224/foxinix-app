/* clipboard.ts — portapapeles NATIVO (W105).

   NativeScript 9 no trae portapapeles en el core, pero la capa de
   plataforma ya tiene el enganche: platform/nativescript/dom.js expone
   DomAdapter.setClipboard(copier), y DomAdapter.copyToClipboard(txt)
   lo usa si está conectado (si no, devuelve false).

   Acá se implementa el copiador con el código de cada sistema:
     - Android: ClipboardManager (setPrimaryClip).
     - iOS: UIPasteboard.

   Es código de APP (no del núcleo): el núcleo sólo pide "copiá este
   texto" con DomAdapter.copyToClipboard(). */

import { Utils } from '@nativescript/core';
import { DomAdapter } from './core/platform/index.js';

/* El objeto `android` sólo existe en el runtime de Android; en iOS el
   equivalente es UIPasteboard. */
declare const android: any;
declare const UIPasteboard: any;

/* Copia un texto al portapapeles. true si se copió. */
export function copyToClipboard(text: string): boolean {
  const s = String(text == null ? '' : text);
  try {
    if (typeof android !== 'undefined' && android.content) {
      const ctx = Utils.android.getApplicationContext();
      const cm = ctx.getSystemService(
        android.content.Context.CLIPBOARD_SERVICE);
      if (cm) {
        cm.setPrimaryClip(android.content.ClipData.newPlainText('Foxinix', s));
        return true;
      }
    }
  } catch (e) { /* se prueba iOS */ }
  try {
    if (typeof UIPasteboard !== 'undefined') {
      UIPasteboard.generalPasteboard().setString(s);
      return true;
    }
  } catch (e) {}
  return false;
}

/* Conecta el copiador al adaptador de plataforma (lo llama el arranque
   de la app, en fox.ts). */
export function installClipboard(): void {
  try {
    DomAdapter.setClipboard({ setString: copyToClipboard });
  } catch (e) { /* el núcleo puede no estar todavía */ }
}
