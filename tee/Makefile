include .env

.PHONY: generate-entities
generate-entities:
	sea-orm-cli generate entity -o crates/shielder-rewards-server/src/entity

.PHONY: db
db: run-docker-compose migrate

.PHONY: fresh-db
fresh-db: run-docker-compose migrate-fresh

.PHONY: run-docker-compose
run-docker-compose:
	docker compose up -d

.PHONY: migrate
migrate:
	cd crates/shielder-rewards-migrations && cargo run

.PHONY: migrate-fresh
migrate-fresh:
	cd crates/shielder-rewards-migrations && cargo run fresh
