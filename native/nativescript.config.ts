import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'io.foxinix.app',
  appPath: 'app',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
    /* La app nativa habla con la misma API que la web. */
    /* minSdkVersion / targetSdkVersion los pone el plugin de NativeScript. */
  },
} as NativeScriptConfig;
