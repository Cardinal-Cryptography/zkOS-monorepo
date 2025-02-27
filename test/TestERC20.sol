// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * Customized `TestERC20` used in `integration-tests`. Reverts transfers
 * to 0xffffffffffffffffffffffffffffffffffffffff.
 */
contract RevmTestERC20 is TestERC20 {
    error DestinationTriggeredRevert();

    constructor() TestERC20("TestERC20", "TERC20") {
        _mint(msg.sender, type(uint256).max);
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
