<template>
  <!-- Botón redondo de 40px con icono, como el `.icon-btn` de la web.
       El PNG sale en blanco puro (tools/icons.py) y lo tiñe `tintColor`
       (NS le pone un ColorFilter en Android). -->
  <StackLayout
    class="icon-btn"
    :class="{ on: active, bare: bare }"
    :width="size"
    :height="size"
    :borderRadius="size / 2"
    @tap="emit('tap')"
  >
    <Image
      :src="resName"
      :width="ic"
      :height="ic"
      stretch="aspectFit"
      :tintColor="tintColor"
    />
  </StackLayout>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';

  const props = withDefaults(
    defineProps<{
      /** Nombre del símbolo del sprite de la web (sin el prefijo i-). */
      icon: string;
      size?: number;
      ic?: number;
      /** Botón encendido (color de acento, como .icon-btn.on). */
      active?: boolean;
      /** Sin disco de color (el ＋ de la cabecera en móvil). */
      bare?: boolean;
      tint?: string;
    }>(),
    { size: 40, ic: 22, active: false, bare: false, tint: '#a3a3a3' },
  );

  const emit = defineEmits<{ tap: [] }>();

  /* AAPT2 no admite guiones en nombres de recurso: "eye-off" →
     "eye_off" (así los genera tools/icons.py). */
  const resName = computed(() => 'res://ic_fox_' + props.icon.replace(/-/g, '_'));
  const tintColor = computed(() => (props.active ? '#ff751f' : props.tint));
</script>
