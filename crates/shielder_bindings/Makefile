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
		--target="wasm32-unknown-unknown" \
		-Z build-std="panic_abort,std"
	wasm-pack build --release --target web --out-dir pkg/pkg-web-multithreaded -- \
		--features build-wasm \
		--features multithreading-wasm \
		--target="wasm32-unknown-unknown" \
		-Z build-std="panic_abort,std"
	cp package.template.json pkg/package.json

.PHONY: update-package-web
update-package-web:
	$(SED_CMD) "s|import initWbg, { wbg_rayon_start_worker } from '../../../';|import initWbg, { wbg_rayon_start_worker } from '../../../shielder_bindings';|g" pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-38edf6e439f6d70d/src/workerHelpers.js

.PHONY: remove-unused-files-wasm
remove-unused-files-wasm:
	(cd pkg/pkg-web-singlethreaded && rm README.md package.json .gitignore)
	(cd pkg/pkg-web-multithreaded && rm README.md package.json .gitignore)

.PHONY: test
test:
	cargo test --release

.PHONY: ios
ios: # Build iOS bindings
ios:
	rm -rf ios-bindings
# currently build for aarch64-apple-ios-sim
	cargo build --release --features build-uniffi --target aarch64-apple-ios-sim
# generate bindings for Swift
	cargo run --features build-uniffi \
		--bin uniffi-bindgen generate \
		--library ../../target/aarch64-apple-ios-sim/release/libshielder_bindings.a \
		--language swift \
		--out-dir ios-bindings
