<template>
  <!-- Avisos (toasts): el núcleo los mete en store.toasts y se borran
       solos a los 4 s. Acá se muestran flotando sobre la app. -->
  <GridLayout v-if="last" class="fox-toast-wrap" rows="auto">
    <Label
      class="fox-toast"
      :class="last.kind === 'err' ? 'err' : 'ok'"
      :text="last.msg"
      textWrap="true"
    />
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';
  import { store } from '../core/store.js';

  /* El núcleo muestra UN aviso a la vez (store.toasts se limpia antes de
     pushear), así que basta el último. */
  const last = computed(() => {
    const list = store.toasts || [];
    return list.length ? list[list.length - 1] : null;
  });
</script>

<style>
.fox-toast-wrap {
  vertical-align: bottom;
  horizontal-align: center;
  margin-bottom: 24;
  margin-left: 16;
  margin-right: 16;
}

.fox-toast {
  background-color: #1d2b34;
  color: #e8edf2;
  border-radius: 10;
  border-width: 1;
  border-color: #2b3d49;
  padding: 10 14;
  font-size: 14;
  text-align: center;
  android-elevation: 6;
}

.fox-toast.err {
  background-color: #3a1f1f;
  border-color: #7a3b3b;
  color: #ffd9d9;
}

.fox-toast.ok {
  background-color: #17301f;
  border-color: #2f6b45;
  color: #d7ffe6;
}
</style>
