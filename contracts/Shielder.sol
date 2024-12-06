// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import { Halo2Verifier as NewAccountVerifier } from "./NewAccountVerifier.sol";
import { Halo2Verifier as DepositVerifier } from "./DepositVerifier.sol";
import { Halo2Verifier as WithdrawVerifier } from "./WithdrawVerifier.sol";
import { IArbSys } from "./IArbSys.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MerkleTree } from "./MerkleTree.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title Shielder
/// @author CardinalCryptography
contract Shielder is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    MerkleTree
{
    // -- Constants --

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

    /// The address of the Arbitrum system precompile.
    address private constant ARB_SYS_ADDRESS =
        0x0000000000000000000000000000000000000064;

    // -- Storage --

    // keccak256(abi.encode(uint256(keccak256("zkos.storage.Shielder")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant SHIELDER_LOCATION =
        0x3bbf33a565e911db5d234e02706e28046f872b5d4014a1408daa2ad1e7661c00;

    /// @custom:storage-location erc7201:zkos.storage.Shielder
    struct ShielderStorage {
        // Mapping from nullifier hash to the block at which it was revealed. Actually, the value will be the block number + 1,
        // so that the default value 0 can be used to indicate that the nullifier has not been revealed.
        mapping(uint256 => uint256) nullifiers;
        /// The temporary limit for the maximal deposit amount in the MVP version.
        uint256 depositLimit;
    }

    function _getShielderStorage()
        private
        pure
        returns (ShielderStorage storage $)
    {
        assembly {
            $.slot := SHIELDER_LOCATION
        }
    }

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
        ShielderStorage storage $ = _getShielderStorage();
        if (msg.value > $.depositLimit) revert AmountOverDepositLimit();
        _;
    }

    modifier restrictContractVersion(bytes3 expectedByCaller) {
        if (expectedByCaller != CONTRACT_VERSION) {
            revert WrongContractVersion(CONTRACT_VERSION, expectedByCaller);
        }
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /// @dev disable possibility to renounce ownership
    function renounceOwnership() public virtual override onlyOwner {}

    function initialize(
        address initialOwner,
        uint256 _depositLimit
    ) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __MerkleTree_init();
        _pause();

        ShielderStorage storage $ = _getShielderStorage();

        $.depositLimit = _depositLimit;
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
        ShielderStorage storage $ = _getShielderStorage();
        uint256 amount = msg.value;
        if ($.nullifiers[idHash] != 0) revert DuplicatedNullifier();
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        // @dev must follow the same order as in the circuit
        uint256[] memory publicInputs = new uint256[](3);
        publicInputs[0] = newNote;
        publicInputs[1] = idHash;
        publicInputs[2] = amount;

        bool success = NewAccountVerifier.verifyProof(proof, publicInputs);

        if (!success) revert NewAccountVerificationFailed();

        uint256 index = _addNote(newNote);
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
        ShielderStorage storage $ = _getShielderStorage();
        uint256 amount = msg.value;
        if (amount == 0) revert ZeroAmount();
        if ($.nullifiers[oldNullifierHash] != 0) revert DuplicatedNullifier();
        if (!_merkleRootExists(merkleRoot)) revert MerkleRootDoesNotExist();
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = idHiding;
        publicInputs[1] = merkleRoot;
        publicInputs[2] = oldNullifierHash;
        publicInputs[3] = newNote;
        publicInputs[4] = amount;

        bool success = DepositVerifier.verifyProof(proof, publicInputs);

        if (!success) revert DepositVerificationFailed();

        uint256 index = _addNote(newNote);
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
        ShielderStorage storage $ = _getShielderStorage();
        if (amount == 0) revert ZeroAmount();
        if (amount <= relayerFee) revert FeeHigherThanAmount();
        if (amount > MAX_TRANSACTION_AMOUNT) revert AmountTooHigh();

        if (!_merkleRootExists(merkleRoot)) revert MerkleRootDoesNotExist();
        if ($.nullifiers[oldNullifierHash] != 0) revert DuplicatedNullifier();

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

        bool success = WithdrawVerifier.verifyProof(proof, publicInputs);

        if (!success) revert WithdrawVerificationFailed();

        uint256 newNoteIndex = _addNote(newNote);
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
        ShielderStorage storage $ = _getShielderStorage();
        uint256 blockNumber = IArbSys(ARB_SYS_ADDRESS).arbBlockNumber();
        $.nullifiers[nullifier] = blockNumber + 1;
    }

    function addressToUInt256(address addr) public pure returns (uint256) {
        return uint256(uint160(addr));
    }

    // -- Getters ---

    function nullifiers(uint256 nullifier) public view returns (uint256) {
        ShielderStorage storage $ = _getShielderStorage();
        return $.nullifiers[nullifier];
    }

    function depositLimit() public view returns (uint256) {
        ShielderStorage storage $ = _getShielderStorage();
        return $.depositLimit;
    }

    // -- Setters ---

    /*
     * Set the deposit limit for the maximal amount
     */
    function setDepositLimit(uint256 _depositLimit) external onlyOwner {
        ShielderStorage storage $ = _getShielderStorage();
        $.depositLimit = _depositLimit;
    }
}
