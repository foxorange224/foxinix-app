<template>
  <!-- Avisos (toasts): el núcleo los mete en store.toasts y se borran
       solos a los 4 s. Acá se muestran flotando sobre la app. -->
  <GridLayout v-if="last" class="fox-toast-wrap" rows="auto"
              :style="{ marginBottom: offset + 'px' }">
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

  /* W103: los avisos flotan 22px del borde (como el .toasts de la web),
     pero si está la barra de pestañas (58px) hay que subir más para no
     taparla (la web: bottom = 76px + safe-area). */
  const props = withDefaults(defineProps<{ offset?: number }>(), { offset: 22 });
  const offset = computed(() => props.offset);

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
  margin-left: 16;
  margin-right: 16;
}

/* W103: el aviso flotante con los colores de la web (.toast). */
.fox-toast {
  background-color: var(--panel2);
  color: var(--t1);
  border-radius: 12;
  border-width: 1;
  border-color: var(--border);
  padding: 11 14;
  font-size: 14;
  text-align: center;
  android-elevation: 6;
}

.fox-toast.err {
  border-color: var(--err);
  color: var(--err);
}

.fox-toast.ok {
  border-color: var(--accent);
}
</style>
