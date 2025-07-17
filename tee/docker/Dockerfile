FROM rust:1.88 AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./

# Copy the rest of your source code
COPY . .

RUN cargo build --release -p shielder-prover-server

FROM ubuntu:jammy

WORKDIR /app

COPY --from=builder /app/target/release/shielder-prover-server .

COPY docker/dockerentrypoint.sh .

RUN chmod +x dockerentrypoint.sh

# Expose the default public port
EXPOSE 3000

ENTRYPOINT ["/app/shielder-prover-server"]
