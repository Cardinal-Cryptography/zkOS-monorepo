FROM debian:bullseye-slim

RUN apt-get update && \
    apt-get install -y \
      libssl-dev \
      ca-certificates && \
      rm -rf /tmp/* /var/{tmp,cache}/* /var/lib/{apt,dpkg}/

COPY ./target/release/ar-cli /usr/local/bin
RUN chmod +x /usr/local/bin/ar-cli

ENTRYPOINT ["ar-cli"]
