# Expertiza

Below are two variants of the README: one in English, and one in Russian. You can choose the one that fits your audience.

---

## English Version


# Expertiza

**Expertiza** is a Rust web application built with the [Axum](https://crates.io/crates/axum) framework. It provides a RESTful API backed by PostgreSQL (via `sqlx`) and Redis.

---

## Table of Contents

- [Features](#features)  
- [Requirements](#requirements)  
- [Installation](#installation)  
- [Configuration](#configuration)  
- [Database & Migrations](#database--migrations)  
- [Running the Application](#running-the-application)  
- [Project Structure](#project-structure)  
- [Development & Testing](#development--testing)  
- [License](#license)

---

## Features

- HTTP server built with [Axum](https://crates.io/crates/axum)  
- Asynchronous runtime powered by [Tokio](https://crates.io/crates/tokio)  
- Layered middleware using [Tower](https://crates.io/crates/tower) & [Tower HTTP](https://crates.io/crates/tower-http)  
- CORS support, GZIP compression, and request timeouts  
- Structured logging and tracing with `tracing` & `tracing-subscriber`  
- PostgreSQL integration via [SQLx](https://crates.io/crates/sqlx) (with migrations and compile-time checked queries)  
- Caching & Pub/Sub using Redis (`redis` crate)  
- Configuration management with `.env` files (`dotenvy`)  
- Password hashing via `bcrypt`  
- UUIDs & date-time handling with `uuid` & `chrono`  
- JSON serialization with `serde` & `serde_json`

---

## Requirements

- Rust **1.70** or higher  
- PostgreSQL **12** or higher  
- Redis **6** or higher  
- Optional: `cargo-make` for task automation

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Wesp1nzee/expertiza.git
   cd expertiza


2. Download dependencies:

   ```bash
   cargo fetch
   ```

---

## Configuration

Create a `.env` file in the project root with the following variables:

```dotenv
# PostgreSQL database URL
DATABASE_URL=postgres://user:password@localhost:5432/expertiza_db

# Redis connection URL
REDIS_URL=redis://127.0.0.1/

# Logging level (optional)
RUST_LOG=info
```

---

## Database & Migrations

Migrations are stored in the `migrations/` directory. To apply migrations:

```bash
# Create a new migration (optional):
cargo sqlx migrate add create_users_table

# Run all pending migrations:
cargo sqlx migrate run
```

> Note: SQLx requires `DATABASE_URL` to be set in the environment to run migrations.

---

## Running the Application

```bash
# Development mode with auto-reload (requires cargo-watch):
cargo install cargo-watch
cargo watch -x run

# Or simply:
cargo run
```

The server will start on `127.0.0.1:3000` by default.

---

## Project Structure

```
expertiza/
├── Cargo.toml             # Cargo manifest
├── migrations/            # SQL migrations
├── src/
│   ├── main.rs            # Application entry point
│   ├── routes/            # API route definitions
│   ├── handlers/          # Request handlers
│   ├── models/            # Data models & entities
│   ├── db/                # Database setup & repositories
│   └── utils/             # Utility modules
├── static/                # Static assets (CSS, JS, images)
└── templates/             # HTML templates (if used)
```
---

## License

MIT © 2025 Wesp1nzee

````

---

## Русская версия


# Expertiza

**Expertiza** — это веб-приложение на Rust, разработанное на основе фреймворка [Axum](https://crates.io/crates/axum). Приложение предоставляет RESTful API с хранилищем данных в PostgreSQL (с помощью `sqlx`) и кэшем в Redis.

---

## Содержание

- [Особенности](#особенности)  
- [Требования](#требования)  
- [Установка](#установка)  
- [Конфигурация](#конфигурация)  
- [База данных и миграции](#база-данных-и-миграции)  
- [Запуск приложения](#запуск-приложения)  
- [Структура проекта](#структура-проекта)  
- [Разработка и тестирование](#разработка-и-тестирование)  
- [Лицензия](#лицензия)

---

## Особенности

- HTTP-сервер на базе [Axum](https://crates.io/crates/axum)  
- Асинхронная среда выполнения [Tokio](https://crates.io/crates/tokio)  
- Многослойный middleware с [Tower](https://crates.io/crates/tower) и [Tower HTTP](https://crates.io/crates/tower-http)  
- Поддержка CORS, GZIP-сжатия и таймаутов запросов  
- Логирование и трассировка через `tracing` и `tracing-subscriber`  
- Интеграция с PostgreSQL через [SQLx](https://crates.io/crates/sqlx) (миграции и проверенные компилятором запросы)  
- Кэширование и Pub/Sub на Redis (`redis`)  
- Управление конфигурацией через `.env` (`dotenvy`)  
- Хеширование паролей с помощью `bcrypt`  
- Работа с UUID и датами: `uuid` и `chrono`  
- Сериализация JSON: `serde` и `serde_json`

---

## Требования

- Rust **1.70** или выше  
- PostgreSQL **12** или выше  
- Redis **6** или выше  
- Необязательно: `cargo-make` для автоматизации задач

---

## Установка

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/Wesp1nzee/expertiza.git
   cd expertiza

2. Загрузите зависимости:

   ```bash
   cargo fetch
   ```

---

## Конфигурация

Создайте файл `.env` в корне проекта и добавьте переменные:

```dotenv
# URL подключения к PostgreSQL
DATABASE_URL=postgres://user:password@localhost:5432/expertiza_db

# URL подключения к Redis
REDIS_URL=redis://127.0.0.1/

# Уровень логирования (по желанию)
RUST_LOG=info
```

---

## База данных и миграции

Миграции находятся в папке `migrations/`. Чтобы применить миграции:

```bash
# Создать новую миграцию (опционально):
cargo sqlx migrate add create_users_table

# Применить все миграции:
cargo sqlx migrate run
```

> Примечание: для работы миграций SQLx требует наличия переменной `DATABASE_URL`.

---

## Запуск приложения

```bash
# Режим разработки с авто-перезапуском (требуется cargo-watch):
cargo install cargo-watch
cargo watch -x run

# Или просто:
cargo run
```

По умолчанию сервер слушает `127.0.0.1:3000`.

---

## Структура проекта

```
expertiza/
├── Cargo.toml           # манифест проекта Cargo
├── migrations/          # SQL-миграции
├── src/
│   ├── main.rs          # точка входа приложения
│   ├── routes/          # определение маршрутов API
│   ├── handlers/        # обработчики запросов
│   ├── models/          # модели данных
│   ├── db/              # инициализация БД и репозитории
│   └── utils/           # утилитарные модули
├── static/              # статические файлы (CSS, JS, изображения)
└── templates/           # HTML-шаблоны (если используются)
```

---

## Лицензия

MIT © 2025 Wesp1nzee

```
```
