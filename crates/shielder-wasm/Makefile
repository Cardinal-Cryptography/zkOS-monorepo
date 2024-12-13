# `sed -i` is used differently under MacOS
OS := $(shell uname)
ifeq ($(OS), Darwin)
	SED_CMD := sed -i ''
else
	SED_CMD := sed -i
endif

.PHONY: all
all: clean build-pkg update-package-web remove-unused-files

.PHONY: clean
clean:
	rm -rf pkg*

.PHONY: build-pkg
build-pkg:
	wasm-pack build --release --target web --out-dir pkg/pkg-web-singlethreaded -- \
		--target="wasm32-unknown-unknown" \
		-Z build-std="panic_abort,std"
	wasm-pack build --release --target web --out-dir pkg/pkg-web-multithreaded -- \
		--features multithreading \
		--target="wasm32-unknown-unknown" \
		-Z build-std="panic_abort,std"
	cp package.template.json pkg/package.json

.PHONY: update-package-web
update-package-web:
	$(SED_CMD) "s|import initWbg, { wbg_rayon_start_worker } from '../../../';|import initWbg, { wbg_rayon_start_worker } from '../../../shielder_wasm';|g" pkg/pkg-web-multithreaded/snippets/wasm-bindgen-rayon-3e04391371ad0a8e/src/workerHelpers.worker.js

.PHONY: remove-unused-files
remove-unused-files:
	(cd pkg/pkg-web-singlethreaded && rm README.md package.json .gitignore)
	(cd pkg/pkg-web-multithreaded && rm README.md package.json .gitignore)

.PHONY: test
test:
	cargo test --release
