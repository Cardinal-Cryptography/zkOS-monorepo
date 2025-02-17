// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract AnonymityRevoker is Initializable {
    // keccak256(abi.encode(uint256(keccak256("zkos.storage.AnonymityRevoker")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ANONYMITY_REVOKER_LOCATION =
        0x82881b1719ba4dfb061ce0c3d608959c0e642d28eb9b6f9efe63d7e5c6c4f000;

    /// @custom:storage-location erc7201:zkos.storage.AnonymityRevoker
    struct AnonymityRevokerStorage {
        // temporary, will be replaced with a curve point (two or three field elements)
        // IMPORTANT: curve point should be validated in the circuit or the contract!
        uint256 anonymityRevokerPublicKey;
    }

    /*
     * Initialize the anonymity revoker.
     */
    // solhint-disable func-name-mixedcase
    function __AnonymityRevoker_init(
        uint256 anonymityRevokerPubkey
    ) internal onlyInitializing {
        AnonymityRevokerStorage storage $ = _getAnonymityRevokerStorage();
        $.anonymityRevokerPublicKey = anonymityRevokerPubkey;
    }

    function _getAnonymityRevokerStorage()
        private
        pure
        returns (AnonymityRevokerStorage storage $)
    {
        assembly {
            $.slot := ANONYMITY_REVOKER_LOCATION
        }
    }

    function anonymityRevokerPubkey() public view returns (uint256) {
        AnonymityRevokerStorage storage $ = _getAnonymityRevokerStorage();
        return $.anonymityRevokerPublicKey;
    }
}
