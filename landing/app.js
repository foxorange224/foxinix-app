/* Foxinix Chat — interacciones mínimas de la portada.
   Sin dependencias; pensado para funcionar también en navegadores antiguos. */
(function () {
    'use strict';

    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('nav-principal');

    function closeNav() {
        if (!toggle || !nav) {
            return;
        }
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        var links = nav.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            links[i].addEventListener('click', closeNav);
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' || event.keyCode === 27) {
                closeNav();
            }
        });

        document.addEventListener('click', function (event) {
            if (!nav.classList.contains('is-open')) {
                return;
            }
            if (nav.contains(event.target) || toggle.contains(event.target)) {
                return;
            }
            closeNav();
        });
    }

    var year = document.querySelector('[data-year]');
    if (year) {
        year.textContent = String(new Date().getFullYear());
    }

    /* ----------------------------------------------------------------
       Detección de plataforma y botón de descarga dinámico.
       Lee user-agent y reescribe el CTA principal del hero para que
       baje el APK correcto (Android), abra GitHub (iOS/desktop) o
       entre al chat (web). Sin librerías externas.
       ---------------------------------------------------------------- */
    (function platformButton() {
        var ua = (navigator && navigator.userAgent) || '';
        var u = ua.toLowerCase();

        var btn = document.querySelector('.platform-btn');
        var badge = document.querySelector('.platform-badge');
        var badgeText = document.querySelector('.platform-badge-text');

        if (!btn) {
            return;
        }

        var isAndroid = /android/.test(u);
        var isIOS = /iphone|ipad|ipod/.test(u);
        var isDesktop = /windows|macintosh|linux/.test(u) && !isAndroid;

        var platform = 'web';
        var label = 'Entrar a Foxinix Chat';
        var url = 'https://chat.foxinix.qzz.io/';
        var blank = false;

        if (isAndroid) {
            platform = 'android';
            label = 'Descargar para Android';
            url = 'https://github.com/foxorangestudios/foxinix-app/releases/download/v0.2.0/Foxinix-0.2.0-android-arm64.apk';
        } else if (isIOS) {
            platform = 'ios';
            label = 'iOS (próximamente)';
            url = 'https://github.com/foxorangestudios/foxinix-app';
            blank = true;
        } else if (isDesktop) {
            platform = 'desktop';
            label = 'Ver en GitHub';
            url = 'https://github.com/foxorangestudios/foxinix-app';
            blank = true;
        }

        btn.textContent = label;
        btn.href = url;
        if (blank) {
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
        }

        if (badge && badgeText) {
            badge.classList.add('platform-' + platform);
            badgeText.textContent =
                platform === 'android' ? 'Android detectado' :
                platform === 'ios' ? 'iOS detectado' :
                platform === 'desktop' ? 'Escritorio detectado' :
                'Navegador web';
        }

        window.FoxinixPlatform = platform;
    })();
})();
