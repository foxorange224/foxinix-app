<template>
  <Page>
    <ActionBar title="Verifica tu correo" />

    <ScrollView>
      <StackLayout class="fox-wrap">
        <Label class="fox-title" text="Foxinix" />
        <Label class="fox-sub" :text="masked ? 'Te enviamos un código a ' + masked : 'Te enviamos un código por correo'" textWrap="true" />

        <TextField
          class="fox-field"
          hint="Código de verificación"
          keyboardType="number"
          :text="code"
          @textChange="code = $event.value"
          :editable="!busy"
          @submit="submit"
        />

        <Label v-if="err" class="fox-err" :text="err" textWrap="true" />
        <Label v-if="ok" class="fox-ok" :text="ok" textWrap="true" />

        <Button class="fox-btn" :text="busy ? 'Verificando…' : 'Verificar'" :enabled="!busy" @tap="submit" />
        <Label class="fox-link" text="Reenviar código" @tap="resend" />
        <Label class="fox-link" text="Volver al inicio de sesión" @tap="goLogin" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed } from 'nativescript-vue';
  import { api } from '../core/api.js';
  import { store, go, goReplace } from '../core/store.js';

  const code = ref('');
  const err = ref('');
  const ok = ref('');
  const busy = ref(false);

  const masked = computed(() => store.pendingEmail || '');

  async function submit() {
    err.value = '';
    ok.value = '';
    if (!code.value) {
      err.value = 'Escribe el código que te enviamos';
      return;
    }
    busy.value = true;
    try {
      await api('POST', '/auth/verify', { code: code.value.trim() });
      ok.value = '¡Listo! Entrando…';
      goReplace('app');
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : 'No se pudo verificar';
    } finally {
      busy.value = false;
    }
  }

  async function resend() {
    err.value = '';
    ok.value = '';
    try {
      await api('POST', '/auth/resend', { purpose: 'verify' });
      ok.value = 'Te enviamos un código nuevo';
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : 'No se pudo reenviar';
    }
  }

  function goLogin() {
    go('login');
  }
</script>

<style>
.fox-wrap {
  padding: 20;
}
</style>
