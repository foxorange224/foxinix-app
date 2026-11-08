/* files-picker.ios.ts — selector de archivos en iOS.

   Se usa UIDocumentPickerViewController a través del plugin
   ui-document-picker (su implementación de iOS no pide permisos ni
   necesita nada de Storage). El plugin entra en el bundle SÓLO de iOS:
   en Android el selector es el SAF propio (files-picker.android.ts). */

import { openFilePicker } from '@nativescript-community/ui-document-picker';

export async function pickPlatformFile(): Promise<string> {
  const res = await openFilePicker({ multipleSelection: false });
  const files = (res && res.files) || [];
  return files.length ? String(files[0]) : '';
}
