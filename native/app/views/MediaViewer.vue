<template>
  <!-- W102: visor de imagen a pantalla completa.
       Se abre al tocar una imagen de la burbuja del chat. -->
  <Page>
    <ActionBar title="Imagen">
      <ActionItem text="Cerrar" @tap="close" ios.position="left" />
    </ActionBar>

    <GridLayout rows="*,auto">
      <ScrollView>
        <Image
          v-if="url"
          class="fox-mv-img"
          :src="url"
          stretch="aspectFit"
          @tap="close"
        />
        <Label v-else class="fox-empty" text="No se pudo cargar la imagen" />
      </ScrollView>

      <Label v-if="caption" class="fox-mv-cap" :text="caption" textWrap="true" />
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';
  import { mediaCaption, mediaUrl, back } from '../nav';

  const url = computed(() => mediaUrl.value || '');
  const caption = computed(() => mediaCaption.value || '');

  function close() {
    back();
  }
</script>

<style>
.fox-mv-img {
  /* La imagen se ve completa (contain) sin deformarse. */
  width: 100%;
  height: 100%;
  background-color: #0d1216;
}

.fox-mv-cap {
  color: #c8d6de;
  font-size: 14;
  padding: 12 16;
  background-color: #12181c;
}
</style>
