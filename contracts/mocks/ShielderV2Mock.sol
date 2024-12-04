// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IArbSys } from "../interfaces/IArbSys.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MerkleTree } from "../MerkleTree.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UIntSet } from "../UIntSet.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
/**
 * @title ShielderV2Mock
 * @author CardinalCryptography
 * @dev This is a mock version on ShielderV2 for testing purposes only.
 *      Most of the functionality has been removed for clarity.
 * @custom:oz-upgrades-from Shielder
 */
contract ShielderV2Mock is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using UIntSet for UIntSet.Set;
    using MerkleTree for MerkleTree.MerkleTreeData;

    // -- Storage --

    /// Depracated. Kept for storage integrity.
    uint256 public depositLimit;

    /// The address of the Arbitrum system precompile.
    address private constant ARB_SYS_ADDRESS =
        0x0000000000000000000000000000000000000064;
    IArbSys private arbSysPrecompile;

    // verifier contracts
    address public newAccountVerifier;
    address public depositVerifier;
    address public withdrawVerifier;

    // verification key contracts
    address public newAccountVerifyingKey;
    address public depositVerifyingKey;
    address public withdrawVerifyingKey;

    MerkleTree.MerkleTreeData public merkleTree;

    UIntSet.Set private merkleRoots;
    // Mapping from nullifier hash to the block at which it was revealed. Actually, the value will be the block number + 1,
    // so that the default value 0 can be used to indicate that the nullifier has not been revealed.
    mapping(uint256 => uint256) public nullifiers;

    // new state variables in V2
    address public mockVerifier;
    address public mockVerifyingKey;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address initialOwner,
        address _poseidon2,
        address _newAccountVerifier,
        address _depositVerifier,
        address _withdrawVerifier,
        address _newAccountVerifyingKey,
        address _depositVerifyingKey,
        address _withdrawVerifyingKey,
        address _mockVerifier,
        address _mockVerifyingKey
    ) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        _pause();

        merkleTree.init(_poseidon2);

        arbSysPrecompile = IArbSys(ARB_SYS_ADDRESS);

        newAccountVerifier = _newAccountVerifier;
        depositVerifier = _depositVerifier;
        withdrawVerifier = _withdrawVerifier;

        newAccountVerifyingKey = _newAccountVerifyingKey;
        depositVerifyingKey = _depositVerifyingKey;
        withdrawVerifyingKey = _withdrawVerifyingKey;

        mockVerifier = _mockVerifier;
        mockVerifyingKey = _mockVerifyingKey;
    }

    function reinitialize(
        address _mockVerifier,
        address _mockVerifyingKey
    ) public reinitializer(2) {
        mockVerifier = _mockVerifier;
        mockVerifyingKey = _mockVerifyingKey;
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
