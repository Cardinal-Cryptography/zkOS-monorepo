// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MerkleTree } from "../contracts/MerkleTree.sol";
import { Nullifiers } from "../contracts/Nullifiers.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ShielderV2Mock
 * @author CardinalCryptography
 * @dev This is a mock version on ShielderV2 for testing purposes only.
 *      Most of the functionality has been removed for clarity.
 *
 * @custom:oz-upgrades-from Shielder
 * @custom:oz-upgrades-unsafe-allow external-library-linking
 */
contract ShielderV2Mock is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    MerkleTree,
    Nullifiers
{
    uint256 public mockStateVariable;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function initialize(
        address initialOwner,
        uint256 _mockVariable
    ) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __MerkleTree_init();
        _pause();

        mockStateVariable = _mockVariable;
    }

    function reinitialize(uint256 _mockVariable) public reinitializer(2) {
        mockStateVariable = _mockVariable;
    }
}
