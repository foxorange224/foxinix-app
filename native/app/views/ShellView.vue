<template>
  <Page>
    <ActionBar title="Foxinix">
      <ActionItem text="Salir" @tap="doLogout" ios.position="right" />
    </ActionBar>

    <ScrollView>
      <StackLayout class="fox-wrap">
        <Label class="fox-title" :text="username" />
        <Label class="fox-sub" text="Sesión iniciada con el núcleo compartido" />

        <StackLayout class="fox-card">
          <Label class="fox-kv" :text="'ID: ' + userId" />
          <Label class="fox-kv" :text="'Correo verificado: ' + verified" />
          <Label class="fox-kv" :text="'Sesión guardada en el dispositivo: ' + persisted" />
        </StackLayout>

        <Label v-if="err" class="fox-err" :text="err" textWrap="true" />
        <Label v-if="ok" class="fox-ok" :text="ok" textWrap="true" />

        <Button class="fox-btn" text="Probar /users/me" @tap="ping" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
  import { ref, computed } from 'nativescript-vue';
  import { api, session } from '../core/api.js';
  import { store } from '../core/store.js';
  import { nativeLogout } from '../fox';

  const err = ref('');
  const ok = ref('');

  const user = computed(() => store.user || session.user || null);
  const username = computed(() => (user.value && user.value.username) || 'Foxinix');
  const userId = computed(() => (user.value && user.value.id) || '—');
  const verified = computed(() => (user.value && user.value.email_verified) ? 'sí' : 'no');
  /* En NS no hay cookie jar: el refresh queda guardado en el dispositivo
     (ApplicationSettings) en vez de una cookie HttpOnly. */
  const persisted = computed(() => session.legacy ? 'sí (modo nativo)' : 'no');

  async function ping() {
    err.value = '';
    ok.value = '';
    try {
      const r = await api('GET', '/users/me', undefined, { retry401: true });
      ok.value = 'El servidor respondió: ' + (r && r.user ? r.user.username : 'ok');
    } catch (e: any) {
      err.value = (e && e.detail) ? String(e.detail) : 'Falló la petición';
    }
  }

  function doLogout() {
    nativeLogout();
  }
</script>

<style>
.fox-wrap {
  padding: 20;
}

.fox-kv {
  font-size: 14;
  color: #c7d3da;
  margin-bottom: 6;
}
</style>
