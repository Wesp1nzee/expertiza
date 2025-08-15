FROM rust:1.85-alpine AS builder
RUN apk add --no-cache musl-dev build-base pkgconfig openssl-dev

WORKDIR /usr/src/app

COPY Cargo.toml Cargo.lock ./

COPY migrations ./migrations

COPY src ./src

RUN cargo build --release

FROM alpine:latest
RUN apk add --no-cache ca-certificates libgcc openssl
WORKDIR /usr/local/bin

COPY --from=builder /usr/src/app/target/release/expertiza .

COPY static ./static
COPY templates ./templates
COPY migrations ./migrations

EXPOSE 3000
CMD ["./expertiza"]
