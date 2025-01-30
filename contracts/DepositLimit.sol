// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract DepositLimit is Initializable {
    // keccak256(abi.encode(uint256(keccak256("zkos.storage.DepositLimit")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DEPOSIT_LIMIT_LOCATION =
        0x7c42a91ef893dda7417e45370bb7dd4d25655315448a12d2a8a2e303eff19d00;

    /// @custom:storage-location erc7201:zkos.storage.DepositLimit
    struct DepositLimitStorage {
        uint256 depositLimit;
    }

    error AmountOverDepositLimit();

    function _getDepositLimitStorage()
        private
        pure
        returns (DepositLimitStorage storage $)
    {
        assembly {
            $.slot := DEPOSIT_LIMIT_LOCATION
        }
    }

    modifier withinDepositLimit(uint256 amount, address token) {
        if (amount > depositLimit()) revert AmountOverDepositLimit();
        _;
    }

    // solhint-disable-next-line func-name-mixedcase
    function __DepositLimit_init(
        uint256 _depositLimit
    ) internal onlyInitializing {
        DepositLimitStorage storage $ = _getDepositLimitStorage();
        $.depositLimit = _depositLimit;
    }

    /// The temporary limit for the maximal deposit amount in the MVP version.
    function depositLimit() public view returns (uint256) {
        DepositLimitStorage storage $ = _getDepositLimitStorage();
        return $.depositLimit;
    }

    /*
     * Set the deposit limit for the maximal amount
     */
    function _setDepositLimit(uint256 _depositLimit) internal {
        DepositLimitStorage storage $ = _getDepositLimitStorage();
        $.depositLimit = _depositLimit;
    }
}
