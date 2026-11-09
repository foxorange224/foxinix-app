<template>
  <!-- W103: pantalla de login con la misma caja de la web (.auth-card):
       marca arriba, un solo título, campos etiquetados y botón ancho. -->
  <Page :class="'fox-' + theme">
    <ActionBar actionBarHidden="true" />

    <ScrollView>
      <StackLayout class="auth-wrap">
        <StackLayout class="auth-card">
          <!-- La marca manda: sin título de texto debajo (igual que la web
               desde W27g). -->
          <Image class="auth-logo" src="res://ic_fox_logo_word" width="140"
                 height="56" stretch="aspectFit" :tintColor="accent" />

          <Label class="auth-title" text="Inicia sesión en tu cuenta"
                 textWrap="true" />

          <Label v-if="err" class="form-err auth-first" :text="err"
                 textWrap="true" />

          <!-- Ritmo vertical: 16px tras el título (o tras el aviso). -->
          <Label class="field-label" :class="{ 'auth-first': !err }"
                 text="Usuario o correo" />
          <TextField class="input" hint="tu.usuario" :text="identifier"
                     @textChange="identifier = $event.value" autocorrect="false"
                     autocapitalizationType="none" :editable="!busy"
                     returnKeyType="next" />

          <Label class="field-label" text="Contraseña" />
          <TextField class="input" hint="••••••••" secure="true" :text="password"
                     @textChange="password = $event.value" :editable="!busy"
                     @submit="submit" returnKeyType="go" />

          <Button class="btn btn-full" :class="{ busy: busy }"
                  :text="busy ? 'Entrando…' : 'Ingresar'" :enabled="!busy"
                  @tap="submit" />

          <Label class="btn-link auth-alt" text="¿No tienes cuenta? Regístrate"
                 @tap="goRegister" />
        </StackLayout>
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { computed, ref } from 'nativescript-vue';
  import { nativeLogin } from '../fox';
  import { go, store } from '../core/store.js';
  import { t } from '../core/i18n.js';
  import { tok } from '../fmt';

  const identifier = ref('');
  const password = ref('');
  const busy = ref(false);
  const err = ref('');

  const theme = computed(() => store.theme);

  /* Color del logo: el acento cambia con el tema (en claro es más
     oscuro para que contraste con el fondo). */
  const accent = computed(() => tok(store.theme, 'accent'));

  async function submit() {
    if (busy.value) return;
    const id = identifier.value.trim();
    if (!id || !password.value) {
      err.value = t('Completa todos los campos');
      return;
    }
    busy.value = true;
    err.value = '';
    try {
      await nativeLogin(id, password.value);
      /* Si llega acá, store.user ya está: App.vue cambia de vista. */
    } catch (e: any) {
      err.value = (e && (e.message || e.detail)) || t('No se pudo iniciar sesión');
    } finally {
      busy.value = false;
    }
  }

  function goRegister() {
    go('register');
  }
</script>
