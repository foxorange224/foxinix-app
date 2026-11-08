<template>
  <Frame>
    <LoginView v-if="route === 'login'" />
    <RegisterView v-else-if="route === 'register'" />
    <VerifyView v-else-if="route === 'verify'" />
    <!-- con un chat abierto va la conversación; si no, la lista -->
    <ChatView v-else-if="activeChatId" />
    <ChatListView v-else />
  </Frame>
</template>

<script setup lang="ts">
  import { computed, onMounted } from 'nativescript-vue';
  import { store } from './core/store.js';
  import { bootNative } from './fox';
  import LoginView from './views/LoginView.vue';
  import RegisterView from './views/RegisterView.vue';
  import VerifyView from './views/VerifyView.vue';
  import ChatListView from './views/ChatListView.vue';
  import ChatView from './views/ChatView.vue';

  /* La ruta vive en el store compartido: el núcleo decide, la vista
     nativa obedece. */
  const route = computed(() => store.route || 'login');
  const activeChatId = computed(() => store.activeChatId || 0);

  onMounted(() => {
    bootNative();
  });
</script>
