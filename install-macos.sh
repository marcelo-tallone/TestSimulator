#!/bin/bash
# Installs TestSimulator as a native macOS desktop app in /Applications.
# The app shows the dashboard in its own window (WKWebView), starts the Node
# server on launch and stops it on quit. Add it to the Dock like any other app.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="/Applications/TestSimulator.app"

echo "==> Project: $PROJECT_DIR"

# 0. Stop any previous instance / orphan server
pkill -f "TestSimulator.app/Contents/MacOS/TestSimulator" 2>/dev/null || true
pkill -f "$PROJECT_DIR/dist/index.js" 2>/dev/null || true

# 1. Dependencies + build
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "==> Installing dependencies..."
  (cd "$PROJECT_DIR" && npm install)
fi
echo "==> Building server..."
(cd "$PROJECT_DIR" && npm run build)

# 2. Icon (.icns) from a pure-Node PNG generator
echo "==> Generating icon..."
node "$PROJECT_DIR/assets/make-icon.mjs"
ICONSET="$PROJECT_DIR/assets/TestSimulator.iconset"
rm -rf "$ICONSET" && mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z $size $size "$PROJECT_DIR/assets/icon.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  d=$((size*2))
  sips -z $d $d "$PROJECT_DIR/assets/icon.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$PROJECT_DIR/assets/AppIcon.icns"

# 3. Bundle skeleton
echo "==> Creating $APP ..."
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$PROJECT_DIR/assets/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>TestSimulator</string>
  <key>CFBundleDisplayName</key><string>TestSimulator</string>
  <key>CFBundleIdentifier</key><string>com.marcelo.testsimulator</string>
  <key>CFBundleVersion</key><string>1.0.0</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>TestSimulator</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST

# 4. Compile the native Swift wrapper straight into the bundle
echo "==> Compiling native app (swiftc)..."
TMPDIR_SRC="$(mktemp -d)"
sed "s|__WORKDIR__|$PROJECT_DIR|g" "$PROJECT_DIR/macos/TestSimulatorApp.swift" \
  > "$TMPDIR_SRC/TestSimulatorApp.swift"
swiftc -O "$TMPDIR_SRC/TestSimulatorApp.swift" \
  -o "$APP/Contents/MacOS/TestSimulator" \
  -framework Cocoa -framework WebKit
rm -rf "$TMPDIR_SRC"
chmod +x "$APP/Contents/MacOS/TestSimulator"

# 5. Refresh Launch Services / icon cache
touch "$APP"

echo ""
echo "✅ Instalada: $APP"
echo "   - Abrila desde Launchpad o Finder → Aplicaciones (o: open -a TestSimulator)."
echo "   - Se abre en su propia ventana. Fijala al Dock: click derecho en el ícono → Opciones → Mantener en el Dock."
echo "   - Para apagarla: Cmd+Q o cerrá la ventana (apaga el servidor)."
echo "   - Logs: ~/Library/Logs/TestSimulator.log"
