<template>
  <!-- W103: el registro usa la misma caja que el login (.auth-card):
       marca, título, subtítulo, campos etiquetados y botón ancho. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">

    <ScrollView>
      <StackLayout class="auth-wrap">
        <StackLayout class="auth-card">
          <Image class="auth-logo" src="res://ic_fox_logo_word" width="140"
                 height="56" stretch="aspectFit" :tintColor="accent" />

          <Label class="auth-title" :text="t('Crear cuenta')" textWrap="true" />
          <Label class="auth-sub" :text="t('Tres pasos y estás adentro')"
                 textWrap="true" />

          <Label v-if="err" class="form-err" :text="err" textWrap="true" />

          <!-- ---------- correo ---------- -->
          <StackLayout class="field">
            <Label class="field-label" :text="t('Correo electrónico')" />
            <TextField class="input" :hint="t('tu_correo@mail.com')" keyboardType="email"
                       :text="email" @textChange="email = $event.value"
                       autocorrect="false" autocapitalizationType="none"
                       :editable="!busy" />
          </StackLayout>

          <!-- ---------- usuario ---------- -->
          <StackLayout class="field">
            <Label class="field-label" :text="t('Nombre de usuario')" />
            <TextField class="input" hint="tu_usuario" :text="username"
                       @textChange="username = $event.value" autocorrect="false"
                       autocapitalizationType="none" :editable="!busy" />
            <Label class="hint" :text="t('Se usa para buscarte. Solo minúsculas.')"
                   textWrap="true" />
          </StackLayout>

          <!-- ---------- contraseña ---------- -->
          <StackLayout class="field">
            <Label class="field-label" :text="t('Contraseña')" />
            <TextField class="input" :hint="t('mínimo 8 caracteres')" secure="true"
                       :text="password" @textChange="password = $event.value"
                       :editable="!busy" />
          </StackLayout>

          <!-- ---------- repetir contraseña ---------- -->
          <StackLayout class="field">
            <Label class="field-label" :text="t('Repetir contraseña')" />
            <TextField class="input" secure="true" :text="confirm"
                       @textChange="confirm = $event.value" :editable="!busy" />
          </StackLayout>

          <Button class="btn btn-full" :class="{ busy: busy }"
                  :text="busy ? t('Creando cuenta…') : t('Continuar')"
                  :enabled="!busy" @tap="submit" />

          <Label class="btn-link auth-alt" :text="t('Ya tengo cuenta')"
                 @tap="goLogin" />
        </StackLayout>
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { computed, ref } from 'nativescript-vue';
  import { nativeRegister } from '../fox';
  import { go, store } from '../core/store.js';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const USER_RE = /^[a-z0-9][a-z0-9_.]{2,19}$/;

  const email = ref('');
  const username = ref('');
  const password = ref('');
  const confirm = ref('');
  const err = ref('');
  const busy = ref(false);

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));

  function validate() {
    if (!EMAIL_RE.test(email.value)) return t('Introduce un correo válido');
    if (!USER_RE.test(username.value)) {
      return t('Usuario: 3-20 caracteres (letras, números, punto o guion bajo), empezando con letra o número');
    }
    if (password.value.length < 8) return t('La contraseña necesita al menos 8 caracteres');
    if (password.value !== confirm.value) return t('Las contraseñas no coinciden');
    return '';
  }

  async function submit() {
    err.value = validate();
    if (err.value) return;
    busy.value = true;
    try {
      await nativeRegister(username.value.trim(), email.value.trim(), password.value);
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : t('No se pudo crear la cuenta');
    } finally {
      busy.value = false;
    }
  }

  function goLogin() {
    go('login');
  }
</script>
