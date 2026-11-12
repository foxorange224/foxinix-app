<template>
  <GridLayout rows="*,auto" androidOverflowEdge="none" class="app-root"
              :class="'fs-' + (store.font || 'normal') + ' fox-' + (store.theme || 'dark')">
    <Frame row="0">
      <LoginView v-if="route === 'login'" />
      <RegisterView v-else-if="route === 'register'" />
      <VerifyView v-else-if="route === 'verify'" />
      <!-- W102: el visor de imagen va ANTES que el chat: cuando se abre
           desde la burbuja, el chat sigue activo (activeChatId) y el
           visor debe taparlo. -->
      <MediaViewer v-else-if="view === 'media'" />
      <!-- W105: la pantalla de reenviar también va antes que el chat
           (el chat sigue abierto debajo). -->
      <ForwardView v-else-if="view === 'forward'" />
      <!-- W107: "Tu perfil" y su edición van ANTES que el chat (como
           el visor y el reenviar): se abren desde la cabecera de la
           lista o de Personas y el chat sigue debajo. -->
      <MyProfileView v-else-if="view === 'myprofile'" />
      <MyProfileEditView v-else-if="view === 'myprofileedit'" />
      <UsernameView v-else-if="view === 'uname'" />
      <!-- W108: el perfil de OTRO usuario también va antes que el chat
           (misma razón): desde el panel de info se abre el perfil con
           el chat todavía abierto debajo. -->
      <ProfileView v-else-if="view === 'profile'" :user-id="profileUserId" />
      <!-- con un chat abierto va la conversación; si no, la lista o
           el panel de personas -->
      <ChatView v-else-if="activeChatId" />
      <SettingsView v-else-if="view === 'settings'" />
      <NewGroupView v-else-if="view === 'newgroup'" />
      <PeopleView v-else-if="view === 'people'" />
      <ChatListView v-else />
    </Frame>

    <!-- W103: barra de pestañas de abajo (como la .mobile-tabs de la web).
         Los avisos flotantes van en la fila 0 con rowSpan=2 para que
         queden ENCIMA de todo (en NS no hay z-index: manda el orden).
         La barra queda por encima de la barra de navegación del sistema
         porque la raíz ya se quedó dentro de la zona segura. -->
    <FoxTabBar v-if="showTabs" row="1" :tab="currentTab" @tab="onTab" />
    <NativeToasts row="0" rowSpan="2" :offset="showTabs ? 76 : 22" />
  </GridLayout>
</template>

<script setup lang="ts">
  /* W103: la raíz es un GridLayout para poder poner los avisos (toasts)
     ENCIMA de las vistas: en NS no hay un portal ni un z-index como en
     la web.

     W103: la raíz lleva las dos clases: el tema (tokens --bg, --panel…)
     y el tamaño de letra. El tema va aquí para que TODAS las vistas
     hereden los tokens (también las que todavía no se rediseñaron),
     y el tamaño de letra porque font-size es heredado y así el
     usuario lo nota en toda la app.

     W103: androidOverflowEdge="none" en la raíz = la raíz se queda
     DENTRO de la zona segura: los insets del sistema (barra de estado
     arriba, barra de navegación abajo y teclado) se le suman como
     padding y el contenido se dibuja entre ellos.
     OJO: va en la RAÍZ y no en la barra de pestañas, porque la raíz
     tiene la altura fija (100%) y el padding sólo le encoge el
     contenido; en la barra de pestañas (altura automática) el padding
     se le come el hueco de los iconos y las etiquetas.

     W106: el template no puede tener comentarios en el nivel del root:
     un comentario ahí hace que la raíz compile a un Fragment, y en
     producción Vue no lo desenvuelve ($el queda siendo el ancla del
     fragmento, sin vista nativa) y la app se queda en negro. */

  import { computed, onMounted } from 'nativescript-vue';
  import { store } from './core/store.js';
  import { bootNative } from './fox';
  import { view, profileUserId, goView, backToChats } from './nav';
  import LoginView from './views/LoginView.vue';
  import RegisterView from './views/RegisterView.vue';
  import VerifyView from './views/VerifyView.vue';
  import ChatListView from './views/ChatListView.vue';
  import ChatView from './views/ChatView.vue';
  import MediaViewer from './views/MediaViewer.vue';
  import ForwardView from './views/ForwardView.vue';
  import MyProfileView from './views/MyProfileView.vue';
  import MyProfileEditView from './views/MyProfileEditView.vue';
  import UsernameView from './views/UsernameView.vue';
  import PeopleView from './views/PeopleView.vue';
  import NewGroupView from './views/NewGroupView.vue';
  import ProfileView from './views/ProfileView.vue';
  import SettingsView from './views/SettingsView.vue';
  import NativeToasts from './components/NativeToasts.vue';
  import FoxTabBar from './components/FoxTabBar.vue';

  /* La ruta vive en el store compartido: el núcleo decide, la vista
     nativa obedece. */
  const route = computed(() => store.route || 'login');
  const activeChatId = computed(() => store.activeChatId || 0);

  /* Tamaño de letra (preferencia del núcleo): la clase .fs-* va en el
     layout raíz y font-size es heredado en NS, así que llega a todos
     los textos. (Poner :fontSize en un layout no sirve: fontSize sólo
     está proxyado en TextBase.) */

  /* W103: la barra de abajo se ve en la lista de chats y en el panel de
     personas (como la .mobile-tabs de la web en el móvil), pero no con
     un chat abierto ni en las pantallas de ajustes o perfil. */
  const showTabs = computed(() =>
    route.value === 'app' && !activeChatId.value
    && (view.value === 'chats' || view.value === 'people'));

  const currentTab = computed(() => {
    if (view.value === 'people') return 'people';
    return store.showArchived ? 'archived' : 'chats';
  });

  function onTab(tab: string) {
    if (tab === 'chats') {
      store.showArchived = false;
      if (view.value !== 'chats') backToChats();
      return;
    }
    if (tab === 'archived') {
      store.showArchived = true;
      if (view.value !== 'chats') backToChats();
      return;
    }
    if (tab === 'people') { goView('people'); return; }
    if (tab === 'settings') { goView('settings'); }
  }

  onMounted(() => {
    bootNative();
  });
</script>
