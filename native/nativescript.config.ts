import { NativeScriptConfig } from '@nativescript/core';

export default {
  /* Id propio: la app webview (Tauri) usa io.foxinix.app, así que la
     app nativa lleva otro id y las DOS pueden estar instaladas en el
     mismo teléfono (mismo nombre visible: "Foxinix"). */
  id: 'io.foxinix.nativa',
  appPath: 'app',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
    /* La app nativa habla con la misma API que la web. */
    /* minSdkVersion / targetSdkVersion los pone el plugin de NativeScript. */
  },
} as NativeScriptConfig;
