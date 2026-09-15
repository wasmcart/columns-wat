#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npx --yes --package wabt wat2wasm game.wat -o game.wasm
npx --yes wasmcart pack --wasm game.wasm --name "Columns WAT" \
  --version 1.0.0 --width 1280 --height 720 --controls dpad,a,b,x,y,start \
  -o columns-wat.wasc
echo "Built columns-wat.wasc"
