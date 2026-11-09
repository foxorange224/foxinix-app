<template>
  <!-- W105: la hoja de acciones del mensaje.

       En la web el menú aparece anclado a la burbuja (clic derecho) o
       en la barrita flotante (⋯). En el móvil lo natural es mantener
       pulsado el mensaje: sale esta hoja pegada abajo, con las 12
       reacciones rápidas y las acciones (responder, copiar, fijar,
       reenviar, editar, eliminar).

       OJO: en NS no hay position:fixed ni z-index. Por eso la hoja no
       es una ventana del sistema: es la última hija del GridLayout de
       la conversación (queda ENCIMA de todo) y el velo es un elemento
       hermano, no un padre (así el toque dentro de la hoja no lo
       cierra). -->
  <GridLayout class="sheet-veil" rows="*,auto">
    <!-- el velo: tocar fuera cierra la hoja -->
    <StackLayout row="0" class="sheet-backdrop" @tap="emit('close')" />

    <GridLayout row="1" class="sheet" rows="auto,auto,auto">
      <!-- reacciones rápidas (las mismas 12 de la web) -->
      <GridLayout row="0" class="sheet-reacts" rows="auto,auto"
                  :columns="reactCols">
        <Label v-for="(e, i) in QUICK" :key="e" class="sheet-react"
               :row="Math.floor(i / 6)" :col="i % 6" :text="e"
               textWrap="false" :accessibilityLabel="'react ' + e"
               @tap="react(e)" />
      </GridLayout>

      <!-- acciones -->
      <StackLayout row="1" class="sheet-list">
        <GridLayout v-for="a in actions" :key="a.key" class="sheet-act"
                    columns="auto,*" :accessibilityLabel="a.alt"
                    @tap="doAction(a)">
          <Image col="0" class="sheet-ic" :src="iconOf(a.icon)"
                 :tintColor="a.danger ? errColor : txtColor"
                 stretch="aspectFit" />
          <Label col="1" class="sheet-tx" :class="{ danger: a.danger }"
                 :text="a.label" textWrap="false" />
        </GridLayout>
      </StackLayout>

      <!-- cancelar -->
      <Label row="2" class="sheet-cancel" :text="t('Cancelar')"
             textWrap="false" accessibilityLabel="close message actions"
             @tap="emit('close')" />
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed } from 'nativescript-vue';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';
  import { store } from '../core/store.js';

  const props = defineProps<{
    /** El mensaje al que se le pide acción. */
    msg: any;
    /** ¿El mensaje es mío? (editar y eliminar) */
    mine?: boolean;
    /** ¿Soy owner/admin del grupo? (puedo borrar el de otro) */
    admin?: boolean;
    /** ¿El mensaje está fijado? */
    pinned?: boolean;
  }>();

  const emit = defineEmits<{
    close: [];
    reply: [];
    react: [string];
    copy: [];
    pin: [];
    forward: [];
    edit: [];
    delete: [];
  }>();

  /* Las 12 reacciones rápidas de la web (js/emoji.js: RACT_BASE). */
  const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏',
                 '🔥', '👏', '🥰', '😅', '😉', '🤝'];
  const reactCols = 'auto,auto,auto,auto,auto,auto';

  const txtColor = computed(() => tok(store.theme, 't1'));
  const errColor = computed(() => tok(store.theme, 'err'));

  function iconOf(name: string): string {
    /* AAPT2 no admite guiones en los recursos: "pin-off" → "pin_off". */
    return 'res://ic_fox_' + String(name).replace(/-/g, '_');
  }

  /* Las acciones del mensaje (mismas que el menú de la web). */
  const actions = computed(() => {
    const m = props.msg || {};
    const out: any[] = [
      { key: 'reply', icon: 'reply', label: t('Responder'), alt: 'reply' },
    ];
    if (m.body) {
      out.push({
        key: 'copy', icon: 'copy', label: t('Copiar texto'),
        alt: 'copy message text',
      });
    }
    out.push(props.pinned
      ? { key: 'pin', icon: 'pin-off', label: t('Desfijar mensaje'), alt: 'unpin message' }
      : { key: 'pin', icon: 'pin', label: t('Fijar mensaje'), alt: 'pin message' });
    out.push({
      key: 'forward', icon: 'forward', label: t('Reenviar…'),
      alt: 'forward message',
    });
    /* Editar y borrar: sólo lo tuyo (o lo de otro, si soy admin). */
    if (props.mine) {
      if (m.kind === 'text' && !m.media) {
        out.push({
          key: 'edit', icon: 'pencil', label: t('Editar'),
          alt: 'edit message',
        });
      }
      out.push({
        key: 'delete', icon: 'trash', label: t('Eliminar'), danger: true,
        alt: 'delete message',
      });
    } else if (props.admin) {
      out.push({
        key: 'delete', icon: 'trash', label: t('Eliminar mensaje'),
        danger: true, alt: 'delete message',
      });
    }
    return out;
  });

  function react(e: string) {
    emit('react', e);
  }

  function doAction(a: any) {
    switch (a.key) {
      case 'reply': emit('reply'); break;
      case 'copy': emit('copy'); break;
      case 'pin': emit('pin'); break;
      case 'forward': emit('forward'); break;
      case 'edit': emit('edit'); break;
      case 'delete': emit('delete'); break;
      default: break;
    }
  }
</script>
