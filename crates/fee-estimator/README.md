# Fee Estimator Service

This service provides fee estimation for the zkOS Shielder contract.

## Docker Setup

The fee estimator can now be run using Docker and Docker Compose, replacing the previous `start.sh` script.

### Prerequisites

- Docker
- Docker Compose

### Configuration

1. Copy the environment file and configure it:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. Required environment variables in `.env`:

   - `RPC_URL` - RPC endpoint URL
   - `CONTRACT_ADDRESS` - Shielder contract address (40-character hex string starting with 0x)
   - `ERC20_TOKEN_ADDRESS` - ERC20 token address (40-character hex string starting with 0x)
   - `ACCOUNT_PK` - Account private key, must have at least 1 gwei of native token and 2 smallest points of erc20-token at the first start.
   - `PROTOCOL_DEPOSIT_FEE_BPS` - Protocol deposit fee (0 - 10000)
   - `PROTOCOL_WITHDRAW_FEE_BPS` - Protocol withdraw fee (0 - 10000)

3. Optional environment variables:
   - `FEE_REFRESH_INTERVAL_MILLIS` - Fee refresh interval in milliseconds (default: 60000)
   - `SERVER_ADDRESS` - Server address (default: 0.0.0.0:3000)
   - `FEE_ESTIMATOR_DATA_DIR` - Directory where proving keys and parameters will be stored
     - Default in Docker: `/app/data` (persisted via Docker volume)
     - Default outside Docker: `$HOME/fee-estimator`
   - `PTAU_RESOURCES_DIR` - Directory where ptau files are located
     - Default in Docker: `/app/resources`
     - Default outside Docker: Path relative to the crate's manifest directory

### Running the Service

#### Using Docker Compose (Recommended)

```bash
# Start the service
./run-fee-estimator.sh
```

### Data Persistence

The service stores proving keys and parameters in a persistent volume. In Docker, this data is stored in a named volume `fee-estimator-data` that is mounted to `/app/data` inside the container. This ensures that the data persists across container restarts and rebuilds.

If you need to customize the data directory location, you can set the `FEE_ESTIMATOR_DATA_DIR` environment variable in your `.env` file.

### Resources

The service requires access to Powers of Tau (ptau) files for generating proving keys. In Docker, these files are copied from the `resources` directory in the project root to `/app/resources` inside the container.

If you need to customize the resources directory location, you can set the `PTAU_RESOURCES_DIR` environment variable in your `.env` file.

### Service Endpoints

The service will be available at `http://localhost:3000` with fee estimation endpoints (refer to the service implementation for specific endpoints).
