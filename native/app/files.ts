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

import { knownFolders } from '@nativescript/core/file-system';
import { FileAdapter } from './core/platform/index.js';
import { pickPlatformFile } from './files-picker';

export interface PickedFile {
  name: string;
  size: number;
  type: string;
  path: string;
}

/* Abre el selector y devuelve el archivo elegido.
   null si el usuario cancela o si no hay selector.
   `accept` es un MIME opcional ("image/*" para las fotos, W107). */
export async function pickFile(accept?: string): Promise<PickedFile | null> {
  let path = '';
  try {
    path = await pickPlatformFile(accept);
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

/* Extensión para el archivo temporal (la usa el visor de imágenes). */
function extFor(name: string, type: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name || ''));
  if (m) return '.' + m[1].toLowerCase();
  const byMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return byMime[type] || '.img';
}

/* Selector de IMÁGENES (W107): sólo imágenes y copiadas a un archivo
   temporal.

   El selector de Android devuelve un content://, que la vista no puede
   medir ni mostrar de forma fiable; copiarlo a la carpeta temporal deja
   un archivo con ruta normal que se sube igual (FileAdapter lee
   cualquier ruta) y que el <Image> y ImageSource pueden abrir. */
export async function pickImage(): Promise<PickedFile | null> {
  const f = await pickFile('image/*');
  if (!f) return null;
  try {
    const bytes: any = await FileAdapter.readFileBytes({ path: f.path });
    if (bytes && bytes.byteLength) {
      const base = String(f.name || 'foto').replace(/[\/\\]/g, '_')
        .replace(/\.[a-z0-9]{1,5}$/i, '');
      const tmp = knownFolders.temp()
        .getFile('foxinix_img_' + Date.now() + '_' + base + extFor(f.name, f.type));
      tmp.writeSync(bytes);
      f.path = tmp.path;
      f.size = bytes.byteLength;
    }
  } catch (e) {
    /* Sin copia: se sube y se muestra desde el content:// original. */
  }
  return f;
}
