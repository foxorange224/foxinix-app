<template>
  <!-- W103: verificación con la caja de la web (.auth-card): marca,
       título, aviso con el correo enmascarado, código de 6 dígitos y
       el enlace para reenviar. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">

    <ScrollView>
      <StackLayout class="auth-wrap">
        <StackLayout class="auth-card">
          <Image class="auth-logo" src="res://ic_fox_logo_word" width="140"
                 height="56" stretch="aspectFit" :tintColor="accent" />

          <Label class="auth-title" :text="t('Verifica tu correo')" textWrap="true" />

          <StackLayout class="verify-mail">
            <Label :text="t('Enviamos un código de 6 dígitos a')" textWrap="true" />
            <Label class="verify-mail-strong"
                   :text="masked || t('tu correo')" textWrap="true" />
          </StackLayout>

          <Label v-if="err" class="form-err auth-first" :text="err" textWrap="true" />
          <Label v-if="ok" class="fox-ok auth-first" :text="ok" textWrap="true" />

          <!-- ---------- código ---------- -->
          <StackLayout class="field auth-first">
            <TextField class="input code-input" :hint="'000000'"
                       keyboardType="number" :text="code"
                       @textChange="onCode" :editable="!busy"
                       @submit="submit" maxLength="6" />
          </StackLayout>

          <Button class="btn btn-full" :class="{ busy: busy }"
                  :text="busy ? t('Verificando…') : t('Verificar')"
                  :enabled="!busy && code.length === 6" @tap="submit" />

          <Label class="btn-link resend-row" :text="t('Reenviar código')"
                 @tap="resend" />

          <Label class="btn-link auth-alt" :text="t('Volver al inicio de sesión')"
                 @tap="goLogin" />
        </StackLayout>
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed } from 'nativescript-vue';
  import { api } from '../core/api.js';
  import { store, go, goReplace } from '../core/store.js';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';

  const code = ref('');
  const err = ref('');
  const ok = ref('');
  const busy = ref(false);

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));

  const masked = computed(() => store.pendingEmail || '');

  /* Sólo se guardan los 6 dígitos (como el maxlength del input web). */
  function onCode(e: any) {
    const v = String((e && e.value) || '').replace(/\D/g, '').slice(0, 6);
    code.value = v;
  }

  async function submit() {
    err.value = '';
    ok.value = '';
    if (!code.value) {
      err.value = t('Escribe el código que te enviamos');
      return;
    }
    busy.value = true;
    try {
      await api('POST', '/auth/verify', { code: code.value.trim() });
      ok.value = t('¡Listo! Entrando…');
      goReplace('app');
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : t('No se pudo verificar');
    } finally {
      busy.value = false;
    }
  }

  async function resend() {
    err.value = '';
    ok.value = '';
    try {
      await api('POST', '/auth/resend', { purpose: 'verify' });
      ok.value = t('Te enviamos un código nuevo');
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : t('No se pudo reenviar');
    }
  }

  function goLogin() {
    go('login');
  }
</script>
