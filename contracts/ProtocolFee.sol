// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

using SafeERC20 for IERC20;
using Math for uint256;

abstract contract ProtocolFee is Initializable {
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant MAX_FEE_BPS = 500;

    // keccak256(abi.encode(uint256(keccak256("zkos.storage.ProtocolFee")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant PROTOCOL_FEE_LOCATION =
        0x9c87721c17e6235fff8083d0b9984a29270f914f1ee4a52de715ea78a62a0b00;

    /// @custom:storage-location erc7201:zkos.storage.ProtocolFee
    struct ProtocolFeeStorage {
        uint256 protocolDepositFeeBps;
        uint256 protocolWithdrawFeeBps;
        address protocolFeeReceiver;
    }

    error DepositFeeTooHigh();
    error WithdrawFeeTooHigh();

    function _getProtocolFeeStorage()
        private
        pure
        returns (ProtocolFeeStorage storage $)
    {
        assembly {
            $.slot := PROTOCOL_FEE_LOCATION
        }
    }

    // solhint-disable func-name-mixedcase
    function __ProtocolFee_init(
        uint256 _depositFeeBps,
        uint256 _withdrawFeeBps,
        address _protocolFeeReceiver
    ) internal onlyInitializing {
        require(_depositFeeBps <= MAX_FEE_BPS, DepositFeeTooHigh());
        require(_withdrawFeeBps <= MAX_FEE_BPS, WithdrawFeeTooHigh());

        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        $.protocolDepositFeeBps = _depositFeeBps;
        $.protocolWithdrawFeeBps = _withdrawFeeBps;
        $.protocolFeeReceiver = _protocolFeeReceiver;
    }

    function protocolFeeReceiver() public view returns (address) {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        return $.protocolFeeReceiver;
    }

    function protocolWithdrawFeeBps() public view returns (uint256) {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        return $.protocolWithdrawFeeBps;
    }

    function protocolDepositFeeBps() public view returns (uint256) {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        return $.protocolDepositFeeBps;
    }

    function _computeProtocolDepositFeeFromNetAmount(
        uint256 amount
    ) internal view returns (uint256) {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        return
            amount.mulDiv($.protocolDepositFeeBps, MAX_BPS, Math.Rounding.Ceil);
    }

    function _computeProtocolDepositFeeFromGrossAmount(
        uint256 amount
    ) internal view returns (uint256) {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        return
            amount.mulDiv(
                $.protocolDepositFeeBps,
                MAX_BPS + $.protocolDepositFeeBps,
                Math.Rounding.Ceil
            );
    }

    function _computeProtocolWithdrawFee(
        uint256 amount
    ) internal view returns (uint256) {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        return
            amount.mulDiv(
                $.protocolWithdrawFeeBps,
                MAX_BPS,
                Math.Rounding.Ceil
            );
    }

    function _setProtocolFeeReceiver(address newProtocolFeeReceiver) internal {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        $.protocolFeeReceiver = newProtocolFeeReceiver;
    }

    function _setProtocolDepositFeeBps(
        uint256 newProtocolDepositFeeBps
    ) internal {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        require(newProtocolDepositFeeBps <= MAX_FEE_BPS, DepositFeeTooHigh());
        $.protocolDepositFeeBps = newProtocolDepositFeeBps;
    }

    function _setProtocolWithdrawFeeBps(
        uint256 newProtocolWithdrawFeeBps
    ) internal {
        ProtocolFeeStorage storage $ = _getProtocolFeeStorage();
        require(newProtocolWithdrawFeeBps <= MAX_FEE_BPS, WithdrawFeeTooHigh());
        $.protocolWithdrawFeeBps = newProtocolWithdrawFeeBps;
    }
}
