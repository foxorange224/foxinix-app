/* W80: portada pública del sitio (landing). Artística y ligera:
   solo HTML + CSS (sin librerías), detección de SO en el cliente y
   botón de descarga del APK listo según la plataforma. */
export const LandingView = {
  name: 'LandingView',
  setup() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const hasNative = !!(typeof window !== 'undefined' && window.FoxinixAndroid);

    const platform = Vue.ref('detectando');
    const downloadUrl = Vue.ref('');
    const buttonLabel = Vue.ref('Descargar Foxinix');
    const alreadyInstalled = Vue.ref(false);

    const iconFor = function (p) {
      if (p === 'android') return 'phone';
      if (p === 'ios') return 'phone';
      if (p === 'desktop') return 'screen';
      return 'globe';
    };
    const labelFor = function (p) {
      if (p === 'android') return alreadyInstalled.value ? 'App instalada' : 'Android detectado';
      if (p === 'ios') return 'iOS detectado';
      if (p === 'desktop') return 'Escritorio detectado';
      return 'Navegador web';
    };
    const detailFor = function (p) {
      if (p === 'android') return alreadyInstalled.value
        ? 'Ya tienes Foxinix instalado en este dispositivo.'
        : 'Descarga el APK para instalar la app nativa.';
      if (p === 'ios') return 'La app para iOS está en desarrollo. Revisa el repositorio.';
      if (p === 'desktop') return 'Usa Foxinix desde el navegador o visita el código fuente.';
      return 'Accede al chat directamente desde aquí.';
    };

    const detect = function () {
      const u = ua.toLowerCase();
      let p = 'web';
      let label = 'Entrar al chat';
      let url = '/login';
      let installed = false;

      if (/android/.test(u)) {
        p = 'android';
        installed = hasNative;
        if (installed) {
          label = 'Ya tienes la app';
          url = '';
        } else {
          label = 'Descargar para Android';
          url = 'https://github.com/foxorangestudios/foxinix-app/releases/download/v0.2.0/Foxinix-0.2.0-android-arm64.apk';
        }
      } else if (/iphone|ipad|ipod/.test(u)) {
        p = 'ios';
        label = 'iOS (próximamente)';
        url = 'https://github.com/foxorangestudios/foxinix-app';
      } else if (/windows|macintosh|linux/.test(u)) {
        p = 'desktop';
        label = 'Ver en GitHub';
        url = 'https://github.com/foxorangestudios/foxinix-app';
      }

      platform.value = p;
      buttonLabel.value = label;
      downloadUrl.value = url;
      alreadyInstalled.value = installed;
    };

    /* Intenta leer la URL real del APK desde /api/version. Si falla, se
       queda la URL por defecto de GitHub releases. */
    const refreshUrl = async function () {
      try {
        const r = await fetch('/api/version');
        const v = await r.json();
        if (v && v.apk_url && platform.value === 'android' && !alreadyInstalled.value) {
          downloadUrl.value = v.apk_url;
        }
      } catch (e) {
        /* silencioso: ya hay una URL de respaldo */
      }
    };

    Vue.onMounted(function () {
      detect();
      refreshUrl();
    });

    const goDownload = function () {
      const u = downloadUrl.value;
      if (!u) return;
      if (u.startsWith('/')) { location.href = u; return; }
      /* Enlaces externos a GitHub: abrir en pestaña nueva. */
      if (u.indexOf('github.com') >= 0) {
        const w = window.open(u, '_blank');
        if (!w) location.href = u;
        return;
      }
      /* APK: descarga directa. */
      location.href = u;
    };

    return {
      platform, downloadUrl, buttonLabel, alreadyInstalled,
      detect, goDownload, iconFor, labelFor, detailFor,
      t: (k) => k,
    };
  },
  template: `
    <div class="landing-wrap">
      <div class="landing-bg">
        <div class="landing-orb landing-orb-1"></div>
        <div class="landing-orb landing-orb-2"></div>
      </div>

      <main class="landing">
        <header class="landing-head">
          <svg class="ic ic-lg landing-logo"><use href="#i-logo-word"></use></svg>
          <h1>Foxinix</h1>
          <p class="landing-sub">Mensajería privada para tu grupo. Sin rastreo, sin complicaciones.</p>
        </header>

        <div class="landing-device">
          <div class="landing-device-icon">
            <svg class="ic ic-lg"><use :href="'#i-' + iconFor(platform)"></use></svg>
          </div>
          <div class="landing-device-info">
            <strong>{{ labelFor(platform) }}</strong>
            <span>{{ detailFor(platform) }}</span>
          </div>
          <button class="landing-cta" type="button" @click="goDownload">{{ buttonLabel }}</button>
        </div>

        <footer class="landing-foot">
          <p class="landing-note">Código abierto en GitHub</p>
          <a class="landing-github" href="https://github.com/foxorangestudios/foxinix-app" target="_blank" rel="noopener">
            <svg class="ic ic-md landing-github-ic"><use href="#i-github"></use></svg>
            <span>foxorangestudios/foxinix-app</span>
          </a>
          <p class="landing-hr">O entrar directamente al chat web</p>
          <button class="landing-enter" type="button" @click="goDownload">{{ t('Entrar al chat') }}</button>
        </footer>
      </main>
    </div>
  `,
};
