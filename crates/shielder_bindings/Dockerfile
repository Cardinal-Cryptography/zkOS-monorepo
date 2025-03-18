# syntax=docker/dockerfile:experimental

FROM debian:bookworm-slim AS build

RUN apt-get update && \
    apt-get install -y \
      curl \
      libssl-dev \
      ca-certificates \
      build-essential \
      pkg-config \
      openssh-client && \
    rm -rf /tmp/* /var/{tmp,cache}/* /var/lib/{apt,dpkg}/

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain none
ENV PATH="/root/.cargo/bin:${PATH}"

COPY ./crates ./zkos/crates
COPY ./Cargo.toml ./zkos/Cargo.toml
COPY ./Cargo.lock ./zkos/Cargo.lock
COPY ./rust-toolchain.toml ./zkos/rust-toolchain.toml
COPY ./resources ./zkos/resources

# download public key for github.com
RUN mkdir -p -m 0600 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts

RUN --mount=type=ssh cd zkos && cargo build --release --features build-server -p shielder_bindings

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y \
      libssl-dev \
      tini \
      ca-certificates && \
      rm -rf /tmp/* /var/{tmp,cache}/* /var/lib/{apt,dpkg}/

COPY --from=build /zkos/target/release/server /usr/local/bin
RUN chmod +x /usr/local/bin/server

RUN useradd server
USER server

EXPOSE 43312

ENTRYPOINT ["tini", "--", "server"]
