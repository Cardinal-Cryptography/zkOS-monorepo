FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y \
      libssl-dev \
      tini \
      ca-certificates && \
      rm -rf /tmp/* /var/{tmp,cache}/* /var/lib/{apt,dpkg}/

COPY ./target/release/fee-estimator /usr/local/bin
RUN chmod +x /usr/local/bin/fee-estimator

# Copy resources directory for ptau files
COPY ./resources /app/resources

# Create data directory with proper permissions
RUN mkdir -p /app/data && \
    useradd server && \
    chown -R server:server /app

USER server
ENV FEE_ESTIMATOR_DATA_DIR=/app/data
ENV PTAU_RESOURCES_DIR=/app/resources

ENTRYPOINT ["tini", "--", "fee-estimator"]
