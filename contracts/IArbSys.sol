// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

// Interface taken from https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbsys.

/**
 * @title System level functionality
 * @notice For use by contracts to interact with core L2-specific functionality.
 * Precompiled contract that exists in every Arbitrum chain at address(100), 0x0000000000000000000000000000000000000064.
 */
interface IArbSys {
    /**
     * @notice Get Arbitrum block number (distinct from L1 block number; Arbitrum genesis block has block number 0)
     * @return block number as uint256
     */
    function arbBlockNumber() external view returns (uint256);
}
