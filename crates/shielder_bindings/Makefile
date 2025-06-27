# `sed -i` is used differently under MacOS
OS := $(shell uname)
ifeq ($(OS), Darwin)
	SED_CMD := sed -i ''
else
	SED_CMD := sed -i
endif

.PHONY: help
help: # Show help for each of the Makefile recipes.
	@grep -E '^[a-zA-Z0-9 -]+:.*#'  Makefile | sort | while read -r l; do printf "\033[1;32m$$(echo $$l | cut -f 1 -d':')\033[00m:$$(echo $$l | cut -f 2- -d'#')\n"; done

.PHONY: wasm
wasm: # Build wasm bindings
wasm: clean-wasm build-pkg-wasm update-package-web remove-unused-files-wasm

.PHONY: clean-wasm
clean-wasm:
	rm -rf pkg*

.PHONY: build-pkg-wasm
build-pkg-wasm:
	wasm-pack build --release --target web --out-dir pkg/pkg-web-singlethreaded -- \
		--features build-wasm \
		--features circuits \
		--target="wasm32-unknown-unknown" \
		-Z build-std="panic_abort,std"
	wasm-pack build --release --target web --out-dir pkg/pkg-web-multithreaded -- \
		--features build-wasm \
		--features circuits \
		--features multithreading-wasm \
		--target="wasm32-unknown-unknown" \
		-Z build-std="panic_abort,std"
	cp package.template.json pkg/package.json

.PHONY: update-package-web
update-package-web:
	$(SED_CMD) "s|import initWbg, { wbg_rayon_start_worker } from '../../../';|import initWbg, { wbg_rayon_start_worker } from '../../../shielder_bindings';|g" pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-3e04391371ad0a8e/src/workerHelpers.worker.js

.PHONY: remove-unused-files-wasm
remove-unused-files-wasm:
	(cd pkg/pkg-web-singlethreaded && rm README.md package.json .gitignore)
	(cd pkg/pkg-web-multithreaded && rm README.md package.json .gitignore)

.PHONY: wasm-light
wasm-light: # Build wasm bindings without circuits
	rm -rf pkg-light
	wasm-pack build --release --target web --out-dir pkg-light/pkg-web-singlethreaded -- \
		--features build-wasm \
		--target="wasm32-unknown-unknown" \
		-Z build-std="panic_abort,std"
	cp package-light.template.json pkg-light/package.json
	(cd pkg-light/pkg-web-singlethreaded && rm README.md package.json .gitignore)

.PHONY: test
test:
	cargo test --release
