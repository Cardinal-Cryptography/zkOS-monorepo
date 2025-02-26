// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * ERC20 token for testing purposes, which additionally reverts transfers
 * to 0xffffffffffffffffffffffffffffffffffffffff.
 */
contract TestERC20 is ERC20 {
    error DestinationTriggeredRevert();

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * Override `_update` to revert transfers to 0xffffffffffffffffffffffffffffffffffffffff.
     * According to ERC20 docs, all customizations to transfers should be done by overriding
     * this function.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        if (to == 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF) {
            revert DestinationTriggeredRevert();
        }
        super._update(from, to, value);
    }
}
