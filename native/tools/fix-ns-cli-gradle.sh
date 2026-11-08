#!/usr/bin/env bash
# fix-ns-cli-gradle.sh — alinea el CLI de NativeScript con el Gradle de la app.
#
# POR QUÉ:
#   El CLI (>= 8.6) compila cada plugin con código nativo en un proyecto
#   Gradle propio y usa para eso sus defaults:
#       GradleVersion            = 7.4.0
#       GradleAndroidPluginVersion = 7.1.2
#   Esos defaults se quedaron atrás porque el runtime Android era el paquete
#   separado "@nativescript/android"; en NS 9 el runtime se integró en
#   "@nativescript/core", así que la búsqueda de la versión de Gradle falla y
#   cae siempre en los defaults.
#
#   En este equipo eso rompe dos cosas:
#     1. Gradle 7.4.0 no se puede descargar (el release v7.4.0 de Gradle
#        tiene los assets con otro nombre → 404) y
#     2. AGP 7.1.2 no compila con el Java 21 instalado.
#
#   La app (platforms/android) usa Gradle 8.14.3 + AGP 8.12.1, que ya están
#   descargados. Este script cambia los defaults del CLI a esos mismos
#   valores, para que los plugins (notificaciones push, audio, selector de
#   archivos…) compilen con la misma cadena de herramientas que la app.
#
# USO:  sudo bash tools/fix-ns-cli-gradle.sh [ruta-del-cli]
#       (por defecto busca el CLI con `npm root -g`; es idempotente:
#        si ya está aplicado, no toca nada)

set -euo pipefail

GRADLE_VERSION="8.14.3"
AGP_VERSION="8.12.1"

CLI_DIR="${1:-}"
if [ -z "$CLI_DIR" ]; then
  NPM_ROOT="$(npm root -g 2>/dev/null || true)"
  if [ -n "$NPM_ROOT" ] && [ -d "$NPM_ROOT/nativescript" ]; then
    CLI_DIR="$NPM_ROOT/nativescript"
  else
    CLI_DIR="/usr/lib/node_modules/nativescript"
  fi
fi
CLI_CONSTANTS="$CLI_DIR/lib/constants.js"

if [ ! -f "$CLI_CONSTANTS" ]; then
  echo "No se encontró el CLI en $CLI_CONSTANTS"
  echo "Ajustá la ruta así:  sudo bash tools/fix-ns-cli-gradle.sh <ruta-del-cli>"
  echo "La ruta se obtiene con:  npm root -g   (+ /nativescript)"
  exit 1
fi

if grep -q "GradleVersion = \"$GRADLE_VERSION\"" "$CLI_CONSTANTS" &&
   grep -q "GradleAndroidPluginVersion = \"$AGP_VERSION\"" "$CLI_CONSTANTS"; then
  echo "El CLI ya usa Gradle $GRADLE_VERSION + AGP $AGP_VERSION. Nada que hacer."
  exit 0
fi

if [ ! -f "$CLI_CONSTANTS.orig" ]; then
  cp "$CLI_CONSTANTS" "$CLI_CONSTANTS.orig"
  echo "Copia de seguridad: $CLI_CONSTANTS.orig"
fi

sed -i "s/AndroidBuildDefaults.GradleVersion = \"[^\"]*\";/AndroidBuildDefaults.GradleVersion = \"$GRADLE_VERSION\";/" "$CLI_CONSTANTS"
sed -i "s/AndroidBuildDefaults.GradleAndroidPluginVersion = \"[^\"]*\";/AndroidBuildDefaults.GradleAndroidPluginVersion = \"$AGP_VERSION\";/" "$CLI_CONSTANTS"

echo "CLI actualizado: Gradle $GRADLE_VERSION + AGP $AGP_VERSION"
grep -n "AndroidBuildDefaults.Gradle" "$CLI_CONSTANTS"
