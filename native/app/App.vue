<template>
  <!-- La raíz es un GridLayout para poder poner los avisos (toasts)
     ENCIMA de las vistas: en NS no hay un portal ni un z-index como en
     la web. -->
  <GridLayout rows="*,auto">
    <Frame row="0">
      <LoginView v-if="route === 'login'" />
      <RegisterView v-else-if="route === 'register'" />
      <VerifyView v-else-if="route === 'verify'" />
      <!-- con un chat abierto va la conversación; si no, la lista o
           el panel de personas -->
      <ChatView v-else-if="activeChatId" />
      <ProfileView v-else-if="view === 'profile'" :user-id="profileUserId" />
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
  import PeopleView from './views/PeopleView.vue';
  import NewGroupView from './views/NewGroupView.vue';
  import ProfileView from './views/ProfileView.vue';
  import NativeToasts from './components/NativeToasts.vue';

  /* La ruta vive en el store compartido: el núcleo decide, la vista
     nativa obedece. */
  const route = computed(() => store.route || 'login');
  const activeChatId = computed(() => store.activeChatId || 0);

  onMounted(() => {
    bootNative();
  });
</script>
