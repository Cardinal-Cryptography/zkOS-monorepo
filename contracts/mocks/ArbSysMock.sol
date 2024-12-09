// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IArbSys } from "../IArbSys.sol";

/**
 * Mock implementation of ArbSys for testing purposes.
 * @dev Returns just the `block.number`. Will work well when run on L1 chain.
 */
contract ArbSysMock is IArbSys {
    /**
     * @notice Get Arbitrum block number
     * @return block number as uint256
     */
    function arbBlockNumber() external view override returns (uint256) {
        return block.number;
    }
}
