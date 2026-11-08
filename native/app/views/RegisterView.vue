<template>
  <Page>
    <ActionBar title="Crear cuenta" />

    <ScrollView>
      <StackLayout class="fox-wrap">
        <Label class="fox-title" text="Foxinix" />
        <Label class="fox-sub" text="Tres pasos y estás adentro" />

        <TextField
          class="fox-field"
          hint="Correo electrónico"
          keyboardType="email"
          :text="email"
          @textChange="email = $event.value"
          autocorrect="false"
          autocapitalizationType="none"
          :editable="!busy"
        />

        <TextField
          class="fox-field"
          hint="Usuario"
          :text="username"
          @textChange="username = $event.value"
          autocorrect="false"
          autocapitalizationType="none"
          :editable="!busy"
        />

        <TextField
          class="fox-field"
          hint="Contraseña"
          secure="true"
          :text="password"
          @textChange="password = $event.value"
          :editable="!busy"
        />

        <TextField
          class="fox-field"
          hint="Repetir contraseña"
          secure="true"
          :text="confirm"
          @textChange="confirm = $event.value"
          :editable="!busy"
        />

        <Label v-if="err" class="fox-err" :text="err" textWrap="true" />

        <Button class="fox-btn" :text="busy ? 'Creando cuenta…' : 'Crear cuenta'" :enabled="!busy" @tap="submit" />

        <Label class="fox-link" text="¿Ya tienes cuenta? Ingresa" @tap="goLogin" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { ref } from 'nativescript-vue';
  import { nativeRegister } from '../fox';
  import { go } from '../core/store.js';

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const USER_RE = /^[a-z0-9][a-z0-9_.]{2,19}$/;

  const email = ref('');
  const username = ref('');
  const password = ref('');
  const confirm = ref('');
  const err = ref('');
  const busy = ref(false);

  function validate() {
    if (!EMAIL_RE.test(email.value)) return 'Introduce un correo válido';
    if (!USER_RE.test(username.value)) {
      return 'Usuario: 3-20 caracteres (letras, números, punto o guion bajo), empezando con letra o número';
    }
    if (password.value.length < 8) return 'La contraseña necesita al menos 8 caracteres';
    if (password.value !== confirm.value) return 'Las contraseñas no coinciden';
    return '';
  }

  async function submit() {
    err.value = validate();
    if (err.value) return;
    busy.value = true;
    try {
      await nativeRegister(username.value.trim(), email.value.trim(), password.value);
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : 'No se pudo crear la cuenta';
    } finally {
      busy.value = false;
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
