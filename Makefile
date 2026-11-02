.DEFAULT_GOAL := help

help: ## Показать цели
	@echo "make up     поднять сервисы compose (pgsql, redis, meilisearch, mailpit, minio) и дождаться healthy"
	@echo "make down   остановить сервисы, данные сохраняются"
	@echo "make fresh  пересоздать БД и заполнить сидами"
	@echo "make test-docker  живые тесты сервисов (нужен make up)"
	@echo "make e2e    собрать фронтенд и запустить Playwright"

up: ## Поднять сервисы и дождаться healthy
	docker compose up -d --wait

down: ## Остановить сервисы
	docker compose down

fresh: ## migrate:fresh --seed
	php artisan migrate:fresh --seed

test-docker: ## Живые тесты сервисов (нужен make up)
	composer test:docker

e2e: ## Playwright e2e (нужны собранные бандлы)
	npm run build
	npm run build:ssr
	npm run test:e2e
