<template>
  <!-- W109: aviso "Solicitud enviada." (como el RequestSentModal de la web).
       Overlay centrado. "Solicitudes" dispara requestsJump++ → App.vue
       lleva a Personas → pestaña Solicitudes y cierra el chat. -->
  <GridLayout rows="*,auto,*" columns="*,auto,*" class="newchat">
    <StackLayout row="0" col="0" rowSpan="3" colSpan="3" class="modal-veil"
                 @tap="emit('close')" />

    <GridLayout row="1" col="1" class="modal req-sent" :width="modalW">
      <header class="req-sent-head">
        <span class="m-head-title"><b>{{ t('Solicitud enviada.') }}</b></span>
      </header>
      <div class="req-sent-body">
        <span class="req-sent-check" aria-hidden="true">
          <Image col="0" src="res://ic_fox_check" width="36" height="36"
                 :tintColor="accent" stretch="aspectFit" />
        </span>
        <p class="req-sent-lead"
           :text="t('Se ha enviado solicitud a @{n}', { n: requestSentUsername })"
           textWrap="true" />
        <p class="req-sent-wait" textWrap="true">
          <span>{{ t('Espera a que acepte, podés ir a la sección') }}</span>
          <FoxIconBtn icon="chevron_down" bare :size="26" :ic="14"
                      :tint="accent" accessibilityLabel="solicitudes"
                      @tap="goRequests" />
        </p>
      </div>
      <div class="req-sent-foot">
        <Button col="0" class="btn req-ok" :text="t('Okey')" @tap="emit('close')" />
      </div>
    </GridLayout>
  </GridLayout>
</template>

<script setup lang="ts">
  /* W109: confirmación de solicitud de amistad enviada.
     Port del RequestSentModal.js de la web (mismos textos t()). */
  import { computed } from 'nativescript-vue';
  import { store } from '../core/store.js';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';
  import { Screen } from '@nativescript/core';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const emit = defineEmits<{ close: [] }>();

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));

  const modalW = computed(() => {
    try { return Math.min(380, Math.round(Screen.mainScreen.widthDIPs - 32)); }
    catch { return 300; }
  });

  const requestSentUsername = computed(() => {
    const rs: any = store.requestSent;
    return rs ? (rs.username || '') : '';
  });

  const goRequests = () => {
    store.requestSent = null;
    store.requestsJump++;
  };
</script>
