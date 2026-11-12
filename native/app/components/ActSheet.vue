<template>
  <!-- W108: hoja inferior genérica para los menús de la info del chat.

       Es el bottom sheet de la web (CtxMenu en móvil, W54c) con la
       MISMA estructura que MsgSheet: el velo es hermano de la hoja y
       ambos son la ÚLTIMA hija del GridLayout que los monta (en NS no
       hay position:fixed ni z-index: el orden manda).

       Los rótulos se traducen en el render con t(it.label), igual que
       CtxMenu: la clave ES el texto en español y los menús se arman
       con los mismos textos que ui-actions.js de la web. -->
  <GridLayout class="sheet-veil" rows="*,auto">
    <!-- el velo: tocar fuera cierra la hoja -->
    <StackLayout row="0" class="sheet-backdrop" @tap="emit('close')" />

    <GridLayout row="1" class="sheet act-sheet" rows="auto,auto,auto">
      <!-- título opcional (los menús de la info van sin cabecera:
           el ctx-head de la web queda pendiente) -->
      <Label v-if="title" row="0" class="sheet-title" :text="title"
             textWrap="true" />

      <!-- la lista de acciones -->
      <StackLayout row="1" class="sheet-list">
        <GridLayout v-for="(it, i) in items" :key="'act' + i"
                    class="sheet-act" columns="auto,*" @tap="run(it)">
          <Image v-if="it.icon" col="0" class="sheet-ic" :src="iconOf(it.icon)"
                 :tintColor="it.danger ? errColor : txtColor"
                 stretch="aspectFit" />
          <Label col="1" class="sheet-tx" :class="{ danger: it.danger }"
                 :text="t(it.label)" textWrap="false" />
        </GridLayout>
      </StackLayout>

      <!-- cancelar (al pie de la hoja) -->
      <Label row="2" class="sheet-cancel" :text="t('Cancelar')" textWrap="false"
             accessibilityLabel="close menu" @tap="emit('close')" />
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';
  import { store } from '../core/store.js';

  const props = defineProps<{
    /** Título opcional de la hoja (sin cabecera de avatar). */
    title?: string;
    /** Ítems: {label, icon, danger, fn}. El label va SIN traducir
        (se traduce en el render, como en CtxMenu). */
    items: any[];
  }>();

  const emit = defineEmits<{ close: [] }>();

  const txtColor = computed(() => tok(store.theme, 't1'));
  const errColor = computed(() => tok(store.theme, 'err'));

  /* AAPT2 no admite guiones en los recursos: "bell-off" → "bell_off". */
  function iconOf(name: string): string {
    return 'res://ic_fox_' + String(name).replace(/-/g, '_');
  }

  /* Como runCtx() de CtxMenu: primero se cierra la hoja (para que los
     diálogos y avisos queden encima) y después corre la acción. */
  function run(it: any) {
    emit('close');
    if (it && it.fn) it.fn();
  }
</script>
