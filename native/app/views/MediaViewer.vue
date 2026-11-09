<template>
  <!-- W102: visor de imagen a pantalla completa.
       Se abre al tocar una imagen de la burbuja del chat.
       W103: como la luz de la web: fondo negro, la imagen completa y
       una X para cerrar (sin barra de acción). -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <GridLayout rows="*,auto" class="mv-page">
      <ScrollView row="0">
        <Image
          v-if="url"
          class="mv-img"
          :src="url"
          stretch="aspectFit"
          @tap="close"
        />
        <Label v-else class="fox-empty" :text="t('No se pudo cargar la imagen')"
               textWrap="true" />
      </ScrollView>

      <!-- X de cierre, encima de la imagen -->
      <GridLayout row="0" columns="*,auto" class="mv-top">
        <FoxIconBtn col="1" icon="x" bare :tint="'#ffffff'" @tap="close" />
      </GridLayout>

      <Label v-if="caption" class="mv-cap" :text="caption" textWrap="true" />
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';
  import { t } from '../core/i18n.js';
  import { mediaCaption, mediaUrl, back } from '../nav';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const url = computed(() => mediaUrl.value || '');
  const caption = computed(() => mediaCaption.value || '');

  function close() {
    back();
  }
</script>
