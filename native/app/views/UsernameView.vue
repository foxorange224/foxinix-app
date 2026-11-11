<template>
  <!-- W107: cambio de @usuario — el modal .uname-modal de la web
       (UsernameModal, W60): aviso de 12 h, usuario nuevo y contraseña
       actual. Es una pantalla aparte, como en la web. -->
  <Page :class="'fox-' + theme" actionBarHidden="true">
    <GridLayout rows="auto,*,auto" class="mp-page">
      <!-- ---------- cabecera ---------- -->
      <GridLayout row="0" class="side-head" columns="auto,*">
        <FoxIconBtn col="0" icon="back" bare :tint="accent"
                    accessibilityLabel="back" @tap="close" />
        <Label col="1" class="sh-title" :text="t('Cambiar nombre de usuario')"
               textWrap="false" />
      </GridLayout>

      <!-- ---------- cuerpo ---------- -->
      <ScrollView row="1">
        <StackLayout class="mp-body">
          <Label class="uname-intro"
                 :text="t('Tu @usuario sirve para iniciar sesión y para que te mencionen. Se puede cambiar una vez cada 12 horas.')"
                 textWrap="true" />

          <GridLayout class="uname-current uname-current-lg" columns="auto,*">
            <Label col="0" class="uname-at" text="@" textWrap="false"
                   verticalAlignment="center" />
            <Label col="1" class="uname-now" :text="username" textWrap="false"
                   verticalAlignment="center" />
          </GridLayout>

          <Label v-if="locked" class="uname-wait" :text="lockText" textWrap="true" />

          <StackLayout v-if="!locked">
            <GridLayout class="uname-warn" columns="auto,*">
              <Image col="0" src="res://ic_fox_alert" width="16" height="16"
                     :tintColor="accent" verticalAlignment="center" />
              <Label col="1" class="uname-warn-t"
                     :text="t('Solo puedes cambiarlo una vez cada 12 horas. Las menciones con @ a tu usuario anterior dejarán de funcionar.')"
                     textWrap="true" verticalAlignment="center" />
            </GridLayout>

            <StackLayout class="field">
              <Label class="field-label" :text="t('Nuevo usuario')" textWrap="false" />
              <TextField class="input" :text="name"
                         :hint="t('3-20 caracteres, empieza con letra o número')"
                         :placeholderColor="muted" :maxLength="20"
                         autocorrect="false" autocapitalizationType="none"
                         :editable="!busy" @textChange="name = $event.value"
                         @submit="submit" />
              <Label class="hint"
                     :text="t('Minúsculas, números, punto y guion bajo; empieza con letra o número.')"
                     textWrap="true" />
            </StackLayout>

            <StackLayout class="field">
              <Label class="field-label" :text="t('Contraseña actual')" textWrap="false" />
              <TextField class="input" secure="true" :text="pw"
                         :hint="t('Para confirmar el cambio')"
                         :placeholderColor="muted" :editable="!busy"
                         returnKeyType="go" @textChange="pw = $event.value"
                         @submit="submit" />
            </StackLayout>

            <Label v-if="err" class="form-err" :text="err" textWrap="true" />
          </StackLayout>
        </StackLayout>
      </ScrollView>

      <!-- ---------- pie ---------- -->
      <GridLayout row="2" class="m-foot" columns="*,*">
        <Button col="0" class="btn btn-ghost" :text="t('Cancelar')"
                :enabled="!busy" @tap="close" />
        <Button v-if="!locked" col="1" class="btn" :class="{ busy: busy }"
                :text="busy ? t('Cambiando…') : t('Cambiar usuario')"
                :enabled="busy || !canSave" @tap="submit" />
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'nativescript-vue';
  import { store, toast } from '../core/store.js';
  import { api, saveSession, session } from '../core/api.js';
  import { t } from '../core/i18n.js';
  import { back } from '../nav';
  import { tok } from '../fmt';
  import FoxIconBtn from '../components/FoxIconBtn.vue';

  const UNAME_WAIT = 12 * 60 * 60;

  const theme = computed(() => store.theme);
  const accent = computed(() => tok(store.theme, 'accent'));
  const muted = computed(() => tok(store.theme, 't2'));

  const name = ref(((store as any).user && (store as any).user.username) || '');
  const pw = ref('');
  const err = ref('');
  const busy = ref(false);
  const clock = ref(Date.now());
  let timer: any = null;

  const username = computed(
    () => ((store as any).user && (store as any).user.username) || '',
  );

  const changedAt = computed(
    () => Number((store as any).user
      && (store as any).user.username_changed_at) || 0,
  );

  const locked = computed(
    () => clock.value < changedAt.value * 1000 + UNAME_WAIT * 1000,
  );

  const lockText = computed(() => {
    const secs = Math.max(0,
      changedAt.value + UNAME_WAIT - Math.floor(clock.value / 1000));
    const h = Math.floor(secs / 3600);
    let m = Math.ceil((secs % 3600) / 60);
    let hh = h;
    if (m >= 60) { hh += 1; m = 0; }
    return t('Podrás cambiarlo en {h} h {m} min.', { h: hh, m });
  });

  const canSave = computed(
    () => !locked.value && !!name.value.trim() && !!pw.value,
  );

  function close() {
    if (busy.value) return;
    back();
  }

  async function submit() {
    if (locked.value || busy.value) return;
    err.value = '';
    const val = String(name.value || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.]{2,19}$/.test(val)) {
      err.value = t('Usuario: 3-20 caracteres, letras/números/punto/guion bajo, empieza alfanumérico');
      return;
    }
    const me: any = (store as any).user;
    if (me && val === me.username) {
      err.value = t('Ese ya es tu usuario actual');
      return;
    }
    if (!pw.value) {
      err.value = t('Escribe tu contraseña actual');
      return;
    }
    busy.value = true;
    try {
      const r: any = await api('PUT', '/auth/username',
        { username: val, password: pw.value }, { retry401: true });
      if (r && r.user) {
        (store as any).user = Object.assign({}, (store as any).user, r.user);
        (session as any).user = (store as any).user;
        saveSession();
      }
      pw.value = '';
      toast(t('Usuario actualizado') + ': @' + val, 'ok');
      back();
    } catch (e: any) {
      err.value = (e && t(e.detail)) || t('No se pudo cambiar el usuario');
    } finally {
      busy.value = false;
    }
  }

  onMounted(() => {
    timer = setInterval(() => { clock.value = Date.now(); }, 30000);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
    timer = null;
  });
</script>
