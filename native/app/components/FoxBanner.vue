<template>
  <!-- W107: portada de perfil con la posición vertical de la web
       (object-position: 50% N%).

       NativeScript no tiene object-position, así que:
         - con la posición de por defecto (50 %) la imagen se dibuja con
           aspectFill, exactamente como hasta ahora (sin descargar nada
           ni cambiar nada);
         - cuando el usuario mueve la posición, se miden las dimensiones
           reales de la imagen, se escala para CUBRIR el hueco y se la
           desplaza con translateY. El contenedor la recorta
           (clipToBounds, por defecto en los Layout de Android).

       `rounded` (la portada del editor, con radio de 12) enciende el
       recorte redondeado con setClipToOutline, sólo si el fondo del
       contenedor de verdad puede recortar (si no, se queda cuadrado:
       nunca se queda en blanco). -->
  <GridLayout
    ref="box"
    class="fb"
    :class="{ 'fb-rounded': rounded }"
    :height="height"
    rows="auto"
    columns="*"
    @tap="emit('tap')"
  >
    <Image
      v-if="src && sized"
      row="0"
      col="0"
      class="fb-img"
      :src="src"
      stretch="aspectFill"
      :width="sized.w"
      :height="sized.h"
      horizontalAlignment="center"
      verticalAlignment="top"
      :translateY="offsetY"
    />
    <Image
      v-else-if="src"
      row="0"
      col="0"
      class="fb-img"
      :src="src"
      stretch="aspectFill"
      width="100%"
      :height="height"
    />
    <Image
      v-else
      row="0"
      col="0"
      class="fb-art"
      src="res://ic_fox_logo_mark"
      width="128"
      height="128"
      :tintColor="tint"
      opacity="0.18"
    />
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'nativescript-vue';
  import { ImageSource, Screen } from '@nativescript/core';
  import { store } from '../core/store.js';
  import { bannerPositionOf, tok } from '../fmt';

  const props = withDefaults(
    defineProps<{
      /** Ruta relativa del medio (la firma la pone mediaUrl). */
      src?: string;
      /** 0 (arriba) … 100 (abajo); por defecto la del usuario. */
      position?: number;
      /** Alto de la portada en dp (132 en la ficha, 96 en el editor). */
      height?: number;
      /** Ancho del hueco (para escalar la imagen): 0 = pantalla. */
      boxWidth?: number;
      /** Portada con esquinas redondeadas (editor). */
      rounded?: boolean;
    }>(),
    { src: '', position: -1, height: 132, boxWidth: 0, rounded: false },
  );

  const emit = defineEmits<{ tap: [] }>();

  const box = ref<any>(null);
  /* Medidas reales de la imagen (0 = todavía no se midió). */
  const nat = ref<{ w: number; h: number } | null>(null);

  const tint = computed(() => tok(store.theme, 'onAccent'));

  /* Ancho del hueco: el de la pantalla salvo que se pase otro. */
  const boxW = computed(() => {
    if (props.boxWidth > 0) return props.boxWidth;
    try { return Screen.mainScreen.widthDIPs; } catch (e) { return 0; }
  });

  /* Posición efectiva: -1 = la del perfil (o 50 si no hay). */
  const pos = computed(() => {
    if (props.position >= 0) return props.position;
    return bannerPositionOf((store as any).user);
  });

  const sized = computed(() => {
    const n = nat.value;
    const w = boxW.value;
    if (!n || !w || !n.w || !n.h) return null;
    const scale = Math.max(w / n.w, props.height / n.h);
    return { w: Math.round(n.w * scale), h: Math.round(n.h * scale) };
  });

  const offsetY = computed(() => {
    const s = sized.value;
    if (!s) return 0;
    return Math.round((0.5 - pos.value / 100) * (s.h - props.height));
  });

  /* Sólo hace falta medir si la posición se movió del centro (con 50 %
     el aspectFill ya dibuja exactamente lo mismo). */
  async function measure() {
    if (nat.value) return;
    const s = props.src;
    if (!s || pos.value === 50) return;
    try {
      let im: any = null;
      if (/^https?:/i.test(s)) {
        /* La MISMA URL que se le pasa al <Image>: si se mide otra, el
           encuadre no coincide con lo que se dibuja. */
        im = await ImageSource.fromUrl(s);
      } else {
        im = ImageSource.fromFileSync(String(s).replace(/^file:\/\//, ''));
      }
      if (im && im.width > 0 && im.height > 0) {
        nat.value = { w: im.width, h: im.height };
      }
    } catch (e) {
      /* Sin medidas: se ve centrada (el aspectFill de siempre). */
      nat.value = null;
    }
  }

  watch(
    () => props.src,
    () => {
      nat.value = null;
      measure();
    },
    { immediate: true },
  );
  watch(() => pos.value, () => { measure(); });

  /* Recorte redondeado (sólo donde hace falta y sólo si el fondo del
     contenedor puede recortar: si no, el contenedor quedaría vacío). */
  function applyClip() {
    if (!props.rounded) return;
    try {
      const el: any = box.value;
      const v = el && (el.nativeView || el);
      const g: any = (globalThis as any).android;
      if (!v || !g || typeof v.setClipToOutline !== 'function') return;
      const outline = new g.graphics.Outline();
      const provider = v.getOutlineProvider();
      if (provider && typeof provider.getOutline === 'function') {
        provider.getOutline(v, outline);
        if (outline && outline.canClip && outline.canClip()) {
          v.setClipToOutline(true);
        }
      }
    } catch (e) { /* sin recorte redondeado: se ve cuadrado */ }
  }

  onMounted(applyClip);
  watch(() => props.rounded, applyClip);
</script>
