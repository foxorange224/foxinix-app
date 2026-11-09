<template>
  <!-- La raíz es un GridLayout para poder poner los avisos (toasts)
     ENCIMA de las vistas: en NS no hay un portal ni un z-index como en
     la web. -->
  <!-- W103: la raíz lleva las dos clases: el tema (tokens --bg, --panel…)
       y el tamaño de letra. El tema va aquí para que TODAS las vistas
       hereden los tokens (también las que todavía no se rediseñaron),
       y el tamaño de letra porque font-size es heredado y así el
       usuario lo nota en toda la app. -->
  <GridLayout rows="*,auto"
              :class="'fs-' + (store.font || 'normal') + ' fox-' + (store.theme || 'dark')">
    <Frame row="0">
      <LoginView v-if="route === 'login'" />
      <RegisterView v-else-if="route === 'register'" />
      <VerifyView v-else-if="route === 'verify'" />
      <!-- W102: el visor de imagen va ANTES que el chat: cuando se abre
           desde la burbuja, el chat sigue activo (activeChatId) y el
           visor debe taparlo. -->
      <MediaViewer v-else-if="view === 'media'" />
      <!-- con un chat abierto va la conversación; si no, la lista o
           el panel de personas -->
      <ChatView v-else-if="activeChatId" />
      <ProfileView v-else-if="view === 'profile'" :user-id="profileUserId" />
      <SettingsView v-else-if="view === 'settings'" />
      <NewGroupView v-else-if="view === 'newgroup'" />
      <PeopleView v-else-if="view === 'people'" />
      <ChatListView v-else />
    </Frame>

    <NativeToasts row="1" />
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed, onMounted } from 'nativescript-vue';
  import { store } from './core/store.js';
  import { bootNative } from './fox';
  import { view, profileUserId } from './nav';
  import LoginView from './views/LoginView.vue';
  import RegisterView from './views/RegisterView.vue';
  import VerifyView from './views/VerifyView.vue';
  import ChatListView from './views/ChatListView.vue';
  import ChatView from './views/ChatView.vue';
  import MediaViewer from './views/MediaViewer.vue';
  import PeopleView from './views/PeopleView.vue';
  import NewGroupView from './views/NewGroupView.vue';
  import ProfileView from './views/ProfileView.vue';
  import SettingsView from './views/SettingsView.vue';
  import NativeToasts from './components/NativeToasts.vue';

  /* La ruta vive en el store compartido: el núcleo decide, la vista
     nativa obedece. */
  const route = computed(() => store.route || 'login');
  const activeChatId = computed(() => store.activeChatId || 0);

  /* Tamaño de letra (preferencia del núcleo): la clase .fs-* va en el
     layout raíz y font-size es heredado en NS, así que llega a todos
     los textos. (Poner :fontSize en un layout no sirve: fontSize sólo
     está proxyado en TextBase.) */

  onMounted(() => {
    bootNative();
  });
</script>
