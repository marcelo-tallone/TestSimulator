#!/bin/bash
# Removes the TestSimulator macOS app bundle.
set -euo pipefail
APP="/Applications/TestSimulator.app"
if [ -d "$APP" ]; then
  rm -rf "$APP"
  echo "✅ Eliminada: $APP"
else
  echo "No estaba instalada en $APP"
fi
