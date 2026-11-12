<template>
  <!-- W108: panel "Info del chat" — ChatInfoPanel de la web, como
       overlay a pantalla completa dentro de ChatView (la web lo pinta
       como aside derecho; en móvil la web lo muestra encima, igual).

       Estructura: cabecera (pp-head) + cuerpo con scroll (pp-acts va
       fijo abajo, row2) + los modales de fijados/archivos y la hoja de
       menús como ÚLTIMOS hijos con rowSpan (regla NS9: sin
       position:fixed ni z-index). -->
  <GridLayout rows="auto,*,auto" columns="*" class="pp-panel"
              :accessibilityLabel="panelTitle">
    <!-- ---------- cabecera ---------- -->
    <GridLayout row="0" class="pp-head" columns="*,auto,auto">
      <Label col="0" class="pp-title" :text="panelTitle" textWrap="false"
             verticalAlignment="center" />
      <!-- ⋮ de administrar: el de la web rota el sprite 90° (se ve
           horizontal, ⋯) — el CSS le da la vuelta igual. -->
      <FoxIconBtn col="1" class="pp-more" icon="dots" :tint="muted"
                  accessibilityLabel="Administrar" @tap="infoMenu" />
      <FoxIconBtn col="2" icon="x" :tint="muted" accessibilityLabel="close info"
                  @tap="close" />
    </GridLayout>

    <!-- ---------- cuerpo ---------- -->
    <ScrollView row="1">
      <StackLayout>
        <!-- ===== directo: portada + ficha ===== -->
        <StackLayout v-if="chat.type === 'dm' && peer">
          <FoxBanner class="pf-banner" :src="peerBanner" :height="84"
                     :position="bannerPositionOf(peer)" @tap="viewBanner" />
          <StackLayout class="pf-body">
            <!-- avatar que monta sobre la portada (−36, como
                 .profile-panel .pf-avwrap) + estado citado al lado -->
            <GridLayout class="ci-idrow" columns="auto,*">
              <FoxAvatar col="0" :src="peerAvatar" :initial="peerInitial"
                         :size="72" :dot="dotState(peer)" :ring="panel"
                         marginLeft="2" accessibilityLabel="ver foto"
                         @tap="viewAvatar" />
              <StackLayout v-if="quote" col="1" class="ci-quote">
                <Label class="ci-quote-t" :text="quote" textWrap="true" />
              </StackLayout>
            </GridLayout>

            <StackLayout class="ci-idbelow">
              <Label class="pp-name" :text="peerName" textWrap="true" />
              <Label class="pp-user" :text="'@' + peer.username"
                     textWrap="false" />
            </StackLayout>

            <!-- bio en texto plano (BioText con "Ver más" queda
                 pendiente, ver README) -->
            <Label v-if="peer.bio" class="pp-bio" :text="peer.bio"
                   textWrap="true" />

            <StackLayout class="pp-rows">
              <GridLayout v-if="peer.created_at" class="pp-row"
                          columns="auto,*">
                <Label col="0" class="pp-row-k" :text="t('Miembro desde')"
                       textWrap="false" verticalAlignment="center" />
                <Label col="1" class="pp-row-v" :text="joinedLine(peer)"
                       textWrap="false" verticalAlignment="center"
                       horizontalAlignment="right" />
              </GridLayout>
            </StackLayout>
          </StackLayout>
        </StackLayout>

        <!-- ===== grupo: foto, cabecera, miembros, invitación ===== -->
        <StackLayout v-else-if="chat.type === 'group'" class="pp-body pp-left">
          <Label v-if="infoError" class="pp-loading" :text="t(infoError)"
                 textWrap="true" />
          <Label v-else-if="loading" class="pp-loading" :text="t('Cargando…')"
                 textWrap="true" />

          <StackLayout v-else-if="members.length">
            <!-- foto del grupo: subirla sólo owner/admin (W27b: el
                 editor de encuadre de la web queda pendiente, se sube
                 directo) -->
            <GridLayout class="grp-av" rows="72,4" columns="6,72,6"
                        horizontalAlignment="center">
              <FoxAvatar row="0" col="1" :src="grpAvatar" :initial="grpInitial"
                         :size="72" accessibilityLabel="ver foto"
                         @tap="viewGrpAvatar" />
              <StackLayout v-if="canPhoto" row="1" col="2" class="grp-av-btn"
                           horizontalAlignment="right"
                           verticalAlignment="bottom"
                           accessibilityLabel="Cambiar foto del grupo"
                           @tap="pickPhoto">
                <Image src="res://ic_fox_image" width="18" height="18"
                       stretch="aspectFit" :tintColor="onAccent"
                       horizontalAlignment="center"
                       verticalAlignment="center" />
              </StackLayout>
            </GridLayout>

            <!-- cabecera: nombre + miembros + en línea (sin tap: el
                 modal de perfil de grupo es W114) -->
            <GridLayout class="mi-head" columns="*,auto,auto">
              <Label col="0" class="mi-head-t" :text="chatTitle(chat)"
                     textWrap="false" verticalAlignment="center" />
              <Label col="1" class="mi-head-s" :text="membersLine"
                     textWrap="false" verticalAlignment="center" />
              <Label v-if="onlineCount" col="2" class="mi-head-on"
                     :text="onlineLine" textWrap="false"
                     verticalAlignment="center" />
            </GridLayout>

            <!-- en línea primero, desconectados después (etiqueta sólo
                 si conviven los dos bloques) -->
            <template v-for="sec in memberSections" :key="sec.key">
              <Label v-if="sec.show" class="mi-sec" :text="t(sec.label)"
                     textWrap="false" />
              <GridLayout v-for="m in sec.ms" :key="sec.key + '-' + m.id"
                          class="mi-row" columns="auto,*,auto,auto"
                          @tap="rowTap(m)">
                <FoxAvatar col="0" :src="avatarOf(m)" :initial="initialOf(m)"
                           :size="36" :dot="dotState(m)" :ring="panel" />
                <StackLayout col="1" class="mi-col">
                  <!-- nombre + "Tú" + [Admin] pegados como en la web -->
                  <StackLayout orientation="horizontal" class="mi-name-line">
                    <Label class="mi-name"
                           :text="m.display_name || m.username"
                           textWrap="false" />
                    <Label v-if="isMe(m)" class="mi-me" :text="t('Tú')"
                           textWrap="false" verticalAlignment="center" />
                    <Label v-if="isAdmin(m)" class="mi-role" text="[Admin]"
                           textWrap="false" verticalAlignment="center" />
                  </StackLayout>
                  <Label class="mi-sub" :text="memberLine(m)" textWrap="false" />
                </StackLayout>
                <StackLayout v-if="memberTyping(m)" col="2" class="ci-typing"
                             orientation="horizontal"
                             verticalAlignment="center">
                  <StackLayout class="ci-dot" />
                  <StackLayout class="ci-dot" />
                  <StackLayout class="ci-dot" />
                </StackLayout>
                <FoxIconBtn v-if="canManageMember(m)" col="3" class="mi-more"
                            icon="dots" :size="28" :ic="16" :tint="muted"
                            accessibilityLabel="member menu"
                            @tap="memberMenu(m)" />
              </GridLayout>
            </template>

            <!-- enlace de invitación (sólo owner/admin) -->
            <Label v-if="canInvite" class="mi-sec gi-sec"
                   :text="t('Enlace de invitación')" textWrap="false" />
            <StackLayout v-if="canInvite" class="gi-body">
              <GridLayout class="gi-tgl-row" columns="*,auto">
                <StackLayout col="0" class="st-col">
                  <Label class="st-t" :text="t('Permitir añadir por enlace')"
                         textWrap="true" />
                  <Label class="st-s"
                         :text="t('Cualquiera con el enlace puede unirse')"
                         textWrap="true" />
                </StackLayout>
                <Switch col="1" :checked="invitesOn"
                        @checkedChange="toggleInvites" />
              </GridLayout>
              <GridLayout v-if="invitesOn && inviteLink" class="gi-link"
                          columns="*,auto">
                <Label col="0" class="gi-link-i" :text="inviteLink"
                       textWrap="false"
                       accessibilityLabel="Enlace de invitación" />
                <FoxIconBtn col="1" icon="copy" :tint="muted"
                            accessibilityLabel="Copiar enlace"
                            @tap="copyInvite" />
              </GridLayout>
            </StackLayout>
          </StackLayout>

          <Label v-else class="pp-loading" :text="t('Sin miembros')"
                 textWrap="true" />
        </StackLayout>
      </StackLayout>
    </ScrollView>

    <!-- ---------- accesos a fijados y archivos (abren modales) ---------- -->
    <StackLayout row="2" class="pp-acts">
      <GridLayout class="pp-pinhead" columns="auto,*,auto,auto"
                  accessibilityLabel="pins access" @tap="openPins">
        <Image col="0" class="pp-pinhead-ic" src="res://ic_fox_pin"
               width="18" height="18" stretch="aspectFit"
               :tintColor="t1c" />
        <Label col="1" class="pp-pinhead-t" :text="t('Mensajes fijados')"
               textWrap="false" verticalAlignment="center" />
        <Label v-if="pins.length" col="2" class="pp-ncount"
               :text="'(' + pins.length + ')'" textWrap="false"
               verticalAlignment="center" />
        <Image col="3" class="pp-chev" src="res://ic_fox_chevron_down"
               width="18" height="18" stretch="aspectFit"
               :tintColor="muted" />
      </GridLayout>
      <GridLayout class="pp-pinhead" :marginTop="6" columns="auto,*,auto,auto"
                  accessibilityLabel="gallery access" @tap="openGal">
        <Image col="0" class="pp-pinhead-ic" src="res://ic_fox_file"
               width="18" height="18" stretch="aspectFit"
               :tintColor="t1c" />
        <Label col="1" class="pp-pinhead-t" :text="t('Archivos y medios')"
               textWrap="false" verticalAlignment="center" />
        <Label v-if="galCount" col="2" class="pp-ncount"
               :text="'(' + galCount + ')'" textWrap="false"
               verticalAlignment="center" />
        <Image col="3" class="pp-chev" src="res://ic_fox_chevron_down"
               width="18" height="18" stretch="aspectFit"
               :tintColor="muted" />
      </GridLayout>
    </StackLayout>

    <!-- ---------- modales (últimos hijos, con rowSpan) ---------- -->
    <PinsView v-if="store.pinsModal" row="0" rowSpan="3" col="0"
              :pins="pins" :loading="pinsLoading" @close="closePins"
              @jump="goPin" />
    <GalleryView v-if="store.galModal" row="0" rowSpan="3" col="0"
                 :gal="gal" :loading="galLoading" @close="closeGal"
                 @jump="goGal" />

    <!-- ---------- hoja de menús (la última de todas) ---------- -->
    <ActSheet v-if="menu" row="0" rowSpan="3" col="0" :items="menu"
              @close="menu = null" />
  </GridLayout>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'nativescript-vue';
  import { Dialogs } from '@nativescript/core';
  import { store, toast } from '../core/store.js';
  import {
    api, humanError, uploadChatAvatar, WEB_BASE,
  } from '../core/api.js';
  import { t } from '../core/i18n.js';
  import {
    archiveChat, chatTitle, leaveGroup, loadMembers, mediaUrl, removeMember,
    setMemberRole, setMuted, setPinned, transferOwner,
  } from '../core/actions.js';
  import {
    bannerPositionOf, dotState, fmtLastSeen, joinedLine, presetLabel, tok,
  } from '../fmt';
  import { goProfile, openMedia } from '../nav';
  import { copyToClipboard } from '../clipboard';
  import { pickImage } from '../files';
  import ActSheet from '../components/ActSheet.vue';
  import FoxAvatar from '../components/FoxAvatar.vue';
  import FoxBanner from '../components/FoxBanner.vue';
  import FoxIconBtn from '../components/FoxIconBtn.vue';
  import GalleryView from './GalleryView.vue';
  import PinsView from './PinsView.vue';

  const theme = computed(() => store.theme);
  const muted = computed(() => tok(store.theme, 't2'));
  const t1c = computed(() => tok(store.theme, 't1'));
  const panel = computed(() => tok(store.theme, 'panel'));
  const onAccent = computed(() => tok(store.theme, 'onAccent'));

  const chat = computed<any>(() => {
    const id = store.activeChatId;
    return (store.chats || []).find((c: any) => c.id === id) || null;
  });

  const panelTitle = computed(() =>
    t(chat.value && chat.value.type === 'dm'
      ? 'Info del usuario' : 'Info del grupo'));

  function close() {
    store.infoOpen = false;
  }

  /* ================= datos del directo ================= */

  /* El contacto (el OTRO miembro, no yo) con presencia fresca; si
     todavía no cargó, el title de la lista. */
  const peer = computed<any>(() => {
    const c = chat.value;
    if (!c || c.type !== 'dm') return null;
    const info: any = store.info;
    if (info && info.chatId === c.id && info.members && info.members.length) {
      const meId = store.user ? (store.user as any).id : 0;
      for (let i = 0; i < info.members.length; i++) {
        if (info.members[i].id !== meId) return info.members[i];
      }
    }
    return c.title || null;
  });

  const peerName = computed(() => {
    const p = peer.value;
    return (p && (p.display_name || p.username)) || '';
  });

  const peerInitial = computed(() => {
    const n = peerName.value.trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  });

  function safeMedia(url: any): string {
    if (!url) return '';
    try { return mediaUrl(url); } catch (e) { return ''; }
  }

  const peerAvatar = computed(() => safeMedia(peer.value && peer.value.avatar_url));
  const peerBanner = computed(() => safeMedia(peer.value && peer.value.banner_url));

  /* profileQuote() de la web: mensaje propio o un preset que no sea
     "en línea" (el "En línea" por defecto no se repite). */
  const quote = computed(() => {
    const u = peer.value;
    if (!u) return '';
    if (u.status_text) return u.status_text;
    if (u.status_preset && u.status_preset !== 'online') {
      return presetLabel(u.status_preset);
    }
    return '';
  });

  /* El visor recibe el "name" tal cual: 'portada'/'foto', como
     openMediaViewer(url, name) de la web. */
  function viewBanner() {
    if (peerBanner.value) openMedia(peerBanner.value, 'portada');
  }
  function viewAvatar() {
    if (peerAvatar.value) openMedia(peerAvatar.value, 'foto');
  }

  /* ================= datos del grupo ================= */

  const infoError = computed(() => {
    const info: any = store.info;
    const c = chat.value;
    if (!info || !c || info.chatId !== c.id) return '';
    return info.error || '';
  });

  const loading = computed(() => {
    const info: any = store.info;
    const c = chat.value;
    return !!(info && c && info.chatId === c.id
      && info.loading && !info.members.length);
  });

  /* Presencia: store.presence (WS) manda; el online del REST es sólo
     el primer relleno. */
  function memberOn(m: any): boolean {
    const presence: any = store.presence || {};
    return !!(m && (presence[m.id] != null ? presence[m.id] : m.online));
  }

  /* En línea primero y desconectados al final (orden estable, W27). */
  const members = computed<any[]>(() => {
    const info: any = store.info;
    const c = chat.value;
    if (!info || !c || info.chatId !== c.id) return [];
    return (info.members || []).slice().sort((a: any, b: any) =>
      (memberOn(b) ? 1 : 0) - (memberOn(a) ? 1 : 0));
  });

  const onlineCount = computed(() => {
    let n = 0;
    const ms = members.value;
    for (let i = 0; i < ms.length; i++) if (memberOn(ms[i])) n++;
    return n;
  });

  const membersLine = computed(() =>
    t('{n} miembro{p}', {
      n: members.value.length,
      p: members.value.length === 1 ? '' : 's',
    }));

  const onlineLine = computed(() => ' · ' + t('{n} en línea', { n: onlineCount.value }));

  /* Lista en dos bloques con etiqueta sólo cuando conviven. */
  const memberSections = computed(() => {
    const on: any[] = [];
    const off: any[] = [];
    const ms = members.value;
    for (let i = 0; i < ms.length; i++) {
      if (memberOn(ms[i])) on.push(ms[i]);
      else off.push(ms[i]);
    }
    const both = on.length > 0 && off.length > 0;
    const out: any[] = [];
    if (on.length) out.push({ key: 'on', label: 'En línea', show: both, ms: on });
    if (off.length) out.push({ key: 'off', label: 'Desconectados', show: both, ms: off });
    return out;
  });

  function isMe(m: any): boolean {
    return !!(m && store.user && m.id === (store.user as any).id);
  }

  /* [Admin] para owner y admin del grupo (W46). */
  function isAdmin(m: any): boolean {
    return !!(m && (m.role === 'owner' || m.role === 'admin'));
  }

  /* Línea secundaria del miembro (joinedLine/statusOf de la web). */
  function memberLine(m: any): string {
    if (!memberOn(m)) return fmtLastSeen(m.last_seen || 0);
    if (m.status_text) return m.status_text;
    if (m.status_preset) return presetLabel(m.status_preset);
    return t('En línea');
  }

  /* El menú sólo aparece cuando la acción tiene sentido: no sobre uno
     mismo, ni sobre el owner; un admin sólo administra comunes. */
  function canManageMember(m: any): boolean {
    const c = chat.value;
    if (!c || c.type !== 'group' || !m || isMe(m) || m.role === 'owner') {
      return false;
    }
    if (c.my_role === 'owner') return true;
    return c.my_role === 'admin' && m.role === 'member';
  }

  /* W29c: pelotita si este miembro está escribiendo en ESTE chat. */
  function memberTyping(m: any): boolean {
    const c = chat.value;
    const bag = c && (store.typing || {})[c.id];
    return !!(bag && bag[m.id]);
  }

  function avatarOf(m: any): string {
    return safeMedia(m && m.avatar_url);
  }
  function initialOf(m: any): string {
    const n = ((m && (m.display_name || m.username)) || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  /* Tocar la fila abre el perfil; el tap del ⋮ burbujea desde NS, así
     que un guard de 400 ms evita que abra el perfil al abrir el menú. */
  let guardAt = 0;
  function rowTap(m: any) {
    if (Date.now() - guardAt < 400) return;
    goProfile(m.id);
  }

  /* ================= foto del grupo ================= */

  const grpAvatar = computed(() =>
    safeMedia(chat.value && chat.value.avatar_url));

  const grpInitial = computed(() => {
    const n = (chatTitle(chat.value) || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  });

  const canPhoto = computed(() => {
    const c = chat.value;
    return !!(c && (c.my_role === 'owner' || c.my_role === 'admin'));
  });

  function viewGrpAvatar() {
    if (grpAvatar.value) openMedia(grpAvatar.value, 'foto');
  }

  /* W27b: el editor de encuadre de la web queda pendiente; por ahora
     se sube la imagen elegida directo (mismos avisos que pickGroupPhoto). */
  async function pickPhoto() {
    const c = chat.value;
    if (!c) return;
    const f = await pickImage();
    if (!f) return;
    if (f.type && f.type.indexOf('image/') !== 0) {
      toast(t('Elige una imagen'), 'err');
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast(t('La imagen supera los 15 MB'), 'err');
      return;
    }
    try {
      await uploadChatAvatar(c.id, f);
      toast(t('Foto del grupo actualizada'), 'ok');
    } catch (err: any) {
      toast(humanError(err || { detail: 'No se pudo subir la foto' }), 'err');
    }
  }

  /* ================= enlace de invitación (W68) ================= */

  const invitesOn = ref(false);

  const canInvite = computed(() => {
    const c = chat.value;
    return !!(c && c.type === 'group'
      && (c.my_role === 'owner' || c.my_role === 'admin'));
  });

  const inviteLink = computed(() => {
    const c = chat.value;
    const id = (c && c.pub_id) || '';
    return id ? WEB_BASE + '/app/group/' + id : '';
  });

  function toggleInvites(ev: any) {
    const c = chat.value;
    if (!c) return;
    const on = !!(ev && ev.value);
    /* Si el evento no cambia nada (revert automático), sólo sincroniza. */
    if (on === !!c.invites_open) {
      invitesOn.value = on;
      return;
    }
    api('PATCH', '/chats/' + c.id, { invites_open: on }).then(() => {
      c.invites_open = on;
      invitesOn.value = on;
      toast(on ? t('Enlace de invitación activado')
               : t('Enlace de invitación desactivado'), 'ok');
    }).catch((err: any) => {
      invitesOn.value = !on;          // revertir el toggle visual
      toast(humanError(err || { detail: 'No se pudo cambiar el ajuste' }), 'err');
    });
  }

  function copyInvite() {
    const txt = inviteLink.value;
    if (!txt) return;
    if (!copyToClipboard(txt)) {
      toast(t('No se pudo copiar el texto'), 'err');
      return;
    }
    toast(t('Enlace copiado'), 'ok');
  }

  /* ================= menús (ActSheet) ================= */

  const menu = ref<any[] | null>(null);

  /* ⋮ de la cabecera: administrar el grupo (o el directo). */
  function infoMenu() {
    const c = chat.value;
    if (!c) return;
    guardAt = Date.now();
    menu.value = c.type === 'group' ? groupItems(c) : dmItems(c);
  }

  /* chatInfoMenu() de la web para el directo. */
  function dmItems(c: any): any[] {
    const items: any[] = [];
    const meId = store.user ? (store.user as any).id : 0;
    const p = peer.value;
    if (p && p.username && p.id !== meId) {
      items.push({
        label: 'Ver perfil', icon: 'user',
        fn: () => goProfile(p.id),
      });
    }
    items.push({
      label: c.pinned ? 'Desfijar chat' : 'Fijar chat',
      icon: c.pinned ? 'x' : 'pin',
      fn: () => setPinned(c.id, !c.pinned),
    });
    items.push({
      label: c.muted ? 'Activar notificaciones' : 'Silenciar notificaciones',
      icon: c.muted ? 'bell' : 'bell_off',
      fn: () => setMuted(c.id, !c.muted),
    });
    return items;
  }

  /* chatMenu() de la web (sin "Renombrar grupo": es W114). */
  function groupItems(c: any): any[] {
    const items: any[] = [{
      label: 'Abrir chat', icon: 'users',
      fn: () => { store.infoOpen = false; },
    }, {
      label: 'Ver info del chat', icon: 'info',
      fn: () => { store.infoOpen = true; loadMembers(c.id); },
    }];
    if (c.my_role === 'owner' || c.my_role === 'admin') {
      items.push({
        label: 'Cambiar foto del grupo', icon: 'image',
        fn: () => pickPhoto(),
      });
    }
    items.push({
      label: 'Salir del grupo', icon: 'back', danger: true,
      fn: () => askLeave(c),
    });
    items.push({
      label: c.pinned ? 'Desfijar chat' : 'Fijar chat',
      icon: c.pinned ? 'x' : 'pin',
      fn: () => setPinned(c.id, !c.pinned),
    });
    items.push({
      label: c.muted ? 'Activar notificaciones' : 'Silenciar notificaciones',
      icon: c.muted ? 'bell' : 'bell_off',
      fn: () => setMuted(c.id, !c.muted),
    });
    items.push({
      label: c.archived ? 'Desarchivar chat' : 'Archivar chat',
      icon: 'archive',
      fn: () => {
        const want = !c.archived;
        archiveChat(c.id, want).then(() => {
          toast(want ? t('Chat archivado') : t('Chat desarchivado'), 'ok');
        }).catch((err: any) => {
          toast(humanError(err || { detail: 'No se pudo archivar el chat' }), 'err');
        });
      },
    });
    return items;
  }

  /* ⋮ de una fila de miembro (memberMenu de la web). */
  function memberMenu(m: any) {
    const c = chat.value;
    if (!c || !canManageMember(m)) return;
    guardAt = Date.now();
    const items: any[] = [];
    if (m.role === 'member') {
      items.push({
        label: 'Hacer admin', icon: 'star',
        fn: () => askSetRole(c, m, 'admin'),
      });
    } else if (m.role === 'admin') {
      items.push({
        label: 'Quitar admin', icon: 'user',
        fn: () => askSetRole(c, m, 'member'),
      });
    }
    if (c.my_role === 'owner') {
      items.push({
        label: 'Transferir propiedad', icon: 'key', danger: true,
        fn: () => askTransferOwner(c, m),
      });
    }
    items.push({
      label: 'Eliminar del grupo', icon: 'trash', danger: true,
      fn: () => askRemoveMember(c, m),
    });
    menu.value = items;
  }

  /* ================= confirmaciones (asks de helpers.js) ================= */

  async function confirmBox(
    title: string, message: string, okText: string,
  ): Promise<boolean> {
    try {
      return await Dialogs.confirm({
        title: title,
        message: message,
        okButtonText: okText,
        cancelButtonText: t('Cancelar'),
      });
    } catch (e) { return false; }
  }

  /* Error de una acción dentro de un ask: el cuadro de la web muestra
     este mismo texto dentro de la caja. */
  function actErr(e: any) {
    toast((e && t(e.detail)) || t('No se pudo completar la acción'), 'err');
  }

  async function askLeave(c: any) {
    const ok = await confirmBox(
      t('Salir del grupo'),
      t('Vas a salir de "{n}".\nEste chat se borra de tu lista y no vas a recibir más mensajes. Puedes volver si alguien te vuelve a agregar.',
        { n: chatTitle(c) }),
      t('Salir del grupo'),
    );
    if (!ok) return;
    try { await leaveGroup(c.id); } catch (e) { actErr(e); }
  }

  async function askSetRole(c: any, m: any, role: string) {
    const name = m.display_name || m.username;
    const promoting = role === 'admin';
    const ok = await confirmBox(
      promoting ? t('Hacer admin') : t('Quitar admin'),
      promoting
        ? t('¿Hacer admin a {n}? Podrá administrar el grupo y todos verán el aviso en el chat.',
            { n: name })
        : t('¿Quitar admin a {n}? Ya no podrá administrar el grupo y todos verán el aviso en el chat.',
            { n: name }),
      promoting ? t('Hacer admin') : t('Quitar admin'),
    );
    if (!ok) return;
    try {
      await setMemberRole(c.id, m.id, role);
      toast(promoting
        ? t('{n} ahora es admin', { n: name })
        : t('{n} ya no es admin', { n: name }), 'ok');
    } catch (e) { actErr(e); }
  }

  async function askTransferOwner(c: any, m: any) {
    const name = m.display_name || m.username;
    const ok = await confirmBox(
      t('Transferir propiedad'),
      t('¿Transferir la propiedad de este grupo a {n}? Tú pasarás a ser admin y {n} podrá administrar el grupo.',
        { n: name }),
      t('Transferir propiedad'),
    );
    if (!ok) return;
    try {
      await transferOwner(c.id, m.username);
      toast(t('La propiedad pasó a {n}', { n: name }), 'ok');
    } catch (e) { actErr(e); }
  }

  async function askRemoveMember(c: any, m: any) {
    const name = m.display_name || m.username;
    const ok = await confirmBox(
      t('Eliminar del grupo'),
      t('¿Eliminar a {n} del grupo? Dejará de ver el chat y todos verán el aviso de la expulsión.',
        { n: name }),
      t('Eliminar del grupo'),
    );
    if (!ok) return;
    try {
      await removeMember(c.id, m.id);
      toast(t('{n} fue eliminado del grupo', { n: name }), 'ok');
    } catch (e) { actErr(e); }
  }

  /* ================= fijados y archivos ================= */

  const pins = ref<any[]>([]);
  const pinsLoading = ref(false);

  async function loadPins() {
    const c = chat.value;
    if (!c) return;
    pinsLoading.value = true;
    try {
      const r: any = await api('GET', '/chats/' + c.id + '/pins');
      if (!chat.value || chat.value.id !== c.id) return;
      pins.value = (r && r.messages) || [];
    } catch (e) {
      pins.value = [];              // sin permiso/chat cerrado: vacío
    } finally {
      pinsLoading.value = false;
    }
  }

  function openPins() {
    store.pinsModal = true;
    loadPins();                     // siempre fresco al abrir el modal
  }
  function closePins() { store.pinsModal = false; }
  function goPin(msg: any) {
    if (!msg) return;
    store.pinsModal = false;        // el modal deja ver el chat
    store.jumpMsg = msg.id;         // ChatView salta al mensaje
  }

  const gal = ref<any>(null);
  const galLoading = ref(false);

  const galCount = computed(() => {
    const g = gal.value;
    if (!g) return 0;
    return (g.images ? g.images.length : 0) + (g.files ? g.files.length : 0);
  });

  async function loadGal() {
    const c = chat.value;
    if (!c) return;
    galLoading.value = true;
    try {
      const r: any = await api('GET', '/chats/' + c.id + '/gallery');
      if (!chat.value || chat.value.id !== c.id) return;
      gal.value = { images: (r && r.images) || [], files: (r && r.files) || [] };
    } catch (e) {
      gal.value = { images: [], files: [] };
    } finally {
      galLoading.value = false;
    }
  }

  function openGal() {
    store.galModal = true;
    loadGal();
  }
  function closeGal() { store.galModal = false; }
  function goGal(item: any) {
    if (!item) return;
    store.galModal = false;
    store.jumpMsg = item.msg_id;
  }

  /* Al abrir la info se piden fijados y galería de una vez (los
     conteos se ven "de una"); al cerrar, los modales se apagan. */
  watch(() => store.infoOpen, (open: any) => {
    if (open) { loadPins(); loadGal(); }
    else { store.pinsModal = false; store.galModal = false; }
  }, { immediate: true });

  /* Un fijado por WS mantiene el conteo al día. */
  watch(() => store.pinsRev, () => {
    if (store.infoOpen) loadPins();
  });

  /* Al cambiar de chat: limpia todo y recarga si la info sigue abierta. */
  watch(() => chat.value && chat.value.id, () => {
    pins.value = [];
    gal.value = null;
    store.pinsModal = false;
    store.galModal = false;
    if (store.infoOpen) { loadPins(); loadGal(); }
  });

  /* El toggle de invitaciones sigue al chat (cambio por WS u otro). */
  watch(() => chat.value && chat.value.invites_open, (v: any) => {
    invitesOn.value = !!v;
  }, { immediate: true });
</script>
