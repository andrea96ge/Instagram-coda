#!/bin/zsh
# Copia l'ascolto dei tocchi fuori dalla Scrivania (launchd non può leggerla) e lo riavvia.
# Va rilanciato quando cambiano mac/tocchi.js, src/gestione.js o src/rapido.js.
set -eu
QUI="${0:A:h}"
DEST="$HOME/Library/Application Support/WebOperaDesign"
mkdir -p "$DEST"
cp "$QUI/tocchi.js" "$QUI/../src/gestione.js" "$QUI/../src/rapido.js" "$DEST/"
launchctl kickstart -k "gui/$(id -u)/it.weboperadesign.tocchi"
echo "Ascolto dei tocchi aggiornato e riavviato."
