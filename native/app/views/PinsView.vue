<template>
  <!-- W108: modal "Mensajes fijados" (W29l de la web).

       Centrado con el truco de las3 filas/3 columnas (regla NS9: sin
       position:fixed ni z-index): el velo cubre todo el GridLayout y
       el modal va en la celda del medio. El alto del cuerpo se CALCULA
       (filas de58 px + 20 de margen, tope 460 o64 % de pantalla):
       en NS una fila `*` dentro de una fila `auto` no se resuelve de
       forma fiable. -->
  <GridLayout rows="*,auto,*" columns="*,auto,*">
    <StackLayout row="0" col="0" rowSpan="3" colSpan="3" class="modal-veil"
                 @tap="emit('close')" />

    <GridLayout row="1" col="1" class="modal pp-modal" rows="auto,*"
                :width="modalW">
      <!-- título + (cantidad) por separado: el conteo va en t2/500
           (pp-modal-i), como <i> de la cabecera de la web; cerrar al
           extremo derecho -->
      <GridLayout row="0" class="pp-modal-head" columns="*,auto">
        <StackLayout col="0" orientation="horizontal"
                     verticalAlignment="center">
          <Label class="pp-modal-t" :text="t('Mensajes fijados')"
                 textWrap="false" />
          <Label v-if="pins.length" class="pp-modal-i"
                 :text="'(' + pins.length + ')'" textWrap="false" />
        </StackLayout>
        <FoxIconBtn col="1" icon="x" bare :size="32" :ic="16" :tint="muted"
                    accessibilityLabel="close pins" @tap="emit('close')" />
      </GridLayout>

      <ScrollView row="1" :height="bodyH">
        <StackLayout class="pp-mbody">
          <Label v-if="loading && !pins.length" class="pp-loading"
                 :text="t('Cargando…')" textWrap="false" />
          <Label v-else-if="!pins.length" class="pp-loading"
                 :text="t('Sin mensajes fijados')" textWrap="false" />
          <!-- tocar un fijado salta a su mensaje (el panel cierra) -->
          <GridLayout v-for="p in pins" :key="p.id" class="pp-pinrow"
                      rows="auto,auto" accessibilityLabel="pin row"
                      @tap="emit('jump', p)">
            <Label row="0" class="pp-pinrow-t" :text="senderOf(p)"
                   textWrap="false" />
            <!-- una sola línea con puntos (nowrap/ellipsis de la web) -->
            <Label row="1" class="pp-pinrow-s" :text="bodyOf(p)"
                   textWrap="false" />
          </GridLayout>
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';
  import { Screen } from '@nativescript/core';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';
  import { store } from '../core/store.js';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const props = defineProps<{
    /** Fijados del chat (los pide y guarda ChatInfoView, como la web). */
    pins: any[];
    /** ¿Todavía se están cargando? */
    loading?: boolean;
  }>();

  const emit = defineEmits<{ close: []; jump: [any] }>();

  const muted = computed(() => tok(store.theme, 't2'));

  /* Ancho: min(460, pantalla − 32), como .pp-modal de la web. */
  const modalW = computed(() => {
    try {
      return Math.min(460, Math.round(Screen.mainScreen.widthDIPs - 32));
    } catch (e) { return 328; }
  });

  /* Alto del cuerpo: n filas de 58 px + 20 de margen, tope
     min(460, 64 % de la pantalla). */
  const bodyH = computed(() => {
    const n = Math.max(1, props.pins.length);
    let cap = 460;
    try { cap = Math.min(460, Math.round(Screen.mainScreen.heightDIPs * 0.64)); } catch (e) { /* tope fijo */ }
    return Math.min(n * 58 + 20, cap);
  });

  function senderOf(p: any): string {
    const s = (p && p.sender) || {};
    return s.display_name || s.username || '';
  }

  /* Texto del fijado: mismo criterio que la web (spoiler, cuerpo,
     nota de voz o nombre del archivo). */
  function bodyOf(p: any): string {
    if (!p) return '';
    if (p.spoiler) return t('Spoiler');
    if (p.body) return p.body;
    if (p.kind === 'voice') return t('Nota de voz');
    if (p.media) return p.media.name || t('Archivo');
    return '';
  }
</script>
