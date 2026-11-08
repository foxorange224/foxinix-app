<template>
  <Page>
    <ActionBar title="Foxinix" />

    <ScrollView>
      <StackLayout class="fox-wrap">
        <Label class="fox-title" text="Foxinix" />
        <Label class="fox-sub" text="Tus mensajes, en tu bolsillo" />

        <TextField
          class="fox-field"
          hint="Usuario o correo"
          :text="identifier"
          @textChange="identifier = $event.value"
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
          @submit="submit"
        />

        <Label v-if="err" class="fox-err" :text="err" textWrap="true" />

        <Button class="fox-btn" :text="busy ? 'Entrando…' : 'Ingresar'" :enabled="!busy" @tap="submit" />

        <Label class="fox-link" text="¿No tienes cuenta? Regístrate" @tap="goRegister" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { ref } from 'nativescript-vue';
  import { nativeLogin } from '../fox';
  import { go } from '../core/store.js';

  const identifier = ref('');
  const password = ref('');
  const err = ref('');
  const busy = ref(false);

  async function submit() {
    err.value = '';
    if (!identifier.value || !password.value) {
      err.value = 'Completa el usuario y la contraseña';
      return;
    }
    busy.value = true;
    try {
      await nativeLogin(identifier.value.trim(), password.value);
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : 'No se pudo iniciar sesión';
    } finally {
      busy.value = false;
    }
  }

  function goRegister() {
    go('register');
  }
</script>

<style>
.fox-wrap {
  padding: 20;
}
</style>
