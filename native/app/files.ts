/* files.ts — el selector de archivos NATIVO de la app.

   En la web se usa <input type="file">. En NativeScript se abre el
   selector del sistema, que es distinto en cada plataforma:

   - Android (files-picker.android.ts): intent ACTION_OPEN_DOCUMENT (el SAF
     de Android). Así NO hace falta pedir permiso de almacenamiento: el
     sistema da acceso sólo al archivo elegido. (El plugin
     ui-document-picker pide permiso de "storage" siempre, y en Android 13+
     ese permiso ya no se concede: salta un aviso inútil o directamente no
     abre nada.)
   - iOS (files-picker.ios.ts): UIDocumentPickerViewController (el plugin
     ui-document-picker, que no pide permisos).

   Lo que se devuelve es un "archivo" con la forma que espera el núcleo
   compartido: {name, size, type, path}. Los bytes los lee la capa de
   plataforma (FileAdapter), que en Android sabe leer los content://. */

import { FileAdapter } from './core/platform/index.js';
import { pickPlatformFile } from './files-picker';

export interface PickedFile {
  name: string;
  size: number;
  type: string;
  path: string;
}

/* Abre el selector y devuelve el archivo elegido.
   null si el usuario cancela o si no hay selector. */
export async function pickFile(): Promise<PickedFile | null> {
  let path = '';
  try {
    path = await pickPlatformFile();
  } catch (e) {
    return null;
  }
  if (!path) return null;
  const info = FileAdapter.describeSource(path);
  return {
    name: info.name || 'archivo',
    size: info.size || 0,
    type: info.type || 'application/octet-stream',
    path,
  };
}
