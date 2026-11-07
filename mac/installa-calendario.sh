#!/bin/zsh
# Compila l'app che aggiorna il calendario iCloud. Va rilanciato solo se cambia calendario-icloud.swift.
set -e
QUI="${0:A:h}"
APP="$HOME/Library/Application Support/WebOperaDesign/Calendario WOD.app"
mkdir -p "$APP/Contents/MacOS"
swiftc -swift-version 5 -O "$QUI/calendario-icloud.swift" -o "$APP/Contents/MacOS/calendario" -framework AppKit -framework EventKit
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>it.weboperadesign.calendario</string>
<key>CFBundleName</key><string>Calendario WOD</string>
<key>CFBundleExecutable</key><string>calendario</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSUIElement</key><true/>
<key>NSCalendarsFullAccessUsageDescription</key><string>Serve per inserire le uscite di Instagram nel calendario Web Opera Design.</string>
<key>NSCalendarsUsageDescription</key><string>Serve per inserire le uscite di Instagram nel calendario Web Opera Design.</string>
</dict></plist>
PLIST
codesign --force -s - "$APP"
echo "Installata: $APP"
