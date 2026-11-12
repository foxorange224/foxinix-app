<template>
  <!-- W108: modal "Archivos y medios" (W29l de la web).

       Mismo patrón centrado que PinsView (velo hermano + celda del
       medio, regla NS9). La cuadrícula usa celdas de 104 px (96 de
       miniatura + 8 de hueco, como .gal-veil .pp-galimg de la web) y
       el número de columnas sale del ancho del modal, igual que el
       flex-wrap de la web. El alto del cuerpo se CALCULA. -->
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
          <Label class="pp-modal-t" :text="t('Archivos y medios')"
                 textWrap="false" />
          <Label v-if="count" class="pp-modal-i" :text="'(' + count + ')'"
                 textWrap="false" />
        </StackLayout>
        <FoxIconBtn col="1" icon="x" bare :size="32" :ic="16" :tint="muted"
                    accessibilityLabel="close gallery" @tap="emit('close')" />
      </GridLayout>

      <ScrollView row="1" :height="bodyH">
        <StackLayout class="pp-mbody">
          <Label v-if="loading && !gal" class="pp-loading"
                 :text="t('Cargando…')" textWrap="false" />
          <Label v-else-if="!gal || (!gal.images.length && !gal.files.length)"
                 class="pp-loading" :text="t('Sin archivos')" textWrap="false" />

          <!-- miniaturas: el primer toque revela el spoiler, el
               segundo abre el visor (openMedia) -->
          <GridLayout v-if="gal && gal.images.length" class="pp-galgrid"
                      :rows="gridRows" :columns="gridCols">
            <GridLayout v-for="(im, i) in gal.images" :key="'im' + im.msg_id"
                        :row="Math.floor(i / cols)" :col="i % cols"
                        rows="*" columns="*" class="pp-galimg"
                        horizontalAlignment="left" verticalAlignment="top"
                        @tap="galClick(im)">
              <Image col="0" row="0" :src="imgUrl(im)" width="96" height="96"
                     stretch="aspectFill" horizontalAlignment="left"
                     verticalAlignment="top" />
              <StackLayout v-if="galSpoiled(im)" col="0" row="0"
                           class="gal-spoil" width="96" height="96"
                           horizontalAlignment="left" verticalAlignment="top">
                <Image src="res://ic_fox_eye_off" width="18" height="18"
                       tintColor="#ffffff" horizontalAlignment="center"
                       verticalAlignment="center" />
              </StackLayout>
            </GridLayout>
          </GridLayout>

          <!-- los archivos saltan a su mensaje (el modal cierra) -->
          <GridLayout v-for="f in (gal ? gal.files : [])" :key="'f' + f.msg_id"
                      class="pp-pinrow" rows="auto,auto"
                      accessibilityLabel="file row" @tap="emit('jump', f)">
            <Label row="0" class="pp-pinrow-t" :text="fileName(f)"
                   textWrap="false" />
            <Label row="1" class="pp-pinrow-s" :text="fileSize(f)"
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
  import { fmtSize, mediaUrl } from '../core/actions.js';
  import { t } from '../core/i18n.js';
  import { store } from '../core/store.js';
  import { openMedia } from '../nav';
  import { tok } from '../fmt';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const props = defineProps<{
    /** {images, files} del chat (lo pide y guarda ChatInfoView). */
    gal: any;
    /** ¿Todavía se está cargando? */
    loading?: boolean;
  }>();

  const emit = defineEmits<{ close: []; jump: [any] }>();

  const muted = computed(() => tok(store.theme, 't2'));

  const count = computed(() => {
    const g = props.gal;
    if (!g) return 0;
    return (g.images ? g.images.length : 0) + (g.files ? g.files.length : 0);
  });

  /* Ancho: min(460, pantalla − 32), como .pp-modal de la web. */
  const modalW = computed(() => {
    try {
      return Math.min(460, Math.round(Screen.mainScreen.widthDIPs - 32));
    } catch (e) { return 328; }
  });

  /* Columnas de la cuadrícula: 104 px por miniatura (96 + 8 de
     hueco) dentro del cuerpo del modal, como el flex-wrap de la web. */
  const cols = computed(() => {
    const avail = modalW.value - 16;   /* padding del pp-mbody */
    return Math.max(3, Math.floor(avail / 104));
  });

  const gridCols = computed(() =>
    Array(cols.value).fill('104').join(','));

  const gridRows = computed(() => {
    const n = props.gal && props.gal.images ? props.gal.images.length : 0;
    return Array(Math.max(1, Math.ceil(n / cols.value))).fill('104').join(',');
  });

  /* Alto del cuerpo: miniaturas (filas de 104) + archivos (filas de
     58) + margen, tope min(460, 64 % de la pantalla). */
  const bodyH = computed(() => {
    const g = props.gal;
    const nIm = g && g.images ? g.images.length : 0;
    const nFi = g && g.files ? g.files.length : 0;
    const nRows = Math.ceil(nIm / cols.value);
    const raw = nRows * 104 + (nRows > 0 && nFi > 0 ? 6 : 0) + nFi * 58 + 20;
    let cap = 460;
    try { cap = Math.min(460, Math.round(Screen.mainScreen.heightDIPs * 0.64)); } catch (e) { /* tope fijo */ }
    return Math.min(Math.max(raw, 64), cap);
  });

  function imgUrl(im: any): string {
    try {
      return im && im.media && im.media.url ? mediaUrl(im.media.url) : '';
    } catch (e) { return ''; }
  }

  /* ¿La miniatura sigue tapada? (spoiler sin revelar, como la web) */
  function galSpoiled(item: any): boolean {
    if (!item || !item.spoiler) return false;
    const s = store.spoilSeen[store.activeChatId];
    return !(s && s[item.msg_id]);
  }

  /* Primer toque: revela (spoilSeen); segundo: abre el visor. */
  function galClick(item: any) {
    if (galSpoiled(item)) {
      if (!store.spoilSeen[store.activeChatId]) {
        store.spoilSeen[store.activeChatId] = {};
      }
      store.spoilSeen[store.activeChatId][item.msg_id] = 1;
      return;
    }
    const u = imgUrl(item);
    if (u) openMedia(u);
  }

  function fileName(f: any): string {
    if (!f) return '';
    if (galSpoiled(f)) return t('Spoiler');
    return (f.media && f.media.name) || t('Archivo');
  }

  function fileSize(f: any): string {
    return f && f.media ? fmtSize(f.media.size) : '';
  }
</script>
