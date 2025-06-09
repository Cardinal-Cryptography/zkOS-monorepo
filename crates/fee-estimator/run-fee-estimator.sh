#!/bin/bash
set -e

# Navigate to the fee-estimator directory
cd "$(dirname "$0")"

# Start the container using docker-compose (which will build the binary inside Docker)
echo "Building and starting fee-estimator container..."
docker-compose up

echo "Fee estimator is running!"
echo "You can check the logs with: docker-compose logs -f"
echo "To stop the service, run: docker-compose down"
