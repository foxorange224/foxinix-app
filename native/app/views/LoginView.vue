<template>
  <!-- W103: pantalla de login con la misma caja de la web (.auth-card):
       marca arriba, un solo título, campos etiquetados, botón ancho y
       el enlace para crear cuenta. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <ScrollView>
      <StackLayout class="auth-wrap">
        <StackLayout class="auth-card">
          <!-- La marca manda: sin título de texto debajo (igual que la web
               desde W27g). -->
          <Image class="auth-logo" src="res://ic_fox_logo_word" width="140"
                 height="56" stretch="aspectFit" :tintColor="accent" />

          <Label class="auth-title" :text="t('Inicia sesión en tu cuenta')"
                 textWrap="true" />

          <Label v-if="err" class="form-err auth-first" :text="err"
                 textWrap="true" />

          <!-- Ritmo vertical: 16px tras el título (o tras el aviso). -->
          <Label class="field-label" :class="{ 'auth-first': !err }"
                 :text="t('Usuario')" />
          <TextField class="input" :hint="t('tu_usuario')" :text="identifier"
                     @textChange="identifier = $event.value" autocorrect="false"
                     autocapitalizationType="none" :editable="!busy"
                     returnKeyType="next" />

          <Label class="field-label" :text="t('Contraseña')" />
          <!-- El botón del ojo va en su propia columna (como el .eye-btn
               de la web): el campo no se tapa. -->
          <GridLayout columns="*,auto">
            <TextField col="0" class="input" hint="••••••••" :secure="!show"
                       :text="password" @textChange="password = $event.value"
                       :editable="!busy" autocorrect="false"
                       autocapitalizationType="none" @submit="submit"
                       returnKeyType="go" />
            <FoxIconBtn col="1" :icon="show ? 'eye-off' : 'eye'" bare
                        :tint="muted"
                        :accessibilityLabel="show ? t('Ocultar contraseña') : t('Mostrar contraseña')"
                        @tap="show = !show" />
          </GridLayout>

          <Button class="btn btn-full" :class="{ busy: busy }"
                  :text="busy ? t('Entrando…') : t('Ingresar')" :enabled="!busy"
                  @tap="submit" />

          <Label class="btn-link auth-alt" :text="t('Crear cuenta')"
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
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const identifier = ref('');
  const password = ref('');
  const busy = ref(false);
  const err = ref('');
  const show = ref(false);

  const theme = computed(() => store.theme);

  /* Color del logo: el acento cambia con el tema (en claro es más
     oscuro para que contraste con el fondo). */
  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));

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
