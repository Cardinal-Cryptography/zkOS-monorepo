// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import { IArbSys } from "./IArbSys.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MerkleTree } from "./MerkleTree.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UIntSet } from "./UIntSet.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IVerifier {
    function verifyProof(
        address vk,
        bytes calldata proof,
        uint256[] calldata instances
    ) external returns (bool);
}

/// @title Shielder
/// @author CardinalCryptography
/// @custom:oz-upgrades-unsafe-allow external-library-linking
contract Shielder is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using UIntSet for UIntSet.Set;
    using MerkleTree for MerkleTree.MerkleTreeData;

    // -- Storage --

    /// The contract version, in the form `0x{v1}{v2}{v3}`, where:
    ///  - `v1` is the version of the note schema,
    ///  - `v1.v2` is the version of the circuits used,
    ///  - `v1.v2.v3` is the version of the contract itself.
    bytes3 public constant CONTRACT_VERSION = 0x000001;

    /// This amount of gas should be sufficient for ether transfers
    /// and simple fallback function execution, yet still protecting against reentrancy attack.
    uint256 public constant GAS_LIMIT = 3500;

    /// The range check in circuits will work only if we ensure bounded transaction values
    /// on the contract side.
    uint256 public constant MAX_TRANSACTION_AMOUNT = 2 ** 112 - 1;

    /// Safeguards against a scenario when multiple deposits create a shielded account balance
    /// that fails the new account balance range check in the withdrawal circuit, thus
    /// making withdrawals impossible. In the contract we can't control a single shielded balance,
    /// so we control the sum of balances instead.
    uint256 public constant MAX_CONTRACT_BALANCE = MAX_TRANSACTION_AMOUNT;

    /// The temporary limit for the maximal deposit amount in the MVP version.
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

    // -- Events --
    event NewAccountNative(
        bytes3 contractVersion,
        uint256 idHash,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex
    );
    event DepositNative(
        bytes3 contractVersion,
        uint256 idHiding,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex
    );
    event WithdrawNative(
        bytes3 contractVersion,
        uint256 idHiding,
        uint256 amount,
        address to,
        uint256 newNote,
        uint256 newNoteIndex,
        address relayerAddress,
        uint256 fee
    );

    // -- Errors --

    error DepositVerificationFailed();
    error DuplicatedNullifier();
    error FeeHigherThanAmount();
    error MerkleRootDoesNotExist();
    error NativeTransferFailed();
    error WithdrawVerificationFailed();
    error NewAccountVerificationFailed();
    error ZeroAmount();
    error AmountOverDepositLimit();
    error AmountTooHigh();
    error ContractBalanceLimitReached();
    error LeafIsNotInTheTree();
    error PrecompileCallFailed();
    error WrongContractVersion(bytes3 actual, bytes3 expectedByCaller);

    modifier withinDepositLimit() {
        if (msg.value > depositLimit) revert AmountOverDepositLimit();
        _;
    }

    modifier restrictContractVersion(bytes3 expectedByCaller) {
        if (expectedByCaller != CONTRACT_VERSION)
            revert WrongContractVersion(CONTRACT_VERSION, expectedByCaller);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev disable possibility to renounce ownership
    function renounceOwnership() public virtual override onlyOwner {}

    function initialize(
        address initialOwner,
        address _poseidon2,
        address _newAccountVerifier,
        address _depositVerifier,
        address _withdrawVerifier,
        address _newAccountVerifyingKey,
        address _depositVerifyingKey,
        address _withdrawVerifyingKey,
        uint256 _depositLimit
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

        depositLimit = _depositLimit;
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /*
     * Creates a fresh note, with an optional native token deposit.
     *
     * This transaction serves as the entrypoint to the Shielder.
     */
    function newAccountNative(
        bytes3 expectedContractVersion,
        uint256 newNote,
        uint256 idHash,
        bytes calldata proof
    )
        external
        payable
        whenNotPaused
        withinDepositLimit
        restrictContractVersion(expectedContractVersion)
    {
        uint256 amount = msg.value;
        if (nullifiers[idHash] != 0) revert DuplicatedNullifier();
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE)
            revert ContractBalanceLimitReached();

        // @dev must follow the same order as in the circuit
        uint256[] memory publicInputs = new uint256[](3);
        publicInputs[0] = newNote;
        publicInputs[1] = idHash;
        publicInputs[2] = amount;

        IVerifier _verifier = IVerifier(newAccountVerifier);
        bool success = _verifier.verifyProof(
            newAccountVerifyingKey,
            proof,
            publicInputs
        );

        if (!success) revert NewAccountVerificationFailed();

        uint256 index = merkleTree.addNote(newNote);
        merkleRoots.add(merkleTree.root);
        registerNullifier(idHash);

        emit NewAccountNative(CONTRACT_VERSION, idHash, amount, newNote, index);
    }

    /*
     * Make a native token deposit into the Shielder
     */
    function depositNative(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        bytes calldata proof
    )
        external
        payable
        whenNotPaused
        withinDepositLimit
        restrictContractVersion(expectedContractVersion)
    {
        uint256 amount = msg.value;
        if (amount == 0) revert ZeroAmount();
        if (nullifiers[oldNullifierHash] != 0) revert DuplicatedNullifier();
        if (!merkleRoots.contains(merkleRoot)) revert MerkleRootDoesNotExist();
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE)
            revert ContractBalanceLimitReached();

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = idHiding;
        publicInputs[1] = merkleRoot;
        publicInputs[2] = oldNullifierHash;
        publicInputs[3] = newNote;
        publicInputs[4] = amount;

        IVerifier _verifier = IVerifier(depositVerifier);
        bool success = _verifier.verifyProof(
            depositVerifyingKey,
            proof,
            publicInputs
        );

        if (!success) revert DepositVerificationFailed();

        uint256 index = merkleTree.addNote(newNote);
        merkleRoots.add(merkleTree.root);
        registerNullifier(oldNullifierHash);

        emit DepositNative(
            CONTRACT_VERSION,
            idHiding,
            msg.value,
            newNote,
            index
        );
    }

    /*
     * Withdraw shielded native funds
     */
    function withdrawNative(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 amount,
        address withdrawAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee
    ) external whenNotPaused restrictContractVersion(expectedContractVersion) {
        if (amount == 0) revert ZeroAmount();
        if (amount <= relayerFee) revert FeeHigherThanAmount();
        if (amount > MAX_TRANSACTION_AMOUNT) revert AmountTooHigh();

        if (!merkleRoots.contains(merkleRoot)) revert MerkleRootDoesNotExist();
        if (nullifiers[oldNullifierHash] != 0) revert DuplicatedNullifier();

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](6);
        publicInputs[0] = idHiding;
        publicInputs[1] = merkleRoot;
        publicInputs[2] = oldNullifierHash;
        publicInputs[3] = newNote;
        publicInputs[4] = amount;

        bytes memory commitment = abi.encodePacked(
            CONTRACT_VERSION,
            addressToUInt256(withdrawAddress),
            addressToUInt256(relayerAddress),
            relayerFee
        );
        // @dev shifting right by 4 bits so the commitment is smaller from r
        publicInputs[5] = uint256(keccak256(commitment)) >> 4;

        IVerifier _verifier = IVerifier(withdrawVerifier);
        bool success = _verifier.verifyProof(
            withdrawVerifyingKey,
            proof,
            publicInputs
        );

        if (!success) revert WithdrawVerificationFailed();

        uint256 newNoteIndex = merkleTree.addNote(newNote);
        merkleRoots.add(merkleTree.root);
        registerNullifier(oldNullifierHash);

        // return the tokens
        (bool nativeTransferSuccess, ) = withdrawAddress.call{
            value: amount - relayerFee,
            gas: GAS_LIMIT
        }("");
        if (!nativeTransferSuccess) revert NativeTransferFailed();

        // pay out the fee
        (nativeTransferSuccess, ) = relayerAddress.call{
            value: relayerFee,
            gas: GAS_LIMIT
        }("");
        if (!nativeTransferSuccess) revert NativeTransferFailed();

        emit WithdrawNative(
            CONTRACT_VERSION,
            idHiding,
            amount,
            withdrawAddress,
            newNote,
            newNoteIndex,
            relayerAddress,
            relayerFee
        );
    }

    function registerNullifier(uint256 nullifier) private {
        uint256 blockNumber = arbSysPrecompile.arbBlockNumber();
        nullifiers[nullifier] = blockNumber + 1;
    }

    function addressToUInt256(address addr) public pure returns (uint256) {
        return uint256(uint160(addr));
    }

    // --- Getters ---

    /*
     * Given an index of a leaf return the path from a leaf index to the root,
     * omitting the root and leaf for gas efficiency,
     * as they can be derived from hashing their children.
     */

    function getMerklePath(
        uint256 id
    ) external view returns (uint256[] memory) {
        return merkleTree.getMerklePath(id);
    }

    // -- Setters ---

    /*
     * Set the deposit limit for the maximal amount
     */
    function setDepositLimit(uint256 _depositLimit) external onlyOwner {
        depositLimit = _depositLimit;
    }
}
