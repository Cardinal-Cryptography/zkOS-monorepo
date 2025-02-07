#!/bin/bash
# `sed -i` is used differently under MacOS
OS=$(uname)
if [ "$OS" = "Darwin" ]; then
  SED_CMD="sed -i ''"
else
  SED_CMD="sed -i"
fi

# Create a vite-specific dist directory
rm -rf dist-vite
cp -r dist dist-vite

# Update worker initialization in wasmClientWorker.js
awk '
/const worker = new Worker\(new URL/ { 
  in_block = 1
  next 
}
in_block && /type: "module"/ {
  in_block = 1
  next
}
in_block && /\}\);/ {
  print "    const worker = new InlineWorker();"
  in_block = 0
  next
}
!in_block { print }
' dist-vite/wasmClientWorker.js > temp && mv temp dist-vite/wasmClientWorker.js

# Update worker initialization in workerHelpers.js
awk '
/const worker = new Worker\(/ { 
  in_block = 1
  next 
}
in_block && /type: '\''module'\''/ {
  in_block = 1
  next
}
in_block && /\);/ {
  in_block = 0
  print "      const worker = new InlineWorker();"
  next
}
!in_block { print }
' dist-vite/crates/shielder_bindings/pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-3e04391371ad0a8e/src/workerHelpers.js > temp && mv temp dist-vite/crates/shielder_bindings/pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-3e04391371ad0a8e/src/workerHelpers.js

# Add imports at the top of files
$SED_CMD '1i\
import InlineWorker from "./wasmClientWorker?worker&inline";
' dist-vite/wasmClientWorker.js

$SED_CMD '1i\
import InlineWorker from "./workerHelpers.worker.js?worker&inline";
' dist-vite/crates/shielder_bindings/pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-3e04391371ad0a8e/src/workerHelpers.js
