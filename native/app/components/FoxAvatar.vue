<template>
  <!-- Avatar redondo con foto o iniciales y el puntito de estado de la
       web (mismos colores Discord: verde/ámbar/rojo/gris). La rejilla
       sirve a la vez de círculo (fondo) y de ancla para el puntito,
       que va abajo a la derecha con su aro del color de la superficie
       donde vive (prop `ring`: --panel en la lista, --chat-bg en la
       cabecera del chat). -->
  <GridLayout
    class="avatar"
    :class="{ 'has-photo': !!src, flat: flat }"
    :width="size"
    :height="size"
    :borderRadius="half"
    rows="*,auto"
    columns="*,auto"
    @tap="emit('tap')"
  >
    <Image
      v-if="src"
      row="0"
      col="0"
      rowSpan="2"
      colSpan="2"
      class="av-img"
      :src="src"
      :width="size"
      :height="size"
      :borderRadius="half"
      stretch="aspectFill"
    />
    <Label
      v-else
      row="0"
      col="0"
      rowSpan="2"
      colSpan="2"
      class="av-ini"
      :text="initial || '?'"
      :fontSize="iniSize"
      :textWrap="false"
    />
    <StackLayout
      v-if="dot"
      row="1"
      col="1"
      class="st-dot"
      :width="DOT"
      :height="DOT"
      :borderRadius="DOT / 2"
      :backgroundColor="dotColor"
      :borderColor="ring"
      :borderWidth="2.5"
    />
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';

  const props = withDefaults(
    defineProps<{
      src?: string;
      initial?: string;
      size?: number;
      /** '' = sin puntito (grupos / sin usuario). */
      dot?: string;
      /** Color del aro que separa el puntito del fondo. */
      ring?: string;
      /** Avatar de mensaje: disco gris con letra apagada (.msg-av). */
      flat?: boolean;
    }>(),
    { src: '', initial: '', size: 48, dot: '', ring: '#2b2d31', flat: false },
  );

  const emit = defineEmits<{ tap: [] }>();

  /* Puntito de 14px, como en la web (.av-wrap.on::after). */
  const DOT = 14;

  const half = computed(() => props.size / 2);

  /* Tamaño de la letra: 48→18, 38→15, 30→13 (la web usa 1.125rem,
     0.9375rem y 0.8125rem respectivamente); en el avatar de mensaje
     plano (28px) manda 12, como `.msg-av i`. */
  const iniSize = computed(() =>
    (props.flat ? 12
      : props.size >= 46 ? 18
      : props.size >= 34 ? 15 : 13));

  const dotColor = computed(() => {
    switch (props.dot) {
      case 'busy': return '#f0b232';
      case 'dnd': return '#f23f43';
      case 'off': return '#80848e';
      default: return '#23a55a';
    }
  });
</script>
