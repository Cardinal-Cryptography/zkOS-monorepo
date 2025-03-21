// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { IArbSys } from "./IArbSys.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract Nullifiers is Initializable {
    /// The Arbitrum system precompile.
    IArbSys private constant ARB_SYS_PRECOMPILE =
        IArbSys(0x0000000000000000000000000000000000000064);

    // keccak256(abi.encode(uint256(keccak256("zkos.storage.Nullfiers")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant NULLIFIERS_LOCATION =
        0xcbc8fc220e070071960fb3c5c42c1f465c63e8de54518b3151ca150cb02ec500;

    /// @custom:storage-location erc7201:zkos.storage.Nullfiers
    struct NullifiersStorage {
        // Mapping from nullifier hash to the block at which it was revealed. Actually, the value will be the block number + 1,
        // so that the default value 0 can be used to indicate that the nullifier has not been revealed.
        mapping(uint256 => uint256) nullifiers;
        bool isArbitrumChain;
    }

    function _getNullifiersStorage()
        private
        pure
        returns (NullifiersStorage storage $)
    {
        assembly {
            $.slot := NULLIFIERS_LOCATION
        }
    }

    /*
     * Initialize the tree.
     */
    // solhint-disable func-name-mixedcase
    function __Nullifiers_init(bool isArbitrumChain) internal onlyInitializing {
        NullifiersStorage storage $ = _getNullifiersStorage();
        $.isArbitrumChain = isArbitrumChain;
    }

    function nullifiers(uint256 nullifier) public view returns (uint256) {
        NullifiersStorage storage $ = _getNullifiersStorage();
        return $.nullifiers[nullifier];
    }

    function _registerNullifier(uint256 nullifier) internal {
        NullifiersStorage storage $ = _getNullifiersStorage();

        uint256 blockNumber = block.number;

        // Arbitrum chains use the system precompile to get the block number.
        if ($.isArbitrumChain) {
            blockNumber = ARB_SYS_PRECOMPILE.arbBlockNumber();
        }
        $.nullifiers[nullifier] = blockNumber + 1;
    }
}
