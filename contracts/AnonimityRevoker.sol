// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract AnonimityRevoker is Initializable {
    // keccak256(abi.encode(uint256(keccak256("zkos.storage.AnonimityRevoker")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ANONIMITY_REVOKER_LOCATION =
        0x5b0f505666906ace94a4483d131f0c67161d48664df9cddea7350dd9f5d54600;

    /// @custom:storage-location erc7201:zkos.storage.AnonimityRevoker
    struct AnonimityRevokerStorage {
        // temporary, will be replaced with a curve point (two or three field elements)
        // IMPORTANT: curve point should be validated in the circuit or the contract!
        uint256 anonimityRevokerPublicKey;
    }

    /*
     * Initialize the anonimity revoker.
     */
    // solhint-disable func-name-mixedcase
    function __AnonimityRevoker_init(
        uint256 anonimityRevokerPubkey
    ) internal onlyInitializing {
        AnonimityRevokerStorage storage $ = _getAnonimityRevokerStorage();
        $.anonimityRevokerPublicKey = anonimityRevokerPubkey;
    }

    function _getAnonimityRevokerStorage()
        private
        pure
        returns (AnonimityRevokerStorage storage $)
    {
        assembly {
            $.slot := ANONIMITY_REVOKER_LOCATION
        }
    }

    function anonimityRevokerPubkey() public view returns (uint256) {
        AnonimityRevokerStorage storage $ = _getAnonimityRevokerStorage();
        return $.anonimityRevokerPublicKey;
    }

    function _setAnonimityRevokerPubkey(
        uint256 anonimityRevokerPubkey
    ) internal {
        AnonimityRevokerStorage storage $ = _getAnonimityRevokerStorage();
        $.anonimityRevokerPublicKey = anonimityRevokerPubkey;
    }
}
