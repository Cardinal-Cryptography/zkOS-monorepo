#!/bin/bash
# `sed -i` is used differently under MacOS
OS=$(uname)
if [ "$OS" = "Darwin" ]; then
  SED_CMD="sed -i ''"
else
  SED_CMD="sed -i"
fi

# Path to the file we need to modify
FILE="pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-3e04391371ad0a8e/src/workerHelpers.js"


# First patch: Add import at the top
# Create a temp file with the import line and append original content
$SED_CMD '21i \
import HelperWorker from "./workerHelpers.worker.js?worker&inline";
' "$FILE"

# Second patch: Replace worker creation code
# Using awk for multi-line replacement since it's more reliable than sed
awk '
  BEGIN { p=1 }
  /const worker = new Worker/ { 
    print "      const worker = new HelperWorker();"
    p=0 
  }
  /type: .module./ { p=0 }
  p { print }
  /\);/ { p=1 }
' "$FILE" > temp_file
mv temp_file "$FILE"

# Third patch: Update import in worker file
WORKER_FILE="pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-3e04391371ad0a8e/src/workerHelpers.worker.js"
$SED_CMD "s|import initWbg, { wbg_rayon_start_worker } from '../../../';|import initWbg, { wbg_rayon_start_worker } from '../../../shielder_wasm';|g" "$WORKER_FILE"
