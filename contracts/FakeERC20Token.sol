// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Fake token for testing purposes.
 */
contract FakeERC20Token is ERC20 {
    error DestinationTriggeredRevert();

    constructor() ERC20("FakeERC20Token", "FAKE") {
        _mint(msg.sender, type(uint256).max);
    }

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
